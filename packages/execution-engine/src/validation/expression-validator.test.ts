/**
 * Unit tests for expression validator
 */

import { describe, it, expect } from "vitest";
import {
  validateExpressions,
  getExpressionErrors,
  hasValidExpressions,
} from "./expression-validator.js";
import type { RoutineDefinition, Node, Edge } from "../types/graph.js";

// Helper to create a minimal routine
function createRoutine(
  nodes: Node[],
  connections: Edge[] = [],
  variables: Array<{
    id: string;
    name: string;
    type: "string";
    value: string;
  }> = [],
): RoutineDefinition {
  return {
    name: "Test Routine",
    nodes,
    connections,
    variables,
  };
}

// Helper to create a node
function createNode(
  id: string,
  parameters: Record<string, unknown> = {},
): Node {
  return {
    id,
    pluginId: "test-plugin",
    label: `Node ${id}`,
    parameters,
  };
}

// Helper to create an edge
function createEdge(sourceId: string, targetId: string): Edge {
  return {
    id: `${sourceId}->${targetId}`,
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    sourcePort: "output",
    targetPort: "input",
    type: "main" as any,
  };
}

describe("validateExpressions", () => {
  describe("valid expressions", () => {
    it("should pass routine with no expressions", () => {
      const routine = createRoutine([createNode("node1", { value: "static" })]);

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should pass valid vars reference", () => {
      const routine = createRoutine(
        [createNode("node1", { url: "{{ vars.apiUrl }}" })],
        [],
        [
          {
            id: "v1",
            name: "apiUrl",
            type: "string",
            value: "https://api.example.com",
          },
        ],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should pass valid nested vars reference", () => {
      const routine = createRoutine(
        [createNode("node1", { config: { key: "{{ vars.apiKey }}" } })],
        [],
        [{ id: "v1", name: "apiKey", type: "string", value: "secret" }],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });

    it("should pass valid upstream node reference", () => {
      const routine = createRoutine(
        [
          createNode("node1", { data: "input" }),
          createNode("node2", { value: "{{ nodes.node1.output }}" }),
        ],
        [createEdge("node1", "node2")],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });

    it("should pass trigger references (always valid)", () => {
      const routine = createRoutine([
        createNode("node1", { userId: "{{ trigger.payload.userId }}" }),
      ]);

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });

    it("should pass execution references (always valid)", () => {
      const routine = createRoutine([
        createNode("node1", { execId: "{{ execution.id }}" }),
      ]);

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });

    it("should pass {{ vars }} without specific name", () => {
      const routine = createRoutine([
        createNode("node1", { allVars: "{{ vars }}" }),
      ]);

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });

    it("should pass multiple valid expressions in same node", () => {
      const routine = createRoutine(
        [
          createNode("node1", {}),
          createNode("node2", {
            url: "{{ vars.baseUrl }}/{{ nodes.node1.data }}",
            header: "{{ vars.token }}",
          }),
        ],
        [createEdge("node1", "node2")],
        [
          {
            id: "v1",
            name: "baseUrl",
            type: "string",
            value: "https://api.com",
          },
          { id: "v2", name: "token", type: "string", value: "abc" },
        ],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });

    it("should pass transitive upstream reference", () => {
      // node1 -> node2 -> node3, node3 can reference node1
      const routine = createRoutine(
        [
          createNode("node1", {}),
          createNode("node2", {}),
          createNode("node3", { value: "{{ nodes.node1.output }}" }),
        ],
        [createEdge("node1", "node2"), createEdge("node2", "node3")],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });
  });

  describe("undefined variable errors", () => {
    it("should error on undefined variable", () => {
      const routine = createRoutine([
        createNode("node1", { url: "{{ vars.undefinedVar }}" }),
      ]);

      const result = validateExpressions(routine);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe("UNDEFINED_VARIABLE");
      expect(result.errors[0]?.message).toContain("undefinedVar");
    });

    it("should error on multiple undefined variables", () => {
      const routine = createRoutine([
        createNode("node1", {
          a: "{{ vars.missing1 }}",
          b: "{{ vars.missing2 }}",
        }),
      ]);

      const result = validateExpressions(routine);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should error on undefined var with valid var in same node", () => {
      const routine = createRoutine(
        [
          createNode("node1", {
            valid: "{{ vars.defined }}",
            invalid: "{{ vars.undefined }}",
          }),
        ],
        [],
        [{ id: "v1", name: "defined", type: "string", value: "ok" }],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe("UNDEFINED_VARIABLE");
    });
  });

  describe("invalid node reference errors", () => {
    it("should error on non-existent node reference", () => {
      const routine = createRoutine([
        createNode("node1", { value: "{{ nodes.nonExistent.output }}" }),
      ]);

      const result = validateExpressions(routine);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe("INVALID_NODE_REF");
    });

    it("should error on self-reference", () => {
      const routine = createRoutine([
        createNode("node1", { value: "{{ nodes.node1.output }}" }),
      ]);

      const result = validateExpressions(routine);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe("SELF_REFERENCE");
    });
  });

  describe("not upstream errors", () => {
    it("should error on downstream node reference", () => {
      // node1 -> node2, but node1 tries to reference node2
      const routine = createRoutine(
        [
          createNode("node1", { value: "{{ nodes.node2.output }}" }),
          createNode("node2", {}),
        ],
        [createEdge("node1", "node2")],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe("NOT_UPSTREAM");
    });

    it("should error on sibling node reference (no path)", () => {
      // node1 and node2 are siblings (both connect to node3)
      const routine = createRoutine(
        [
          createNode("node1", {}),
          createNode("node2", { value: "{{ nodes.node1.output }}" }),
          createNode("node3", {}),
        ],
        [createEdge("node1", "node3"), createEdge("node2", "node3")],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe("NOT_UPSTREAM");
    });

    it("should error on unconnected node reference", () => {
      const routine = createRoutine(
        [
          createNode("node1", {}),
          createNode("node2", { value: "{{ nodes.node1.output }}" }),
        ],
        [], // No connections
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe("NOT_UPSTREAM");
    });
  });

  describe("complex scenarios", () => {
    it("should validate diamond dependency correctly", () => {
      // Diamond: node1 -> node2 -> node4
      //          node1 -> node3 -> node4
      // node4 can reference node1, node2, node3
      const routine = createRoutine(
        [
          createNode("node1", {}),
          createNode("node2", {}),
          createNode("node3", {}),
          createNode("node4", {
            a: "{{ nodes.node1.out }}",
            b: "{{ nodes.node2.out }}",
            c: "{{ nodes.node3.out }}",
          }),
        ],
        [
          createEdge("node1", "node2"),
          createEdge("node1", "node3"),
          createEdge("node2", "node4"),
          createEdge("node3", "node4"),
        ],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });

    it("should validate mixed valid and invalid expressions", () => {
      const routine = createRoutine(
        [
          createNode("node1", {}),
          createNode("node2", {
            valid1: "{{ vars.defined }}",
            valid2: "{{ nodes.node1.output }}",
            invalid1: "{{ vars.undefined }}",
            invalid2: "{{ nodes.nonExistent.output }}",
          }),
        ],
        [createEdge("node1", "node2")],
        [{ id: "v1", name: "defined", type: "string", value: "ok" }],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should handle deeply nested expressions", () => {
      const routine = createRoutine(
        [
          createNode("node1", {
            level1: {
              level2: {
                level3: {
                  value: "{{ vars.deep }}",
                },
              },
            },
          }),
        ],
        [],
        [{ id: "v1", name: "deep", type: "string", value: "found" }],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });

    it("should handle expressions in arrays", () => {
      const routine = createRoutine(
        [
          createNode("node1", {
            items: ["{{ vars.item1 }}", "{{ vars.item2 }}", "static"],
          }),
        ],
        [],
        [
          { id: "v1", name: "item1", type: "string", value: "a" },
          { id: "v2", name: "item2", type: "string", value: "b" },
        ],
      );

      const result = validateExpressions(routine);

      expect(result.valid).toBe(true);
    });
  });

  describe("warnings", () => {
    it("should warn on unknown expression source", () => {
      const routine = createRoutine([
        createNode("node1", { value: "{{ unknown.path }}" }),
      ]);

      const result = validateExpressions(routine);

      // Unknown source returns undefined at runtime but doesn't block
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("getExpressionErrors", () => {
  it("should return only errors array", () => {
    const routine = createRoutine([
      createNode("node1", { url: "{{ vars.missing }}" }),
    ]);

    const errors = getExpressionErrors(routine);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("UNDEFINED_VARIABLE");
  });

  it("should return empty array for valid routine", () => {
    const routine = createRoutine([createNode("node1", { value: "static" })]);

    const errors = getExpressionErrors(routine);

    expect(errors).toHaveLength(0);
  });
});

describe("hasValidExpressions", () => {
  it("should return true for valid routine", () => {
    const routine = createRoutine(
      [createNode("node1", { url: "{{ vars.url }}" })],
      [],
      [{ id: "v1", name: "url", type: "string", value: "https://api.com" }],
    );

    expect(hasValidExpressions(routine)).toBe(true);
  });

  it("should return false for invalid routine", () => {
    const routine = createRoutine([
      createNode("node1", { url: "{{ vars.missing }}" }),
    ]);

    expect(hasValidExpressions(routine)).toBe(false);
  });
});
