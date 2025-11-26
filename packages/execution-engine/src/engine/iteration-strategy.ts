/**
 * Graph Iteration Strategies
 *
 * Abstracts the graph traversal algorithm from the executor.
 * Allows for different iteration strategies (BFS, DFS, parallel, etc.)
 *
 * NOTE: Loop handling is now done by dedicated loop nodes (like n8n's SplitInBatches),
 * not by special edge types. The iteration strategy just traverses the graph normally.
 */

import type { ExecutionGraph, Node } from "../types/graph.js";
import type { ExecutionState } from "./execution-state.js";

/**
 * Node executor function (provided by the Executor)
 */
export type NodeExecutor = (nodeId: string) => Promise<void>;

/**
 * Iteration strategy interface
 */
export interface IterationStrategy {
  /**
   * Execute the graph using this iteration strategy
   *
   * @param graph - The execution graph
   * @param state - The execution state
   * @param executeNode - Function to execute a single node
   * @param options - Strategy-specific options
   */
  execute(
    graph: ExecutionGraph,
    state: ExecutionState,
    executeNode: NodeExecutor,
    options?: IterationOptions,
  ): Promise<void>;
}

/**
 * Common iteration options
 */
export interface IterationOptions {
  /** Maximum execution time in milliseconds */
  maxExecutionTime?: number;
  /** Maximum number of total node executions (not unique nodes) */
  maxExecutions?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * BFS (Breadth-First Search) Iteration Strategy
 *
 * Executes nodes level by level, processing all nodes at the same depth
 * before moving to the next level. Supports:
 * - Parallel execution of independent nodes
 * - Conditional branching
 * - Natural loop handling (nodes can output to upstream nodes)
 */
export class BFSIterationStrategy implements IterationStrategy {
  async execute(
    graph: ExecutionGraph,
    state: ExecutionState,
    executeNode: NodeExecutor,
    options: IterationOptions = {},
  ): Promise<void> {
    // Find entry nodes (no incoming edges)
    const entryNodes = this.findEntryNodes(graph);

    if (entryNodes.length === 0) {
      throw new Error("No entry nodes found - routine has no starting point");
    }

    // Initialize queue with entry nodes
    let queue = [...entryNodes.map((n) => n.id)];
    const startTime = Date.now();
    let totalExecutions = 0;

    while (queue.length > 0) {
      // Check timeout
      if (
        options.maxExecutionTime &&
        Date.now() - startTime > options.maxExecutionTime
      ) {
        throw new Error(
          `Execution timeout after ${options.maxExecutionTime}ms`,
        );
      }

      // Check max executions
      if (options.maxExecutions && totalExecutions >= options.maxExecutions) {
        throw new Error(
          `Execution stopped after ${options.maxExecutions} executions`,
        );
      }

      // Find nodes ready to execute (all dependencies satisfied)
      const ready = this.findReadyNodes(queue, graph, state);

      if (ready.length === 0) {
        // No nodes ready - check if we're done or have a deadlock
        if (queue.length > 0) {
          throw new Error(
            `Execution deadlock: ${queue.length} nodes waiting but none are ready`,
          );
        }
        break;
      }

      // Execute ready nodes in parallel
      await Promise.all(ready.map((nodeId) => executeNode(nodeId)));
      totalExecutions += ready.length;

      // Remove executed nodes from queue
      queue = queue.filter((id) => !ready.includes(id));

      // Determine next nodes based on outputs
      const nextNodes = this.determineNextNodes(ready, graph, state);

      // Add next nodes to queue (allow re-queueing for loops)
      for (const nodeId of nextNodes) {
        if (!queue.includes(nodeId)) {
          queue.push(nodeId);
        }
      }
    }
  }

  /**
   * Find entry nodes (nodes with no incoming edges)
   */
  private findEntryNodes(graph: ExecutionGraph): Node[] {
    const nodes: Node[] = [];
    for (const [nodeId, node] of graph.nodes) {
      const incomingEdges = graph.edgesByTarget.get(nodeId) || [];
      if (incomingEdges.length === 0) {
        nodes.push(node);
      }
    }
    return nodes;
  }

  /**
   * Find nodes that are ready to execute (all dependencies satisfied)
   */
  private findReadyNodes(
    queue: string[],
    graph: ExecutionGraph,
    state: ExecutionState,
  ): string[] {
    return queue.filter((nodeId) => {
      const incomingEdges = graph.edgesByTarget.get(nodeId) || [];

      // All dependencies must have executed at least once and have output
      return incomingEdges.every((edge) => {
        const sourceResult = state.getNodeResult(edge.sourceNodeId);
        if (!sourceResult || sourceResult.status === "error") {
          return false;
        }

        // Check if the specific output port has data
        const hasPortOutput = sourceResult.outputs.some(
          (p) => p.portName === edge.sourcePort && p.items.length > 0,
        );

        return hasPortOutput;
      });
    });
  }

  /**
   * Determine which nodes should be executed next based on current results
   */
  private determineNextNodes(
    executedNodes: string[],
    graph: ExecutionGraph,
    state: ExecutionState,
  ): Set<string> {
    const nextNodes = new Set<string>();

    for (const nodeId of executedNodes) {
      const result = state.getNodeResult(nodeId);
      if (!result || result.status === "error") continue;

      const outgoingEdges = graph.edgesBySource.get(nodeId) || [];

      for (const edge of outgoingEdges) {
        // Check if this output port produced data
        const portOutput = result.outputs.find(
          (p) => p.portName === edge.sourcePort,
        );

        if (!portOutput || portOutput.items.length === 0) {
          continue; // No data on this port
        }

        // Add target node (may be upstream for loops - that's fine!)
        nextNodes.add(edge.targetNodeId);
      }
    }

    return nextNodes;
  }
}

/**
 * DFS (Depth-First Search) Iteration Strategy
 *
 * Executes nodes by following a path to the end before backtracking.
 * Note: DFS doesn't work well with loops - use BFS for loop support.
 */
export class DFSIterationStrategy implements IterationStrategy {
  private visited = new Set<string>();

  async execute(
    graph: ExecutionGraph,
    state: ExecutionState,
    executeNode: NodeExecutor,
    options: IterationOptions = {},
  ): Promise<void> {
    // Find entry nodes
    const entryNodes = this.findEntryNodes(graph);

    if (entryNodes.length === 0) {
      throw new Error("No entry nodes found - routine has no starting point");
    }

    const startTime = Date.now();
    this.visited.clear();

    // Execute DFS from each entry node
    for (const entryNode of entryNodes) {
      await this.dfs(
        entryNode.id,
        graph,
        state,
        executeNode,
        options,
        startTime,
      );
    }
  }

  private async dfs(
    nodeId: string,
    graph: ExecutionGraph,
    state: ExecutionState,
    executeNode: NodeExecutor,
    options: IterationOptions,
    startTime: number,
  ): Promise<void> {
    // Check timeout
    if (
      options.maxExecutionTime &&
      Date.now() - startTime > options.maxExecutionTime
    ) {
      throw new Error(`Execution timeout after ${options.maxExecutionTime}ms`);
    }

    // Skip if already visited (prevents infinite loops)
    if (this.visited.has(nodeId)) {
      return;
    }

    // Check if all dependencies are satisfied
    const incomingEdges = graph.edgesByTarget.get(nodeId) || [];

    for (const edge of incomingEdges) {
      if (!this.visited.has(edge.sourceNodeId)) {
        // Recursively execute dependency first
        await this.dfs(
          edge.sourceNodeId,
          graph,
          state,
          executeNode,
          options,
          startTime,
        );
      }
    }

    // Execute this node
    this.visited.add(nodeId);
    await executeNode(nodeId);

    // Find and execute next nodes
    const result = state.getNodeResult(nodeId);
    if (!result || result.status === "error") return;

    const outgoingEdges = graph.edgesBySource.get(nodeId) || [];

    for (const edge of outgoingEdges) {
      // Check if port has data
      const portOutput = result.outputs.find(
        (p) => p.portName === edge.sourcePort,
      );
      if (!portOutput || portOutput.items.length === 0) continue;

      // Recursively execute next node
      await this.dfs(
        edge.targetNodeId,
        graph,
        state,
        executeNode,
        options,
        startTime,
      );
    }
  }

  private findEntryNodes(graph: ExecutionGraph): Node[] {
    const nodes: Node[] = [];
    for (const [nodeId, node] of graph.nodes) {
      const incomingEdges = graph.edgesByTarget.get(nodeId) || [];
      if (incomingEdges.length === 0) {
        nodes.push(node);
      }
    }
    return nodes;
  }
}

/**
 * Default iteration strategy (BFS)
 */
export function getDefaultIterationStrategy(): IterationStrategy {
  return new BFSIterationStrategy();
}
