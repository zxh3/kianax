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
            type: "input",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "p2",
            type: "output",
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
            type: "input",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            type: "processor",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            type: "output",
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
            type: "input",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            type: "input",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            type: "processor",
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
            type: "input",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            type: "input",
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
            type: "input",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            type: "processor",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            type: "output",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [
        { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
        { id: "c2", sourceNodeId: "n1", targetNodeId: "n3" },
      ];

      const nextNodes = determineNextNodes(
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
            type: "logic",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            type: "output",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            type: "output",
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
      const nextNodes = determineNextNodes("n1", output, nodes, edges);

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
            type: "logic",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            type: "output",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            type: "output",
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
      const nextNodes = determineNextNodes("n1", output, nodes, edges);

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
            type: "logic",
            config: {},
            enabled: true,
          },
        ],
        [
          "n2",
          {
            id: "n2",
            pluginId: "p2",
            type: "output",
            config: {},
            enabled: true,
          },
        ],
        [
          "n3",
          {
            id: "n3",
            pluginId: "p3",
            type: "output",
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
          // No condition - default edge
        },
      ];

      const output: LogicNodeOutput = { branch: "true", result: true };
      const nextNodes = determineNextNodes("n1", output, nodes, edges);

      expect(nextNodes).toContain("n2"); // True branch
      expect(nextNodes).toContain("n3"); // Default edge
      expect(nextNodes).toHaveLength(2);
    });

    it("should throw error when logic node output is missing branch", () => {
      const nodes = new Map<string, Node>([
        [
          "n1",
          {
            id: "n1",
            pluginId: "if-else",
            type: "logic",
            config: {},
            enabled: true,
          },
        ],
      ]);

      const edges: Connection[] = [];

      expect(() => {
        determineNextNodes("n1", { result: true }, nodes, edges);
      }).toThrow("did not return a valid branch value");
    });

    it("should throw error when node not found", () => {
      const nodes = new Map<string, Node>();
      const edges: Connection[] = [];

      expect(() => {
        determineNextNodes("nonexistent", {}, nodes, edges);
      }).toThrow("Node not found: nonexistent");
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

    it("should wrap primitive values in data field when no target handle", () => {
      const edges: Connection[] = [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "n2",
        },
      ];

      state.nodeOutputs.set("n1", "primitive value");

      const inputs = gatherNodeInputs("n2", edges, state);

      expect(inputs).toEqual({ data: "primitive value" });
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
            type: "input",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "p2",
            type: "processor",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "p3",
            type: "output",
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
            type: "input",
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
            type: "input",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "p2",
            type: "processor",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "p3",
            type: "output",
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
            type: "input",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "p2",
            type: "processor",
            config: {},
            enabled: true,
          },
          {
            id: "n3",
            pluginId: "p3",
            type: "output",
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

    it("should warn about logic nodes without conditional edges", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "if-else",
            type: "logic",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "p2",
            type: "output",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
          // No conditional edges!
        ],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((e) => e.includes("no conditional edges")),
      ).toBe(true);
    });

    it("should warn about logic nodes with no outgoing connections", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "input",
            type: "input",
            config: {},
            enabled: true,
          },
          {
            id: "n2",
            pluginId: "if-else",
            type: "logic",
            config: {},
            enabled: true,
          },
        ],
        connections: [
          { id: "c1", sourceNodeId: "n1", targetNodeId: "n2" },
          // n2 has no outgoing connections!
        ],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(false);
      expect(
        validation.errors.some((e) => e.includes("no outgoing connections")),
      ).toBe(true);
    });

    it("should allow single node routines", () => {
      const routine: RoutineInput = {
        routineId: "r1",
        userId: "u1",
        nodes: [
          {
            id: "n1",
            pluginId: "p1",
            type: "input",
            config: {},
            enabled: true,
          },
        ],
        connections: [],
      };

      const validation = validateGraph(routine);

      expect(validation.valid).toBe(true);
    });
  });
});
