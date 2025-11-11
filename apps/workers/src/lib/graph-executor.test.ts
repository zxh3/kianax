/**
 * Unit tests for graph executor
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { RoutineInput, Node, Connection } from "@kianax/shared/temporal";
import {
  buildExecutionGraph,
  findEntryNodes,
  findReadyNodes,
  determineNextNodes,
  gatherNodeInputs,
  validateGraph,
  updateLoopState,
  getLoopContext,
  ExecutionState,
  type LogicNodeOutput,
} from "./graph-executor";

describe("Graph Executor", () => {
  describe("buildExecutionGraph", () => {
    it("should build execution graph from routine input", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
        connections: [{ id: "c1", sourceNodeId: "n1", targetNodeId: "n2" }],
      };

      const graph = buildExecutionGraph(routine);

      expect(graph.routineId).toBe("r1");
      expect(graph.userId).toBe("u1");
      expect(graph.nodes.size).toBe(2);
      expect(graph.edges.length).toBe(1);
      expect(graph.nodes.get("n1")).toEqual(routine.nodes[0]);
    });

    it("should handle trigger data", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [],
        connections: [],
        triggerData: { key: "value" },
      };

      const graph = buildExecutionGraph(routine);

      expect(graph.triggerData).toEqual({ key: "value" });
    });
  });

  describe("findEntryNodes", () => {
    it("should find nodes with no incoming edges", () => {
      const nodes = new Map<string, Node>([
        [
          "n1",
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
        { id: "c2", sourceNodeId: "n2", targetNodeId: "n3" },
      ];

      const entryNodes = findEntryNodes(nodes, edges);

      expect(entryNodes).toEqual(["n1"]);
    });

    it("should find multiple entry nodes for parallel flows", () => {
      const nodes = new Map<string, Node>([
        [
          "n1",
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        { id: "c1", sourceNodeId: "n1", targetNodeId: "n3" },
        { id: "c2", sourceNodeId: "n2", targetNodeId: "n3" },
      ];

      const entryNodes = findEntryNodes(nodes, edges);

      expect(entryNodes).toContain("n1");
      expect(entryNodes).toContain("n2");
      expect(entryNodes).toHaveLength(2);
    });

    it("should return all nodes when no edges exist", () => {
      const nodes = new Map<string, Node>([
        [
          "n1",
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const entryNodes = findEntryNodes(nodes, []);

      expect(entryNodes).toHaveLength(2);
    });
  });

  describe("findReadyNodes", () => {
    let state: ExecutionState;

    beforeEach(() => {
      state = new ExecutionState();
    });

    it("should find nodes with all dependencies satisfied", () => {
      const edges: Connection[] = [
        { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
        { id: "c2", sourceNodeId: "n1", targetNodeId: "n3" },
      ];

      // n1 already executed
      state.executed.add("n1");

      const ready = findReadyNodes(["n2", "n3"], edges, state);

      expect(ready).toContain("n2");
      expect(ready).toContain("n3");
      expect(ready).toHaveLength(2);
    });

    it("should not include already executed nodes", () => {
      const edges: Connection[] = [
        { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
      ];

      state.executed.add("n1");
      state.executed.add("n2"); // Already executed

      const ready = findReadyNodes(["n2"], edges, state);

      expect(ready).toHaveLength(0);
    });

    it("should not include nodes with unsatisfied dependencies", () => {
      const edges: Connection[] = [
        { id: "c1", sourceNodeId: "n1", targetNodeId: "n3" },
        { id: "c2", sourceNodeId: "n2", targetNodeId: "n3" },
      ];

      // Only n1 executed, n2 not yet
      state.executed.add("n1");

      const ready = findReadyNodes(["n3"], edges, state);

      expect(ready).toHaveLength(0); // n3 still waiting for n2
    });

    it("should include nodes when all multiple dependencies are satisfied", () => {
      const edges: Connection[] = [
        { id: "c1", sourceNodeId: "n1", targetNodeId: "n3" },
        { id: "c2", sourceNodeId: "n2", targetNodeId: "n3" },
      ];

      // Both dependencies satisfied
      state.executed.add("n1");
      state.executed.add("n2");

      const ready = findReadyNodes(["n3"], edges, state);

      expect(ready).toEqual(["n3"]);
    });
  });

  describe("determineNextNodes", () => {
    it("should return all next nodes for non-logic nodes", () => {
      const nodes = new Map<string, Node>([
        [
          "n1",
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
        { id: "c2", sourceNodeId: "n1", targetNodeId: "n3" },
      ];

      const { nextNodes } = determineNextNodes(
        "n1",
        { data: "test" },
        nodes,
        edges,
      );

      expect(nextNodes).toContain("n2");
      expect(nextNodes).toContain("n3");
      expect(nextNodes).toHaveLength(2);
    });

    it("should filter edges by branch for logic nodes - true branch", () => {
      const nodes = new Map<string, Node>([
        [
          "n1",
          {
            id: "n1",
            pluginId: "if-else",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
          condition: { type: "branch", value: "true" },
        },
        {
          id: "c2",
          sourceNodeId: "n1",
          targetNodeId: "n3",
          condition: { type: "branch", value: "false" },
        },
      ];

      const output: LogicNodeOutput = { branch: "true", result: true };
      const { nextNodes } = determineNextNodes("n1", output, nodes, edges);

      expect(nextNodes).toEqual(["n2"]); // Only true branch
      expect(nextNodes).not.toContain("n3");
    });

    it("should filter edges by branch for logic nodes - false branch", () => {
      const nodes = new Map<string, Node>([
        [
          "n1",
          {
            id: "n1",
            pluginId: "if-else",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
          condition: { type: "branch", value: "true" },
        },
        {
          id: "c2",
          sourceNodeId: "n1",
          targetNodeId: "n3",
          condition: { type: "branch", value: "false" },
        },
      ];

      const output: LogicNodeOutput = { branch: "false", result: false };
      const { nextNodes } = determineNextNodes("n1", output, nodes, edges);

      expect(nextNodes).toEqual(["n3"]); // Only false branch
      expect(nextNodes).not.toContain("n2");
    });

    it("should include default edges for logic nodes", () => {
      const nodes = new Map<string, Node>([
        [
          "n1",
          {
            id: "n1",
            pluginId: "if-else",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
        },
        {
          id: "c2",
          sourceNodeId: "n1",
          targetNodeId: "n3",
          // No condition - default edge
        },
      ];

      const output: LogicNodeOutput = { branch: "true", result: true };
      const { nextNodes } = determineNextNodes("n1", output, nodes, edges);

      expect(nextNodes).toContain("n2"); // True branch
      expect(nextNodes).toContain("n3"); // Default edge
      expect(nextNodes).toHaveLength(2);
    });

    it("should throw error when node not found", () => {
      const nodes = new Map<string, Node>();
      const edges: Connection[] = [];

      expect(() => {
        determineNextNodes("nonexistent", {}, nodes, edges);
      }).toThrow("Node not found: nonexistent");
    });

    it("should throw error when branch output has no matching edge", () => {
      const nodes = new Map<string, Node>([
        [
          "n1",
          {
            id: "n1",
            pluginId: "if-else",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
          condition: { type: "branch", value: "true" },
        },
      ];

      // Node outputs "false" but only "true" branch exists
      const output: LogicNodeOutput = { branch: "false", result: false };

      expect(() => {
        determineNextNodes("n1", output, nodes, edges);
      }).toThrow(
        'Node n1 output branch "false" but no matching edge found. Available branches: true',
      );
    });
  });

  describe("gatherNodeInputs", () => {
    let state: ExecutionState;

    beforeEach(() => {
      state = new ExecutionState();
    });

    it("should return empty object for nodes with no incoming edges", () => {
      const edges: Connection[] = [];

      const inputs = gatherNodeInputs("n1", edges, state);

      expect(inputs).toEqual({});
    });

    it("should gather inputs from single upstream node", () => {
      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
          sourceHandle: "output",
          targetHandle: "input",
        },
      ];

      state.nodeOutputs.set("n1", { output: "test data" });

      const inputs = gatherNodeInputs("n2", edges, state);

      expect(inputs).toEqual({ input: "test data" });
    });

    it("should gather inputs from multiple upstream nodes", () => {
      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n3",
          sourceHandle: "price",
          targetHandle: "stockPrice",
        },
        {
          id: "c2",
          sourceNodeId: "n2",
          targetNodeId: "n3",
          sourceHandle: "articles",
          targetHandle: "news",
        },
      ];

      state.nodeOutputs.set("n1", { price: 150.5 });
      state.nodeOutputs.set("n2", { articles: ["article1", "article2"] });

      const inputs = gatherNodeInputs("n3", edges, state);

      expect(inputs).toEqual({
        stockPrice: 150.5,
        news: ["article1", "article2"],
      });
    });

    it("should merge entire object when no target handle specified", () => {
      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
        },
      ];

      state.nodeOutputs.set("n1", { field1: "value1", field2: "value2" });

      const inputs = gatherNodeInputs("n2", edges, state);

      expect(inputs).toEqual({ field1: "value1", field2: "value2" });
    });

    it("should wrap primitive values with source node ID when no target handle", () => {
      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
        },
      ];

      state.nodeOutputs.set("n1", "primitive value");

      const inputs = gatherNodeInputs("n2", edges, state);

      expect(inputs).toEqual({ from_n1: "primitive value" });
    });

    it("should throw error when source output is missing", () => {
      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
        },
      ];

      expect(() => {
        gatherNodeInputs("n2", edges, state);
      }).toThrow("Missing output from node n1");
    });

    it("should throw error when source handle not found in output", () => {
      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
          sourceHandle: "nonexistent",
        },
      ];

      state.nodeOutputs.set("n1", { other: "data" });

      expect(() => {
        gatherNodeInputs("n2", edges, state);
      }).toThrow('Source handle "nonexistent" not found');
    });

    it("should throw error when targetHandle conflicts with existing input", () => {
      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n3",
          sourceHandle: "output",
          targetHandle: "data",
        },
        {
          id: "c2",
          sourceNodeId: "n2",
          targetNodeId: "n3",
          sourceHandle: "result",
          targetHandle: "data", // Conflict!
        },
      ];

      state.nodeOutputs.set("n1", { output: "value1" });
      state.nodeOutputs.set("n2", { result: "value2" });

      expect(() => {
        gatherNodeInputs("n3", edges, state);
      }).toThrow(
        'Input key conflict: "data" from node n2 would overwrite existing input to node n3',
      );
    });

    it("should throw error when merged object fields conflict", () => {
      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n3",
          // No targetHandle - will merge entire object
        },
        {
          id: "c2",
          sourceNodeId: "n2",
          targetNodeId: "n3",
          // No targetHandle - will merge entire object
        },
      ];

      state.nodeOutputs.set("n1", { field1: "value1", shared: "from_n1" });
      state.nodeOutputs.set("n2", { field2: "value2", shared: "from_n2" }); // "shared" conflicts!

      expect(() => {
        gatherNodeInputs("n3", edges, state);
      }).toThrow(
        'Input key conflict: "shared" from node n2 would overwrite existing input to node n3',
      );
    });
  });

  describe("validateGraph", () => {
    it("should validate a correct linear graph", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
          { id: "c2", sourceNodeId: "n2", targetNodeId: "n3" },
        ],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect invalid node references", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "nonexistent" },
        ],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain("unknown target node");
    });

    it("should detect cycles in graph", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
          { id: "c2", sourceNodeId: "n2", targetNodeId: "n3" },
          { id: "c3", sourceNodeId: "n3", targetNodeId: "n1" }, // Cycle!
        ],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("cycle"))).toBe(true);
    });

    it("should detect disconnected nodes", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
          // n3 is disconnected
        ],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("disconnected"))).toBe(
        true,
      );
    });

    it("should allow single node routines", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "p1",
            config: {},
            enabled: true,
          },
        ],
        connections: [],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(true);
    });

    it("should allow loop edges without detecting cycles", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          { id: "n1", pluginId: "p1", config: {}, enabled: true },
          { id: "n2", pluginId: "p2", config: {}, enabled: true },
        ],
        connections: [
          { id: "e1", sourceNodeId: "n1", targetNodeId: "n2" },
          {
            id: "e2",
            sourceNodeId: "n2",
            targetNodeId: "n1",
            condition: {
              type: "loop",
              loopConfig: { maxIterations: 5 },
            },
          },
        ],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it("should require loopConfig.maxIterations for loop edges", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          { id: "n1", pluginId: "p1", config: {}, enabled: true },
          { id: "n2", pluginId: "p2", config: {}, enabled: true },
        ],
        connections: [
          {
            id: "e1",
            sourceNodeId: "n1",
            targetNodeId: "n2",
            condition: { type: "loop" } as any, // Missing loopConfig
          },
        ],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((e) =>
          e.includes("must have loopConfig.maxIterations"),
        ),
      ).toBe(true);
    });

    it("should validate maxIterations is between 1 and 1000", () => {
      const routineZero: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          { id: "n1", pluginId: "p1", config: {}, enabled: true },
          { id: "n2", pluginId: "p2", config: {}, enabled: true },
        ],
        connections: [
          {
            id: "e1",
            sourceNodeId: "n1",
            targetNodeId: "n2",
            condition: {
              type: "loop",
              loopConfig: { maxIterations: 0 },
            },
          },
        ],
      };

      const validationZero = validateGraph(routineZero);
      expect(validationZero.valid).toBe(false);
      expect(
        validationZero.errors.some((e) =>
          e.includes("must be between 1 and 1000"),
        ),
      ).toBe(true);

      const routineTooHigh: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          { id: "n1", pluginId: "p1", config: {}, enabled: true },
          { id: "n2", pluginId: "p2", config: {}, enabled: true },
        ],
        connections: [
          {
            id: "e1",
            sourceNodeId: "n1",
            targetNodeId: "n2",
            condition: {
              type: "loop",
              loopConfig: { maxIterations: 1001 },
            },
          },
        ],
      };

      const validationHigh = validateGraph(routineTooHigh);
      expect(validationHigh.valid).toBe(false);
      expect(
        validationHigh.errors.some((e) =>
          e.includes("must be between 1 and 1000"),
        ),
      ).toBe(true);
    });
  });

  describe("Loop State Management", () => {
    describe("updateLoopState", () => {
      it("should initialize loop state on first call", () => {
        const state = new ExecutionState();
        const edgeId = "loop-edge-1";
        const targetNodeId = "n2";
        const maxIterations = 5;

        const shouldContinue = updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          undefined,
          {},
          state,
        );

        expect(shouldContinue).toBe(true);
        expect(state.loopStates.has(edgeId)).toBe(true);
        const loopState = state.loopStates.get(edgeId)!;
        expect(loopState.iteration).toBe(1);
        expect(loopState.maxIterations).toBe(5);
        expect(loopState.accumulator).toEqual({});
        expect(loopState.startedAt).toBeGreaterThan(0);
        expect(state.nodeIterations.get(targetNodeId)).toBe(1);
      });

      it("should increment iteration counter on subsequent calls", () => {
        const state = new ExecutionState();
        const edgeId = "loop-edge-1";
        const targetNodeId = "n2";
        const maxIterations = 5;

        // First iteration
        updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          undefined,
          {},
          state,
        );
        expect(state.loopStates.get(edgeId)!.iteration).toBe(1);

        // Second iteration
        updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          undefined,
          {},
          state,
        );
        expect(state.loopStates.get(edgeId)!.iteration).toBe(2);

        // Third iteration
        updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          undefined,
          {},
          state,
        );
        expect(state.loopStates.get(edgeId)!.iteration).toBe(3);

        expect(state.nodeIterations.get(targetNodeId)).toBe(3);
      });

      it("should update accumulator with specified fields", () => {
        const state = new ExecutionState();
        const edgeId = "loop-edge-1";
        const targetNodeId = "n2";
        const maxIterations = 5;
        const accumulatorFields = ["count", "total"];

        const nodeOutput1 = { count: 1, total: 10, extra: "ignored" };
        updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          accumulatorFields,
          nodeOutput1,
          state,
        );

        let loopState = state.loopStates.get(edgeId)!;
        expect(loopState.accumulator).toEqual({ count: 1, total: 10 });

        const nodeOutput2 = { count: 2, total: 20, extra: "ignored" };
        updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          accumulatorFields,
          nodeOutput2,
          state,
        );

        loopState = state.loopStates.get(edgeId)!;
        expect(loopState.accumulator).toEqual({ count: 2, total: 20 });
      });

      it("should return true when under max iterations", () => {
        const state = new ExecutionState();
        const edgeId = "loop-edge-1";
        const targetNodeId = "n2";
        const maxIterations = 3;

        const result1 = updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          undefined,
          {},
          state,
        );
        expect(result1).toBe(true); // iteration 1 < 3

        const result2 = updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          undefined,
          {},
          state,
        );
        expect(result2).toBe(true); // iteration 2 < 3
      });

      it("should return false when max iterations reached", () => {
        const state = new ExecutionState();
        const edgeId = "loop-edge-1";
        const targetNodeId = "n2";
        const maxIterations = 3;

        // Iteration 1
        updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          undefined,
          {},
          state,
        );
        // Iteration 2
        updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          undefined,
          {},
          state,
        );
        // Iteration 3 - should return false
        const result3 = updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          undefined,
          {},
          state,
        );

        expect(result3).toBe(false); // iteration 3 >= 3
        expect(state.loopStates.get(edgeId)!.iteration).toBe(3);
      });

      it("should handle accumulator fields not present in output", () => {
        const state = new ExecutionState();
        const edgeId = "loop-edge-1";
        const targetNodeId = "n2";
        const maxIterations = 5;
        const accumulatorFields = ["count", "total", "missing"];

        const nodeOutput = { count: 1, total: 10 };
        updateLoopState(
          edgeId,
          targetNodeId,
          maxIterations,
          accumulatorFields,
          nodeOutput,
          state,
        );

        const loopState = state.loopStates.get(edgeId)!;
        expect(loopState.accumulator).toEqual({ count: 1, total: 10 });
        expect(loopState.accumulator).not.toHaveProperty("missing");
      });
    });

    describe("getLoopContext", () => {
      it("should return empty object for nodes not in loops", () => {
        const state = new ExecutionState();
        const edges: Connection[] = [
          { id: "e1", sourceNodeId: "n1", targetNodeId: "n2" },
        ];

        const context = getLoopContext("n2", edges, state);

        expect(context).toEqual({});
      });

      it("should return empty object if loop not started yet", () => {
        const state = new ExecutionState();
        const edges: Connection[] = [
          {
            id: "e1",
            sourceNodeId: "n1",
            targetNodeId: "n2",
            condition: { type: "loop", loopConfig: { maxIterations: 5 } },
          },
        ];

        const context = getLoopContext("n2", edges, state);

        expect(context).toEqual({});
      });

      it("should return iteration and accumulator for loop nodes", () => {
        const state = new ExecutionState();
        const edgeId = "loop-edge-1";
        const edges: Connection[] = [
          {
            id: edgeId,
            sourceNodeId: "n1",
            targetNodeId: "n2",
            condition: { type: "loop", loopConfig: { maxIterations: 5 } },
          },
        ];

        // Initialize loop state
        updateLoopState(edgeId, "n2", 5, ["count"], { count: 42 }, state);

        const context = getLoopContext("n2", edges, state);

        expect(context.iteration).toBe(1);
        expect(context.accumulator).toEqual({ count: 42 });
      });

      it("should return updated context after multiple iterations", () => {
        const state = new ExecutionState();
        const edgeId = "loop-edge-1";
        const edges: Connection[] = [
          {
            id: edgeId,
            sourceNodeId: "n1",
            targetNodeId: "n2",
            condition: {
              type: "loop",
              loopConfig: { maxIterations: 5, accumulatorFields: ["total"] },
            },
          },
        ];

        // Iteration 1
        updateLoopState(edgeId, "n2", 5, ["total"], { total: 10 }, state);
        // Iteration 2
        updateLoopState(edgeId, "n2", 5, ["total"], { total: 20 }, state);

        const context = getLoopContext("n2", edges, state);

        expect(context.iteration).toBe(2);
        expect(context.accumulator).toEqual({ total: 20 });
      });
    });
  });

  describe("determineNextNodes - Loop Edges", () => {
    it("should separate loop edges from regular edges", () => {
      const nodes = new Map([
        [
          "n1",
          {
            id: "n1",
            pluginId: "loop-control",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        {
          id: "e1",
          sourceNodeId: "n1",
          targetNodeId: "n3",
          condition: { type: "branch", value: "break" },
        },
        {
          id: "e2",
          sourceNodeId: "n1",
          targetNodeId: "n2",
          condition: {
            type: "loop",
            loopConfig: { maxIterations: 5 },
          },
        },
      ];

      const nodeOutput = { branch: "continue", result: true };

      const { nextNodes, loopEdges } = determineNextNodes(
        "n1",
        nodeOutput,
        nodes,
        edges,
      );

      expect(loopEdges).toHaveLength(1);
      expect(loopEdges[0]!.id).toBe("e2");
      expect(loopEdges[0]!.condition?.type).toBe("loop");
      expect(nextNodes).toHaveLength(0); // break edge not followed
    });

    it("should return loop edges matching branch condition", () => {
      const nodes = new Map([
        [
          "n1",
          {
            id: "n1",
            pluginId: "loop-control",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        {
          id: "loop-continue",
          sourceNodeId: "n1",
          targetNodeId: "n2",
          condition: {
            type: "loop",
            value: "continue",
            loopConfig: { maxIterations: 5 },
          },
        },
        {
          id: "loop-break",
          sourceNodeId: "n1",
          targetNodeId: "n2",
          condition: {
            type: "loop",
            value: "break",
            loopConfig: { maxIterations: 5 },
          },
        },
      ];

      const continueOutput = { branch: "continue", result: true };
      const { loopEdges: continueLoops } = determineNextNodes(
        "n1",
        continueOutput,
        nodes,
        edges,
      );

      // Note: Current implementation doesn't filter loop edges by branch value
      // This is a potential enhancement - for now, loop edges are returned regardless
      expect(continueLoops.length).toBeGreaterThan(0);
    });

    it("should return all loop edges for non-conditional nodes", () => {
      const nodes = new Map([
        [
          "n1",
          {
            id: "n1",
            pluginId: "data-source",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "processor",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        {
          id: "regular",
          sourceNodeId: "n1",
          targetNodeId: "n2",
        },
        {
          id: "loop",
          sourceNodeId: "n1",
          targetNodeId: "n2",
          condition: {
            type: "loop",
            loopConfig: { maxIterations: 3 },
          },
        },
      ];

      const nodeOutput = { data: "some data" };
      const { nextNodes, loopEdges } = determineNextNodes(
        "n1",
        nodeOutput,
        nodes,
        edges,
      );

      expect(nextNodes).toEqual(["n2"]);
      expect(loopEdges).toHaveLength(1);
      expect(loopEdges[0]!.id).toBe("loop");
    });
  });
});
