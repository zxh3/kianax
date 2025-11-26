/**
 * Execution state management
 *
 * Tracks the state of a routine execution including:
 * - Results from each node execution
 * - Node-specific persistent state
 * - Execution path with run indexes
 */

import type {
  ExecutionError,
  NodeExecutionResult,
  PortData,
} from "../types/execution.js";

export class ExecutionState {
  /** Results from node executions (array supports multiple runs) */
  public readonly nodeResults = new Map<string, NodeExecutionResult[]>();

  /** Current execution path (order of node IDs with run index) */
  public readonly executionPath: Array<{ nodeId: string; runIndex: number }> =
    [];

  /** Node-specific persistent state (for loop nodes, etc.) */
  public readonly nodeStates = new Map<string, Record<string, unknown>>();

  /** Node outputs for data flow (latest output only) */
  public readonly nodeOutputs = new Map<string, PortData[]>();

  /**
   * Add a node execution result
   */
  addNodeResult(nodeId: string, result: NodeExecutionResult): void {
    // Store result (append to array - supports multiple runs)
    const results = this.nodeResults.get(nodeId) || [];
    const runIndex = results.length;
    results.push(result);
    this.nodeResults.set(nodeId, results);

    // Update outputs map (latest only)
    this.nodeOutputs.set(nodeId, result.outputs);

    // Add to execution path with run index
    this.executionPath.push({ nodeId, runIndex });
  }

  /**
   * Get the run index for a node (how many times it has executed)
   */
  getRunIndex(nodeId: string): number {
    const results = this.nodeResults.get(nodeId);
    return results ? results.length : 0;
  }

  /**
   * Check if a node has been executed at least once
   */
  hasExecuted(nodeId: string): boolean {
    return this.getRunIndex(nodeId) > 0;
  }

  /**
   * Get the latest result for a node
   */
  getNodeResult(nodeId: string): NodeExecutionResult | undefined {
    const results = this.nodeResults.get(nodeId);
    return results?.[results.length - 1];
  }

  /**
   * Get all results for a node (for loops)
   */
  getAllNodeResults(nodeId: string): NodeExecutionResult[] {
    return this.nodeResults.get(nodeId) || [];
  }

  /**
   * Get persistent state for a node (for loop nodes, etc.)
   */
  getNodeState(nodeId: string): Record<string, unknown> {
    let state = this.nodeStates.get(nodeId);
    if (!state) {
      state = {};
      this.nodeStates.set(nodeId, state);
    }
    return state;
  }

  /**
   * Set node state (useful for testing)
   */
  setNodeState(nodeId: string, state: Record<string, unknown>): void {
    this.nodeStates.set(nodeId, state);
  }

  /**
   * Check if execution has any errors
   */
  hasErrors(): boolean {
    for (const results of this.nodeResults.values()) {
      for (const result of results) {
        if (result.status === "error") {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get all errors from execution
   */
  getErrors(): Array<{ nodeId: string; error: ExecutionError }> {
    const errors: Array<{ nodeId: string; error: ExecutionError }> = [];

    for (const [nodeId, results] of this.nodeResults.entries()) {
      for (const result of results) {
        if (result.status === "error" && result.error) {
          errors.push({ nodeId, error: result.error });
        }
      }
    }

    return errors;
  }

  /**
   * Clear all state (useful for testing)
   */
  clear(): void {
    this.nodeResults.clear();
    this.executionPath.length = 0;
    this.nodeStates.clear();
    this.nodeOutputs.clear();
  }

  /**
   * Get statistics about the execution
   */
  getStats() {
    const uniqueNodes = this.nodeResults.size;
    const totalExecutions = Array.from(this.nodeResults.values()).reduce(
      (sum, results) => sum + results.length,
      0,
    );
    const failedNodes = Array.from(this.nodeResults.values()).filter(
      (results) => results.some((r) => r.status === "error"),
    ).length;

    return {
      uniqueNodes,
      totalExecutions,
      failedNodes,
      successfulNodes: uniqueNodes - failedNodes,
    };
  }
}
