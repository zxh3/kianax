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
  credentials?: Record<string, string>;
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
}

/**
 * Plugin registry interface
 */
export interface PluginRegistry {
  getPlugin(pluginId: string): Plugin | undefined;
  createPluginInstance(pluginId: string): Plugin | undefined;
}

export class RoutineExecutor {
  private iterationStrategy: IterationStrategy;

  constructor(
    private readonly pluginRegistry: PluginRegistry,
    private readonly options: ExecutorOptions = {},
    iterationStrategy?: IterationStrategy,
  ) {
    this.iterationStrategy = iterationStrategy || getDefaultIterationStrategy();
  }

  /**
   * Execute a routine
   */
  async execute(
    routine: RoutineDefinition,
    callbacks: ExecutionCallbacks = {},
  ): Promise<ExecutionResult> {
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

    return {
      routineId: routine.id || "unknown",
      triggerData: routine.triggerData,
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
  ): Promise<PortData[]> {
    // Get plugin from registry
    const plugin = this.pluginRegistry.createPluginInstance(node.pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${node.pluginId}`);
    }

    // Transform inputs from PortData[] to Record<string, any>
    // For each port, we take the first item's data (plugins work with single items)
    const pluginInputs = this.transformInputsToPlugin(inputs);

    // Create plugin context
    const context: PluginContext = {
      userId: "user-1", // TODO: Get from execution context
      routineId: "routine-1", // TODO: Get from execution graph
      executionId: "exec-1", // TODO: Generate execution ID
      nodeId: node.id,
      triggerData: undefined, // TODO: Pass from graph
    };

    // Execute plugin
    const pluginOutputs = await plugin.execute(
      pluginInputs,
      node.parameters,
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
