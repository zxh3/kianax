import { describe, it, expect, beforeEach } from "vitest";
import { ExecutionState } from "./execution-state.js";
import type { NodeExecutionResult } from "../types/execution.js";

describe("ExecutionState", () => {
  let state: ExecutionState;

  beforeEach(() => {
    state = new ExecutionState();
  });

  describe("addNodeResult", () => {
    it("should add a node result and track execution path", () => {
      const result: NodeExecutionResult = {
        outputs: [
          {
            portName: "output",
            items: [{ data: { value: 1 }, metadata: {} }],
          },
        ],
        executionTime: 100,
        status: "success",
      };

      state.addNodeResult("node1", result);

      expect(state.getNodeResult("node1")).toBe(result);
      expect(state.executionPath).toEqual([{ nodeId: "node1", runIndex: 0 }]);
    });

    it("should support multiple executions of the same node", () => {
      const result1: NodeExecutionResult = {
        outputs: [],
        executionTime: 50,
        status: "success",
      };
      const result2: NodeExecutionResult = {
        outputs: [],
        executionTime: 75,
        status: "success",
      };

      state.addNodeResult("node1", result1);
      state.addNodeResult("node1", result2);

      expect(state.getAllNodeResults("node1")).toHaveLength(2);
      expect(state.getNodeResult("node1")).toBe(result2); // Latest
      expect(state.executionPath).toEqual([
        { nodeId: "node1", runIndex: 0 },
        { nodeId: "node1", runIndex: 1 },
      ]);
    });

    it("should update nodeOutputs with latest outputs", () => {
      const result1: NodeExecutionResult = {
        outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
        executionTime: 50,
        status: "success",
      };
      const result2: NodeExecutionResult = {
        outputs: [{ portName: "out", items: [{ data: 2, metadata: {} }] }],
        executionTime: 75,
        status: "success",
      };

      state.addNodeResult("node1", result1);
      state.addNodeResult("node1", result2);

      expect(state.nodeOutputs.get("node1")).toBe(result2.outputs);
    });
  });

  describe("getRunIndex", () => {
    it("should return 0 for nodes that haven't executed", () => {
      expect(state.getRunIndex("nonexistent")).toBe(0);
    });

    it("should return the number of times a node has executed", () => {
      const result: NodeExecutionResult = {
        outputs: [],
        executionTime: 50,
        status: "success",
      };

      expect(state.getRunIndex("node1")).toBe(0);

      state.addNodeResult("node1", result);
      expect(state.getRunIndex("node1")).toBe(1);

      state.addNodeResult("node1", result);
      expect(state.getRunIndex("node1")).toBe(2);
    });
  });

  describe("hasExecuted", () => {
    it("should return false for nodes that haven't executed", () => {
      expect(state.hasExecuted("node1")).toBe(false);
    });

    it("should return true for nodes that have executed", () => {
      const result: NodeExecutionResult = {
        outputs: [],
        executionTime: 50,
        status: "success",
      };

      state.addNodeResult("node1", result);
      expect(state.hasExecuted("node1")).toBe(true);
    });
  });

  describe("getNodeState", () => {
    it("should return empty object for new nodes", () => {
      const nodeState = state.getNodeState("node1");
      expect(nodeState).toEqual({});
    });

    it("should return the same object reference for multiple calls", () => {
      const state1 = state.getNodeState("node1");
      const state2 = state.getNodeState("node1");
      expect(state1).toBe(state2);
    });

    it("should allow modifying node state", () => {
      const nodeState = state.getNodeState("node1");
      nodeState.counter = 5;
      nodeState.items = ["a", "b", "c"];

      const retrieved = state.getNodeState("node1");
      expect(retrieved.counter).toBe(5);
      expect(retrieved.items).toEqual(["a", "b", "c"]);
    });

    it("should maintain separate state for different nodes", () => {
      const state1 = state.getNodeState("node1");
      const state2 = state.getNodeState("node2");

      state1.value = "A";
      state2.value = "B";

      expect(state.getNodeState("node1").value).toBe("A");
      expect(state.getNodeState("node2").value).toBe("B");
    });
  });

  describe("setNodeState", () => {
    it("should set node state", () => {
      state.setNodeState("node1", { counter: 10, data: [1, 2, 3] });

      expect(state.getNodeState("node1")).toEqual({
        counter: 10,
        data: [1, 2, 3],
      });
    });

    it("should replace existing state", () => {
      state.setNodeState("node1", { a: 1 });
      state.setNodeState("node1", { b: 2 });

      expect(state.getNodeState("node1")).toEqual({ b: 2 });
    });
  });

  describe("hasErrors", () => {
    it("should return false when no errors", () => {
      const result: NodeExecutionResult = {
        outputs: [],
        executionTime: 50,
        status: "success",
      };

      state.addNodeResult("node1", result);
      expect(state.hasErrors()).toBe(false);
    });

    it("should return true when any node has error", () => {
      const success: NodeExecutionResult = {
        outputs: [],
        executionTime: 50,
        status: "success",
      };
      const error: NodeExecutionResult = {
        outputs: [],
        executionTime: 25,
        status: "error",
        error: { message: "Test error" },
      };

      state.addNodeResult("node1", success);
      state.addNodeResult("node2", error);

      expect(state.hasErrors()).toBe(true);
    });
  });

  describe("getErrors", () => {
    it("should return empty array when no errors", () => {
      const result: NodeExecutionResult = {
        outputs: [],
        executionTime: 50,
        status: "success",
      };

      state.addNodeResult("node1", result);
      expect(state.getErrors()).toEqual([]);
    });

    it("should return all errors with node IDs", () => {
      const error1: NodeExecutionResult = {
        outputs: [],
        executionTime: 25,
        status: "error",
        error: { message: "Error 1" },
      };
      const error2: NodeExecutionResult = {
        outputs: [],
        executionTime: 30,
        status: "error",
        error: { message: "Error 2", stack: "stack trace" },
      };

      state.addNodeResult("node1", error1);
      state.addNodeResult("node2", error2);

      const errors = state.getErrors();
      expect(errors).toHaveLength(2);
      expect(errors[0]).toEqual({
        nodeId: "node1",
        error: { message: "Error 1" },
      });
      expect(errors[1]).toEqual({
        nodeId: "node2",
        error: { message: "Error 2", stack: "stack trace" },
      });
    });

    it("should handle multiple runs with errors", () => {
      const success: NodeExecutionResult = {
        outputs: [],
        executionTime: 50,
        status: "success",
      };
      const error: NodeExecutionResult = {
        outputs: [],
        executionTime: 25,
        status: "error",
        error: { message: "Second run failed" },
      };

      state.addNodeResult("node1", success);
      state.addNodeResult("node1", error);

      const errors = state.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.nodeId).toBe("node1");
    });
  });

  describe("clear", () => {
    it("should clear all state", () => {
      const result: NodeExecutionResult = {
        outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
        executionTime: 50,
        status: "success",
      };

      state.addNodeResult("node1", result);
      state.setNodeState("node1", { counter: 5 });

      state.clear();

      expect(state.getRunIndex("node1")).toBe(0);
      expect(state.hasExecuted("node1")).toBe(false);
      expect(state.executionPath).toEqual([]);
      expect(state.nodeResults.size).toBe(0);
      expect(state.nodeOutputs.size).toBe(0);
      expect(state.nodeStates.size).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      const success: NodeExecutionResult = {
        outputs: [],
        executionTime: 50,
        status: "success",
      };
      const error: NodeExecutionResult = {
        outputs: [],
        executionTime: 25,
        status: "error",
        error: { message: "Error" },
      };

      // node1: 2 successful runs
      state.addNodeResult("node1", success);
      state.addNodeResult("node1", success);

      // node2: 1 successful run
      state.addNodeResult("node2", success);

      // node3: 1 failed run
      state.addNodeResult("node3", error);

      const stats = state.getStats();
      expect(stats.uniqueNodes).toBe(3);
      expect(stats.totalExecutions).toBe(4);
      expect(stats.failedNodes).toBe(1);
      expect(stats.successfulNodes).toBe(2);
    });

    it("should handle empty state", () => {
      const stats = state.getStats();
      expect(stats.uniqueNodes).toBe(0);
      expect(stats.totalExecutions).toBe(0);
      expect(stats.failedNodes).toBe(0);
      expect(stats.successfulNodes).toBe(0);
    });
  });
});
