/**
 * Main routine executor
 *
 * Executes Kianax routines using a BFS traversal algorithm with support for:
 * - Conditional branching
 * - Parallel execution
 * - Loop nodes
 * - Data lineage tracking
 */

import type {
  ExecutionCallbacks,
  ExecutionResult,
  ExecutorOptions,
  NodeExecutionResult,
  PortData,
} from "../types/execution.js";
import type {
  Edge,
  ExecutionGraph,
  Node,
  RoutineDefinition,
} from "../types/graph.js";
import { validateGraph } from "../validation/graph-validator.js";
import { ExecutionState } from "./execution-state.js";
import { gatherNodeInputs } from "./input-gatherer.js";
import {
  getDefaultIterationStrategy,
  type IterationStrategy,
} from "./iteration-strategy.js";
import {
  ExpressionResolver,
  type ExpressionContext,
} from "./expression-resolver.js";

/**
 * Plugin interface (from @kianax/plugin-sdk)
 */
export interface Plugin {
  execute(
    inputs: Record<string, unknown>,
    config: unknown,
    context: PluginContext,
    nodeState: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getId(): string;
  getMetadata(): PluginMetadata;
}

/**
 * Plugin context (from @kianax/plugin-sdk)
 *
 * Note: Loop state is managed by individual loop nodes via nodeState,
 * not by the execution engine.
 */
export interface PluginContext {
  userId: string;
  routineId: string;
  executionId: string;
  nodeId: string;
  /**
   * Resolved credentials.
   * Keys are the credential ID (or alias), values are the decrypted credential objects.
   */
  credentials?: Record<string, unknown>;
  triggerData?: unknown;
}

/**
 * Plugin metadata (from @kianax/plugin-sdk)
 */
export interface PluginMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  credentialRequirements?: { id: string; alias?: string; required?: boolean }[];
}

/**
 * Plugin registry interface
 */
export interface PluginRegistry {
  getPlugin(pluginId: string): Plugin | undefined;
  createPluginInstance(pluginId: string): Plugin | undefined;
}

/**
 * Credential Loader Interface
 * Responsible for fetching and decrypting credentials at runtime.
 */
export interface CredentialLoader {
  /**
   * Load and return the decrypted credential data.
   * @param credentialId The ID of the user credential to load.
   * @returns The credential data object.
   */
  load(credentialId: string): Promise<any>;
}

export class RoutineExecutor {
  private iterationStrategy: IterationStrategy;
  private credentialLoader?: CredentialLoader;
  private executionId: string = "";
  private startedAt: number = 0;

  constructor(
    private readonly pluginRegistry: PluginRegistry,
    options: ExecutorOptions & { credentialLoader?: CredentialLoader } = {},
    iterationStrategy?: IterationStrategy,
  ) {
    this.options = options;
    this.credentialLoader = options.credentialLoader;
    this.iterationStrategy = iterationStrategy || getDefaultIterationStrategy();
  }

  private readonly options: ExecutorOptions;

  /**
   * Execute a routine
   */
  async execute(
    routine: RoutineDefinition,
    callbacks: ExecutionCallbacks = {},
  ): Promise<ExecutionResult> {
    // Initialize execution metadata
    this.executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.startedAt = Date.now();

    // Validate graph structure
    const validation = validateGraph(routine);
    if (!validation.valid) {
      throw new Error(
        `Invalid routine graph:\n${validation.errors.map((e) => `- ${e.message}`).join("\n")}`,
      );
    }

    // Build execution graph
    const graph = this.buildExecutionGraph(routine);
    const state = new ExecutionState();

    // Execute graph using the configured iteration strategy
    await this.iterationStrategy.execute(
      graph,
      state,
      (nodeId) => this.executeNode(nodeId, graph, state, callbacks),
      {
        maxExecutionTime: this.options.maxExecutionTime,
        maxExecutions: this.options.maxNodes, // Renamed for clarity
        verbose: this.options.verbose,
      },
    );

    return {
      status: state.hasErrors() ? "failed" : "completed",
      nodeResults: state.nodeResults,
      executionPath: state.executionPath,
      errors: state.getErrors(),
    };
  }

  /**
   * Build an execution graph optimized for traversal
   */
  private buildExecutionGraph(routine: RoutineDefinition): ExecutionGraph {
    const nodes = new Map<string, Node>();
    const edgesByTarget = new Map<string, Edge[]>();
    const edgesBySource = new Map<string, Edge[]>();

    // Index nodes by ID
    for (const node of routine.nodes) {
      nodes.set(node.id, node);
    }

    // Index edges by source and target
    for (const edge of routine.connections) {
      // By target
      if (!edgesByTarget.has(edge.targetNodeId)) {
        edgesByTarget.set(edge.targetNodeId, []);
      }
      edgesByTarget.get(edge.targetNodeId)!.push(edge);

      // By source
      if (!edgesBySource.has(edge.sourceNodeId)) {
        edgesBySource.set(edge.sourceNodeId, []);
      }
      edgesBySource.get(edge.sourceNodeId)!.push(edge);
    }

    // Convert routine variables array to a map for easy lookup
    const variables: Record<string, unknown> = {};
    if (routine.variables) {
      for (const v of routine.variables) {
        variables[v.name] = v.value;
      }
    }

    return {
      routineId: routine.id || "unknown",
      triggerData: routine.triggerData,
      variables,
      nodes,
      edges: routine.connections,
      edgesByTarget,
      edgesBySource,
    };
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    nodeId: string,
    graph: ExecutionGraph,
    state: ExecutionState,
    callbacks: ExecutionCallbacks,
  ): Promise<void> {
    const node = graph.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Call onNodeStart callback
    await callbacks.onNodeStart?.(nodeId);

    const startTime = Date.now();

    try {
      // Gather inputs from upstream nodes
      const inputs = gatherNodeInputs(nodeId, graph, state);

      // Get node state and run index
      const nodeState = state.getNodeState(nodeId);
      const runIndex = state.getRunIndex(nodeId);

      // Execute plugin (will be delegated to plugin registry)
      const outputs = await this.executePlugin(
        node,
        inputs,
        nodeState,
        runIndex,
        graph,
        state,
      );

      // Create result
      const result: NodeExecutionResult = {
        outputs,
        executionTime: Date.now() - startTime,
        status: "success",
      };

      // Store result
      state.addNodeResult(nodeId, result);

      // Call onNodeComplete callback
      await callbacks.onNodeComplete?.(nodeId, result);
    } catch (error) {
      const err = error as Error;

      // Create error result
      const result: NodeExecutionResult = {
        outputs: [],
        executionTime: Date.now() - startTime,
        status: "error",
        error: {
          message: err.message,
          stack: err.stack,
        },
      };

      // Store result
      state.addNodeResult(nodeId, result);

      // Call onNodeError callback
      await callbacks.onNodeError?.(nodeId, err);

      // Re-throw to stop execution
      throw new Error(
        `Node ${nodeId} (${node.pluginId}) failed: ${err.message}`,
      );
    }
  }

  /**
   * Execute a plugin
   */
  private async executePlugin(
    node: Node,
    inputs: PortData[],
    nodeState: Record<string, unknown>,
    _runIndex: number,
    graph: ExecutionGraph,
    state: ExecutionState,
  ): Promise<PortData[]> {
    // Get plugin from registry
    const plugin = this.pluginRegistry.createPluginInstance(node.pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${node.pluginId}`);
    }

    // Resolve credentials
    const credentials: Record<string, unknown> = {};
    const requirements = plugin.getMetadata().credentialRequirements || [];

    if (requirements.length > 0) {
      if (!this.credentialLoader) {
        throw new Error(
          "Plugin requires credentials but no CredentialLoader provided",
        );
      }

      for (const req of requirements) {
        const key = req.alias || req.id;
        // Find mapping for this specific requirement key
        // First check mapping by alias/id, then maybe ID directly if no alias used?
        // Simpler: user maps "alias" -> "credId"

        const mappedCredId =
          node.credentialMappings?.[req.id] || node.credentialMappings?.[key];

        if (!mappedCredId) {
          if (req.required !== false) {
            throw new Error(`Missing required credential mapping for '${key}'`);
          }
          continue;
        }

        try {
          const credentialData = await this.credentialLoader.load(mappedCredId);
          credentials[key] = credentialData;
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          throw new Error(
            `Failed to load credential '${key}' (${mappedCredId}): ${errorMessage}`,
          );
        }
      }
    }

    // Build expression context for resolving variables
    const expressionContext: ExpressionContext = {
      nodes: state.nodeOutputs,
      vars: graph.variables,
      trigger: graph.triggerData,
      execution: {
        id: this.executionId,
        routineId: graph.routineId,
        startedAt: this.startedAt,
      },
    };

    // Resolve expressions in node parameters
    const resolver = new ExpressionResolver(expressionContext);
    const resolvedParameters = resolver.resolve(node.parameters);

    // Transform inputs from PortData[] to Record<string, any>
    // For each port, we take the first item's data (plugins work with single items)
    const pluginInputs = this.transformInputsToPlugin(inputs);

    // Create plugin context
    const context: PluginContext = {
      userId: "user-1", // TODO: Get from execution context
      routineId: graph.routineId,
      executionId: this.executionId,
      nodeId: node.id,
      triggerData: graph.triggerData,
      credentials,
    };

    // Execute plugin with resolved parameters
    const pluginOutputs = await plugin.execute(
      pluginInputs,
      resolvedParameters,
      context,
      nodeState,
    );

    // Transform outputs from Record<string, any> to PortData[]
    return this.transformOutputsFromPlugin(pluginOutputs, node.id);
  }

  /**
   * Transform execution-engine inputs (PortData[]) to plugin inputs (Record<string, any>)
   */
  private transformInputsToPlugin(inputs: PortData[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const portData of inputs) {
      // For now, we take the first item's data from each port
      // TODO: Handle multiple items (batching, array inputs, etc.)
      if (portData.items.length > 0) {
        const firstItem = portData.items[0];
        result[portData.portName] = firstItem?.data;
      }
    }

    return result;
  }

  /**
   * Transform plugin outputs (Record<string, any>) to execution-engine outputs (PortData[])
   */
  private transformOutputsFromPlugin(
    outputs: Record<string, unknown>,
    sourceNodeId: string,
  ): PortData[] {
    const result: PortData[] = [];

    for (const [portName, value] of Object.entries(outputs)) {
      // Skip undefined/null outputs
      if (value === undefined || value === null) {
        result.push({
          portName,
          items: [],
        });
        continue;
      }

      // Wrap the plugin output in an ExecutionItem
      result.push({
        portName,
        items: [
          {
            data: value,
            metadata: {
              sourceNode: sourceNodeId,
              sourcePort: portName,
            },
          },
        ],
      });
    }

    return result;
  }
}
