/**
 * Unit tests for GraphIterator
 */

import { describe, it, expect } from "vitest";
import type { RoutineInput, Node } from "@kianax/shared/temporal";
import { buildExecutionGraph, GraphIterator } from "./graph-executor";

describe("GraphIterator", () => {
  // Helper to create a simple node
  const createNode = (id: string, pluginId: string = "test"): Node => ({
    id,
    pluginId,
    config: {},
    enabled: true,
  });

  describe("Linear Flow", () => {
    it("should execute a linear sequence A -> B -> C", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [createNode("A"), createNode("B"), createNode("C")],
        connections: [
          // Standard FLOW connections
          {
            id: "c1",
            sourceNodeId: "A",
            targetNodeId: "B",
            type: "flow",
            sourceHandle: "default",
          },
          {
            id: "c2",
            sourceNodeId: "B",
            targetNodeId: "C",
            type: "flow",
            sourceHandle: "default",
          },
          // Data connections - Use sourceHandle and targetHandle
          {
            id: "d1",
            sourceNodeId: "A",
            targetNodeId: "B",
            type: "data",
            sourceHandle: "output",
            targetHandle: "input",
          },
        ],
      };

      const graph = buildExecutionGraph(routine);
      const iterator = new GraphIterator(graph);

      // Initial state: A should be ready
      let batch = iterator.nextBatch();
      expect(batch).toHaveLength(1);
      expect(batch[0]!.nodeId).toBe("A");

      // Complete A
      iterator.markNodeCompleted(batch[0]!, { output: "A_done" });

      // B should be ready
      batch = iterator.nextBatch();
      expect(batch).toHaveLength(1);
      expect(batch[0]!.nodeId).toBe("B");

      // Verify input gathering (Should find "A_done" from data connection using sourceHandle "output")
      const inputsB = iterator.gatherInputs(batch[0]!);
      expect(inputsB).toEqual({ input: "A_done" });

      // Complete B
      iterator.markNodeCompleted(batch[0]!, { output: "B_done" });

      // C should be ready
      batch = iterator.nextBatch();
      expect(batch).toHaveLength(1);
      expect(batch[0]!.nodeId).toBe("C");

      // Complete C
      iterator.markNodeCompleted(batch[0]!, { output: "C_done" });

      // Done
      expect(iterator.isDone()).toBe(true);
    });

    it("should correctly map data inputs using sourceHandle and targetHandle", () => {
      const routine: RoutineInput = {
        routineId: "r2",
        userId: "u1",
        nodes: [createNode("Source"), createNode("Target")],
        connections: [
          {
            id: "f1",
            sourceNodeId: "Source",
            targetNodeId: "Target",
            type: "flow",
            sourceHandle: "default",
          },
          {
            id: "d1",
            sourceNodeId: "Source",
            targetNodeId: "Target",
            type: "data",
            sourceHandle: "key1", // Was sourceDataPort
            targetHandle: "inputKey",
          },
        ],
      };

      const graph = buildExecutionGraph(routine);
      const iterator = new GraphIterator(graph);

      let batch = iterator.nextBatch();
      expect(batch).toHaveLength(1);
      expect(batch[0]!.nodeId).toBe("Source");

      iterator.markNodeCompleted(batch[0]!, {
        data: { key1: "value1", key2: "value2" },
      }); // Standard PluginResult

      batch = iterator.nextBatch();
      expect(batch).toHaveLength(1);
      expect(batch[0]!.nodeId).toBe("Target");

      const inputsTarget = iterator.gatherInputs(batch[0]!);
      expect(inputsTarget).toEqual({ inputKey: "value1" });

      expect(iterator.isDone()).toBe(false);
      iterator.markNodeCompleted(batch[0]!, {});
      expect(iterator.isDone()).toBe(true);
    });

    it("should correctly map data inputs using sourceHandle for legacy output format", () => {
      const routine: RoutineInput = {
        routineId: "r3",
        userId: "u1",
        nodes: [createNode("Source"), createNode("Target")],
        connections: [
          {
            id: "f1",
            sourceNodeId: "Source",
            targetNodeId: "Target",
            type: "flow",
            sourceHandle: "default",
          },
          {
            id: "d1",
            sourceNodeId: "Source",
            targetNodeId: "Target",
            type: "data",
            sourceHandle: "key1", // Was sourceDataPort
            targetHandle: "inputKey",
          },
        ],
      };

      const graph = buildExecutionGraph(routine);
      const iterator = new GraphIterator(graph);

      let batch = iterator.nextBatch();
      expect(batch[0]!.nodeId).toBe("Source");

      // Legacy output format (no signal/data wrapper)
      iterator.markNodeCompleted(batch[0]!, {
        key1: "legacy_value1",
        key2: "legacy_value2",
      });

      batch = iterator.nextBatch();
      expect(batch[0]!.nodeId).toBe("Target");

      const inputsTarget = iterator.gatherInputs(batch[0]!);
      expect(inputsTarget).toEqual({ inputKey: "legacy_value1" });

      iterator.markNodeCompleted(batch[0]!, {});
      expect(iterator.isDone()).toBe(true);
    });
  });

  describe("Explicit Branching Logic", () => {
    it("should follow correct branch using standardized signals", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          createNode("Start"),
          createNode("TruePath"),
          createNode("FalsePath"),
        ],
        connections: [
          // New Style: Explicit 'sourceHandle' matching signal
          {
            id: "c1",
            sourceNodeId: "Start",
            targetNodeId: "TruePath",
            type: "flow",
            sourceHandle: "true",
          },
          {
            id: "c2",
            sourceNodeId: "Start",
            targetNodeId: "FalsePath",
            type: "flow",
            sourceHandle: "false",
          },
        ],
      };

      const iterator = new GraphIterator(buildExecutionGraph(routine));

      const start = iterator.nextBatch()[0]!;

      // Output standardized result: { signal: "true", data: {} }
      iterator.markNodeCompleted(start, { signal: "true", data: {} });

      const next = iterator.nextBatch();
      expect(next).toHaveLength(1);
      expect(next[0]!.nodeId).toBe("TruePath");

      // Ensure FalsePath is NOT queued
      expect(iterator.isDone()).toBe(false);
      iterator.markNodeCompleted(next[0]!, {});
      expect(iterator.isDone()).toBe(true);
    });
  });

  describe("Loops", () => {
    it("should loop correctly with loopConfig", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [createNode("Start"), createNode("Action")],
        connections: [
          {
            id: "c1",
            sourceNodeId: "Start",
            targetNodeId: "Action",
            type: "flow",
            sourceHandle: "default",
          },
          {
            id: "loop",
            sourceNodeId: "Action",
            targetNodeId: "Start",
            type: "flow",
            sourceHandle: "default",
            loopConfig: { maxIterations: 3 },
          },
        ],
      };

      const iterator = new GraphIterator(buildExecutionGraph(routine));

      // Iteration 0: Start -> Action
      let batch = iterator.nextBatch();
      expect(batch[0]!.nodeId).toBe("Start");
      iterator.markNodeCompleted(batch[0]!, {});

      batch = iterator.nextBatch();
      expect(batch[0]!.nodeId).toBe("Action");
      iterator.markNodeCompleted(batch[0]!, {});

      // Loop triggers here. Should queue Start again (Iteration 1).

      batch = iterator.nextBatch();
      expect(batch).toHaveLength(1);
      expect(batch[0]!.nodeId).toBe("Start");
      expect(batch[0]!.context.loopStack[0]!.iteration).toBe(1);

      iterator.markNodeCompleted(batch[0]!, {});

      batch = iterator.nextBatch();
      expect(batch[0]!.nodeId).toBe("Action");
      iterator.markNodeCompleted(batch[0]!, {});

      // Iteration 2
      batch = iterator.nextBatch();
      expect(batch[0]!.context.loopStack[0]!.iteration).toBe(2);
      iterator.markNodeCompleted(batch[0]!, {});

      batch = iterator.nextBatch();
      iterator.markNodeCompleted(batch[0]!, {});

      // Iteration 3 (Max reached)

      batch = iterator.nextBatch();
      expect(batch).toHaveLength(0);
      expect(iterator.isDone()).toBe(true);
    });
  });

  describe("Parallel Execution", () => {
    it("should return parallel nodes in same batch", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          createNode("A"),
          createNode("B1"),
          createNode("B2"),
          createNode("C"),
        ],
        connections: [
          {
            id: "c1",
            sourceNodeId: "A",
            targetNodeId: "B1",
            type: "flow",
            sourceHandle: "default",
          },
          {
            id: "c2",
            sourceNodeId: "A",
            targetNodeId: "B2",
            type: "flow",
            sourceHandle: "default",
          },
          {
            id: "c3",
            sourceNodeId: "B1",
            targetNodeId: "C",
            type: "flow",
            sourceHandle: "default",
          },
          {
            id: "c4",
            sourceNodeId: "B2",
            targetNodeId: "C",
            type: "flow",
            sourceHandle: "default",
          },
        ],
      };

      const iterator = new GraphIterator(buildExecutionGraph(routine));

      // A
      let batch = iterator.nextBatch();
      iterator.markNodeCompleted(batch[0]!, {});

      // B1, B2 should both be ready
      batch = iterator.nextBatch();
      expect(batch).toHaveLength(2);
      const ids = batch.map((t) => t.nodeId).sort();
      expect(ids).toEqual(["B1", "B2"]);

      // Complete B1 only
      iterator.markNodeCompleted(batch.find((t) => t.nodeId === "B1")!, {});

      // C should NOT be ready yet (waiting for B2)
      let next = iterator.nextBatch();
      expect(next).toHaveLength(0);

      // Complete B2
      iterator.markNodeCompleted(batch.find((t) => t.nodeId === "B2")!, {});

      // C should be ready
      next = iterator.nextBatch();
      expect(next).toHaveLength(1);
      expect(next[0]!.nodeId).toBe("C");
    });
  });
});
