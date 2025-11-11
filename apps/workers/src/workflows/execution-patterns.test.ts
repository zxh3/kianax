/**
 * Integration tests for workflow execution patterns
 *
 * Tests end-to-end execution of various routine patterns:
 * - Linear flow
 * - Parallel execution
 * - Conditional branching
 * - Nested conditions
 * - Diamond patterns
 */

import { describe, it, expect } from "vitest";
import type { RoutineInput } from "@kianax/shared/temporal";
import {
  buildExecutionGraph,
  findEntryNodes,
  findReadyNodes,
  determineNextNodes,
  gatherNodeInputs,
  ExecutionState,
} from "../lib/graph-executor";

/**
 * Track if-else execution count for alternating branches in nested tests
 */
let ifElseCounter = 0;

/**
 * Mock plugin executor - simulates plugin execution
 */
async function mockExecutePlugin(
  _nodeId: string,
  pluginId: string,
  inputs: Record<string, unknown>,
): Promise<unknown> {
  // Simulate different plugin behaviors
  switch (pluginId) {
    case "stock-price":
      return { price: 145, symbol: "AAPL" }; // 145 < 147.25, so it's a 5%+ drop

    case "if-else": {
      // Alternate between true/false for testing nested conditions
      // First if-else returns true, second returns false
      ifElseCounter++;
      const shouldReturnTrue = ifElseCounter % 2 === 1;
      return {
        branch: shouldReturnTrue ? "true" : "false",
        result: shouldReturnTrue,
      };
    }

    case "ai-transform":
      return { result: `Processed: ${JSON.stringify(inputs)}` };

    case "http-request":
      return { success: true, status: 200, data: "API response" };

    case "email":
      return { success: true, messageId: "msg-123" };

    default:
      return { data: `Output from ${pluginId}` };
  }
}

/**
 * Simulate BFS execution (simplified version of the actual workflow)
 */
async function simulateExecution(
  routine: RoutineInput,
): Promise<ExecutionState> {
  // Reset counter for each test
  ifElseCounter = 0;

  const graph = buildExecutionGraph(routine);
  const state = new ExecutionState();

  // Find entry nodes
  let queue = findEntryNodes(graph.nodes, graph.edges);

  while (queue.length > 0) {
    // Find ready nodes
    const ready = findReadyNodes(queue, graph.edges, state);

    if (ready.length === 0) break;

    // Execute ready nodes in parallel
    await Promise.all(
      ready.map(async (nodeId) => {
        const node = graph.nodes.get(nodeId)!;
        const inputs = gatherNodeInputs(nodeId, graph.edges, state);

        // Execute mock plugin
        const output = await mockExecutePlugin(nodeId, node.pluginId, inputs);

        // Store results
        state.nodeOutputs.set(nodeId, output);
        state.executed.add(nodeId);
        state.executionPath.push(nodeId);
      }),
    );

    // Remove executed from queue
    queue = queue.filter((id) => !state.executed.has(id));

    // Determine next nodes
    const nextNodes = new Set<string>();
    for (const nodeId of ready) {
      const nodeOutput = state.nodeOutputs.get(nodeId);
      const { nextNodes: next } = determineNextNodes(
        nodeId,
        nodeOutput,
        graph.nodes,
        graph.edges,
      );

      for (const nextId of next) {
        if (!state.executed.has(nextId) && !queue.includes(nextId)) {
          nextNodes.add(nextId);
        }
      }
    }

    queue.push(...Array.from(nextNodes));
  }

  return state;
}

describe("Workflow Execution Patterns", () => {
  describe("Linear Flow", () => {
    it("should execute nodes sequentially", async () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "stock-price",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "ai-transform",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "email",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
          { id: "c2", sourceNodeId: "n2", targetNodeId: "n3" },
        ],
      };

      const state = await simulateExecution(routine);

      expect(state.executionPath).toEqual(["n1", "n2", "n3"]);
      expect(state.executed.size).toBe(3);
      expect(state.nodeOutputs.get("n1")).toHaveProperty("price");
      expect(state.nodeOutputs.get("n3")).toHaveProperty("success", true);
    });
  });

  describe("Parallel Execution", () => {
    it("should execute independent nodes in parallel", async () => {
      const routine: RoutineInput = {
        routineId: "r2",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "stock-price",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "http-request",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "ai-transform",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          {
            id: "c1",
            sourceNodeId: "n1",
            targetNodeId: "n3",
            sourceHandle: "price",
            targetHandle: "stockData",
          },
          {
            id: "c2",
            sourceNodeId: "n2",
            targetNodeId: "n3",
            sourceHandle: "data",
            targetHandle: "newsData",
          },
        ],
      };

      const state = await simulateExecution(routine);

      // n1 and n2 should execute first (order may vary)
      expect(state.executed.has("n1")).toBe(true);
      expect(state.executed.has("n2")).toBe(true);
      expect(state.executed.has("n3")).toBe(true);

      // n3 should wait for both n1 and n2
      const n3Index = state.executionPath.indexOf("n3");
      const n1Index = state.executionPath.indexOf("n1");
      const n2Index = state.executionPath.indexOf("n2");

      expect(n3Index).toBeGreaterThan(n1Index);
      expect(n3Index).toBeGreaterThan(n2Index);

      // Verify inputs were gathered correctly
      const n3Inputs = gatherNodeInputs("n3", routine.connections, state);
      expect(n3Inputs).toHaveProperty("stockData");
      expect(n3Inputs).toHaveProperty("newsData");
    });
  });

  describe("Conditional Branching", () => {
    it("should execute only the true branch when condition is true", async () => {
      const routine: RoutineInput = {
        routineId: "r3",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "stock-price",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "if-else",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "http-request",
            config: {},
            enabled: true,
          }, // True branch
          {
            id: "n4",
            pluginId: "email",
            config: {},
            enabled: true,
          }, // False branch
        ],
        connections: [
          {
            id: "c1",
            sourceNodeId: "n1",
            targetNodeId: "n2",
            sourceHandle: "price",
            targetHandle: "price",
          },
          {
            id: "c2",
            sourceNodeId: "n2",
            targetNodeId: "n3",
            condition: { type: "branch", value: "true" },
          },
          {
            id: "c3",
            sourceNodeId: "n2",
            targetNodeId: "n4",
            condition: { type: "branch", value: "false" },
          },
        ],
      };

      const state = await simulateExecution(routine);

      // Should execute: n1 → n2 → n3 (true branch)
      expect(state.executionPath).toContain("n1");
      expect(state.executionPath).toContain("n2");
      expect(state.executionPath).toContain("n3");
      expect(state.executionPath).not.toContain("n4"); // False branch skipped

      expect(state.executed.size).toBe(3);
    });

    it("should execute only the false branch when condition is false", async () => {
      const routine: RoutineInput = {
        routineId: "r4",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "stock-price",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "if-else",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "http-request",
            config: {},
            enabled: true,
          },
          {
            id: "n4",
            pluginId: "email",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
          {
            id: "c2",
            sourceNodeId: "n2",
            targetNodeId: "n3",
            condition: { type: "branch", value: "true" },
          },
          {
            id: "c3",
            sourceNodeId: "n2",
            targetNodeId: "n4",
            condition: { type: "branch", value: "false" },
          },
        ],
      };

      // Override mock for this test - simulate higher price
      const originalMock = mockExecutePlugin;
      const customMock = async (
        nodeId: string,
        pluginId: string,
        inputs: Record<string, unknown>,
      ) => {
        if (pluginId === "if-else") {
          return { branch: "false", result: false }; // Force false branch
        }
        return originalMock(nodeId, pluginId, inputs);
      };

      // Rebuild simulation with custom mock
      const graph = buildExecutionGraph(routine);
      const state = new ExecutionState();
      let queue = findEntryNodes(graph.nodes, graph.edges);

      while (queue.length > 0) {
        const ready = findReadyNodes(queue, graph.edges, state);
        if (ready.length === 0) break;

        await Promise.all(
          ready.map(async (nodeId) => {
            const node = graph.nodes.get(nodeId)!;
            const inputs = gatherNodeInputs(nodeId, graph.edges, state);
            const output = await customMock(nodeId, node.pluginId, inputs);
            state.nodeOutputs.set(nodeId, output);
            state.executed.add(nodeId);
            state.executionPath.push(nodeId);
          }),
        );

        queue = queue.filter((id) => !state.executed.has(id));

        const nextNodes = new Set<string>();
        for (const nodeId of ready) {
          const nodeOutput = state.nodeOutputs.get(nodeId);
          const { nextNodes: next } = determineNextNodes(
            nodeId,
            nodeOutput,
            graph.nodes,
            graph.edges,
          );
          for (const nextId of next) {
            if (!state.executed.has(nextId) && !queue.includes(nextId)) {
              nextNodes.add(nextId);
            }
          }
        }

        queue.push(...Array.from(nextNodes));
      }

      // Should execute: n1 → n2 → n4 (false branch)
      expect(state.executionPath).toContain("n1");
      expect(state.executionPath).toContain("n2");
      expect(state.executionPath).toContain("n4");
      expect(state.executionPath).not.toContain("n3"); // True branch skipped
    });
  });

  describe("Nested Branching", () => {
    it("should handle nested if-else conditions", async () => {
      const routine: RoutineInput = {
        routineId: "r5",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "stock-price",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "if-else",
            config: {},
            enabled: true,
          }, // First condition
          {
            id: "n3",
            pluginId: "http-request",
            config: {},
            enabled: true,
          }, // True branch
          {
            id: "n4",
            pluginId: "if-else",
            config: {},
            enabled: true,
          }, // Second condition
          {
            id: "n5",
            pluginId: "http-request",
            config: {},
            enabled: true,
          }, // Nested true
          {
            id: "n6",
            pluginId: "email",
            config: {},
            enabled: true,
          }, // Nested false
          {
            id: "n7",
            pluginId: "email",
            config: {},
            enabled: true,
          }, // First false
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
          {
            id: "c2",
            sourceNodeId: "n2",
            targetNodeId: "n3",
            condition: { type: "branch", value: "true" },
          },
          {
            id: "c3",
            sourceNodeId: "n2",
            targetNodeId: "n7",
            condition: { type: "branch", value: "false" },
          },
          { id: "c4", sourceNodeId: "n3", targetNodeId: "n4" },
          {
            id: "c5",
            sourceNodeId: "n4",
            targetNodeId: "n5",
            condition: { type: "branch", value: "true" },
          },
          {
            id: "c6",
            sourceNodeId: "n4",
            targetNodeId: "n6",
            condition: { type: "branch", value: "false" },
          },
        ],
      };

      const state = await simulateExecution(routine);

      // Path: n1 → n2 (true, 1st if-else) → n3 → n4 (false, 2nd if-else) → n6
      expect(state.executionPath).toContain("n1");
      expect(state.executionPath).toContain("n2");
      expect(state.executionPath).toContain("n3");
      expect(state.executionPath).toContain("n4");
      expect(state.executionPath).toContain("n6"); // 2nd if-else returns false

      // n7 (first false branch) should not execute
      expect(state.executionPath).not.toContain("n7");

      // n5 should not execute (2nd if-else returned false)
      expect(state.executionPath).not.toContain("n5");
    });
  });

  describe("Multiple Outputs from Branches", () => {
    it("should handle each branch having its own output node", async () => {
      const routine: RoutineInput = {
        routineId: "r6",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "stock-price",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "if-else",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "ai-transform",
            config: {},
            enabled: true,
          }, // True
          {
            id: "n4",
            pluginId: "ai-transform",
            config: {},
            enabled: true,
          }, // False
          {
            id: "n5",
            pluginId: "email",
            config: {},
            enabled: true,
          }, // True output
          {
            id: "n6",
            pluginId: "http-request",
            config: {},
            enabled: true,
          }, // False output
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
          {
            id: "c2",
            sourceNodeId: "n2",
            targetNodeId: "n3",
            condition: { type: "branch", value: "true" },
          },
          {
            id: "c3",
            sourceNodeId: "n2",
            targetNodeId: "n4",
            condition: { type: "branch", value: "false" },
          },
          { id: "c4", sourceNodeId: "n3", targetNodeId: "n5" },
          { id: "c5", sourceNodeId: "n4", targetNodeId: "n6" },
        ],
      };

      const state = await simulateExecution(routine);

      // Should execute: n1 → n2 (true) → n3 → n5
      expect(state.executed.size).toBe(4); // n1, n2, n3 (true branch), n5

      // Verify true branch path executed
      expect(state.executionPath).toContain("n1");
      expect(state.executionPath).toContain("n2");
      expect(state.executionPath).toContain("n3");
      expect(state.executionPath).toContain("n5");

      // False branch should not execute
      expect(state.executionPath).not.toContain("n4");
      expect(state.executionPath).not.toContain("n6");

      // Verify execution order
      const n5Index = state.executionPath.indexOf("n5");
      const n3Index = state.executionPath.indexOf("n3");
      expect(n5Index).toBeGreaterThan(n3Index);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle missing plugin outputs gracefully", async () => {
      const routine: RoutineInput = {
        routineId: "r7",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "stock-price",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "ai-transform",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          {
            id: "c1",
            sourceNodeId: "n1",
            targetNodeId: "n2",
            sourceHandle: "nonexistent",
          },
        ],
      };

      await expect(simulateExecution(routine)).rejects.toThrow();
    });

    it("should treat nodes without branch output as non-conditional", async () => {
      const routine: RoutineInput = {
        routineId: "r8",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "data-source",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "email",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "http-request",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          {
            id: "c1",
            sourceNodeId: "n1",
            targetNodeId: "n2",
          },
          {
            id: "c2",
            sourceNodeId: "n1",
            targetNodeId: "n3",
          },
        ],
      };

      // Node output without branch field - should follow all edges
      const graph = buildExecutionGraph(routine);
      const state = new ExecutionState();

      state.nodeOutputs.set("n1", { result: true }); // No 'branch' field
      state.executed.add("n1");

      const { nextNodes } = determineNextNodes(
        "n1",
        state.nodeOutputs.get("n1"),
        graph.nodes,
        graph.edges,
      );

      // Should follow all outgoing edges (non-conditional behavior)
      expect(nextNodes).toContain("n2");
      expect(nextNodes).toContain("n3");
    });
  });
});
