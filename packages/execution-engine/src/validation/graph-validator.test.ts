import { describe, it, expect } from "vitest";
import { validateGraph } from "./graph-validator.js";
import type { RoutineDefinition, Node, Edge } from "../types/graph.js";
import { PortType } from "@kianax/plugin-sdk";

describe("validateGraph", () => {
  function createRoutine(
    nodes: Node[],
    connections: Edge[],
  ): RoutineDefinition {
    return {
      id: "test-routine",
      name: "Test Routine",
      nodes,
      connections,
    };
  }

  describe("entry nodes validation", () => {
    it("should pass for valid entry node", () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node2",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail when no entry nodes exist", () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node2",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e2",
            sourceNodeId: "node2",
            sourcePort: "out",
            targetNodeId: "node1",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: "no_entry_nodes",
        message: expect.stringContaining("no entry nodes"),
      });
    });

    it("should warn about multiple entry points", () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        ],
        [],
      );

      const result = validateGraph(routine);
      // Multiple disconnected nodes will be orphaned (invalid)
      expect(result.valid).toBe(false);
      expect(result.warnings).toContainEqual({
        type: "multiple_entry_points",
        message: expect.stringContaining("2 entry points"),
      });
    });
  });

  describe("orphaned nodes validation", () => {
    it("should fail when orphaned nodes exist", () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
          { id: "node3", pluginId: "test", label: "Orphan", parameters: {} },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node2",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: "orphaned_node",
        nodeId: "node3",
        message: expect.stringContaining("not connected"),
      });
    });

    it("should pass when all nodes are connected", () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node2",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(true);
    });
  });

  describe("connection validation", () => {
    it("should fail when connection references non-existent source node", () => {
      const routine = createRoutine(
        [{ id: "node2", pluginId: "test", label: "Node 2", parameters: {} }],
        [
          {
            id: "e1",
            sourceNodeId: "nonexistent",
            sourcePort: "out",
            targetNodeId: "node2",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: "missing_node",
        edgeId: "e1",
        message: expect.stringContaining("non-existent source node"),
      });
    });

    it("should fail when connection references non-existent target node", () => {
      const routine = createRoutine(
        [{ id: "node1", pluginId: "test", label: "Node 1", parameters: {} }],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "nonexistent",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: "missing_node",
        edgeId: "e1",
        message: expect.stringContaining("non-existent target node"),
      });
    });
  });

  describe("cycle detection", () => {
    it("should detect simple cycles", () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
          { id: "node3", pluginId: "test", label: "Node 3", parameters: {} },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node2",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e2",
            sourceNodeId: "node2",
            sourcePort: "out",
            targetNodeId: "node3",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e3",
            sourceNodeId: "node3",
            sourcePort: "out",
            targetNodeId: "node1",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "cycle_detected")).toBe(true);
    });

    it("should detect self-loops", () => {
      const routine = createRoutine(
        [{ id: "node1", pluginId: "test", label: "Node 1", parameters: {} }],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node1",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "cycle_detected")).toBe(true);
    });

    it("should pass for DAG (directed acyclic graph)", () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
          { id: "node3", pluginId: "test", label: "Node 3", parameters: {} },
          { id: "node4", pluginId: "test", label: "Node 4", parameters: {} },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node2",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e2",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node3",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e3",
            sourceNodeId: "node2",
            sourcePort: "out",
            targetNodeId: "node4",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e4",
            sourceNodeId: "node3",
            sourcePort: "out",
            targetNodeId: "node4",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(true);
    });
  });

  describe("unreachable nodes warning", () => {
    it("should warn about unreachable nodes", () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
          { id: "node3", pluginId: "test", label: "Node 3", parameters: {} },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node2",
            targetPort: "in",
            type: PortType.Main,
          },
          // node3 is an island, not connected to main flow
          // (This will also trigger orphaned node error)
        ],
      );

      const result = validateGraph(routine);
      // node3 is orphaned (no connections at all)
      expect(result.valid).toBe(false);
      // It will have warnings, including multiple_entry_points since node1 and node3 are both entry nodes
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should not warn about reachable nodes", () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node2",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(true);
      expect(
        result.warnings.filter((w) => w.type === "unreachable_node"),
      ).toEqual([]);
    });
  });

  describe("complex scenarios", () => {
    it("should validate complex graph with multiple branches", () => {
      const routine = createRoutine(
        [
          { id: "start", pluginId: "test", label: "Start", parameters: {} },
          {
            id: "branch1",
            pluginId: "test",
            label: "Branch 1",
            parameters: {},
          },
          {
            id: "branch2",
            pluginId: "test",
            label: "Branch 2",
            parameters: {},
          },
          { id: "merge", pluginId: "test", label: "Merge", parameters: {} },
          { id: "end", pluginId: "test", label: "End", parameters: {} },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "start",
            sourcePort: "out",
            targetNodeId: "branch1",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e2",
            sourceNodeId: "start",
            sourcePort: "out",
            targetNodeId: "branch2",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e3",
            sourceNodeId: "branch1",
            sourcePort: "out",
            targetNodeId: "merge",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e4",
            sourceNodeId: "branch2",
            sourcePort: "out",
            targetNodeId: "merge",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e5",
            sourceNodeId: "merge",
            sourcePort: "out",
            targetNodeId: "end",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const result = validateGraph(routine);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should handle empty routine", () => {
      const routine = createRoutine([], []);

      const result = validateGraph(routine);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: "no_entry_nodes",
        message: expect.any(String),
      });
    });

    it("should handle single isolated node", () => {
      const routine = createRoutine(
        [{ id: "node1", pluginId: "test", label: "Node 1", parameters: {} }],
        [],
      );

      const result = validateGraph(routine);
      // A single node with no connections is considered orphaned
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: "orphaned_node",
        nodeId: "node1",
        message: expect.stringContaining("not connected"),
      });
    });
  });
});
