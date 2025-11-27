/**
 * Integration tests for routine-executor workflow
 *
 * These tests verify that expression resolution works correctly
 * in the workflow's data flow.
 */

import { describe, it, expect } from "vitest";
import {
  ExpressionResolver,
  type ExecutionGraph,
  type Node,
  type Edge,
  ExecutionState,
} from "@kianax/execution-engine";
import type { RoutineInput } from "@kianax/shared/temporal";
import { adaptRoutineInput } from "../lib/routine-adapter";

/**
 * Recreate the buildExecutionGraph function from routine-executor.ts
 * (copied here for testing without Temporal dependencies)
 */
function buildExecutionGraph(
  routine: {
    id?: string;
    nodes: Node[];
    connections: Edge[];
    variables?: Array<{ name: string; value: unknown }>;
  },
  routineId: string,
  triggerData?: unknown,
): ExecutionGraph {
  const nodes = new Map<string, Node>();
  const edgesByTarget = new Map<string, Edge[]>();
  const edgesBySource = new Map<string, Edge[]>();

  for (const node of routine.nodes) {
    nodes.set(node.id, node);
  }

  for (const edge of routine.connections) {
    if (!edgesByTarget.has(edge.targetNodeId)) {
      edgesByTarget.set(edge.targetNodeId, []);
    }
    edgesByTarget.get(edge.targetNodeId)!.push(edge);

    if (!edgesBySource.has(edge.sourceNodeId)) {
      edgesBySource.set(edge.sourceNodeId, []);
    }
    edgesBySource.get(edge.sourceNodeId)!.push(edge);
  }

  const variables: Record<string, unknown> = {};
  if (routine.variables) {
    for (const v of routine.variables) {
      variables[v.name] = v.value;
    }
  }

  return {
    routineId,
    triggerData,
    variables,
    nodes,
    edges: routine.connections,
    edgesByTarget,
    edgesBySource,
  };
}

describe("routine-executor integration", () => {
  /**
   * This test reproduces the exact scenario reported by the user:
   * - Routine has a variable "haha" with value "world"
   * - Static-data node has config: { data: { message: "{{ vars.haha }}" } }
   * - Expected: Expression should resolve to "world"
   */
  it("should resolve {{ vars.haha }} in static-data node config", () => {
    // Step 1: Simulate RoutineInput from web API
    const routineInput: RoutineInput = {
      routineId: "routine-123",
      userId: "user-456",
      nodes: [
        {
          id: "static-data-1",
          pluginId: "static-data",
          config: {
            data: {
              message: "{{ vars.haha }}",
            },
          },
        },
      ],
      connections: [],
      variables: [
        {
          id: "var-1",
          name: "haha",
          type: "string",
          value: "world",
        },
      ],
      triggerData: { source: "manual" },
    };

    // Step 2: Adapt to execution-engine format (routine-adapter.ts)
    const routine = adaptRoutineInput(routineInput);

    // Step 3: Build execution graph (routine-executor.ts)
    const graph = buildExecutionGraph(
      routine,
      routineInput.routineId,
      routineInput.triggerData,
    );

    // Verify graph.variables is correctly populated
    expect(graph.variables).toEqual({ haha: "world" });

    // Step 4: Get the node from the graph
    const node = graph.nodes.get("static-data-1");
    expect(node).toBeDefined();
    expect(node!.parameters).toEqual({
      data: {
        message: "{{ vars.haha }}",
      },
    });

    // Step 5: Build expression context (executeNodeWithActivity)
    const state = new ExecutionState();
    const expressionContext = {
      nodes: state.nodeOutputs,
      vars: graph.variables,
      trigger: graph.triggerData,
      execution: {
        id: "exec-test",
        routineId: graph.routineId,
        startedAt: Date.now(),
      },
    };

    // Step 6: Resolve expressions
    const resolver = new ExpressionResolver(expressionContext);
    const resolvedConfig = resolver.resolve(node!.parameters);

    // Step 7: Verify the expression was resolved
    expect(resolvedConfig).toEqual({
      data: {
        message: "world",
      },
    });
  });

  it("should handle variables passed from Convex format", () => {
    // Convex stores variables with full metadata
    const convexVariables = [
      {
        id: "var-1",
        name: "apiKey",
        type: "string" as const,
        value: "sk-secret-123",
        description: "API key for external service",
      },
      {
        id: "var-2",
        name: "maxRetries",
        type: "number" as const,
        value: 3,
      },
    ];

    const routineInput: RoutineInput = {
      routineId: "routine-456",
      userId: "user-789",
      nodes: [
        {
          id: "node-1",
          pluginId: "static-data",
          config: {
            data: {
              key: "{{ vars.apiKey }}",
              retries: "{{ vars.maxRetries }}",
            },
          },
        },
      ],
      connections: [],
      variables: convexVariables,
      triggerData: {},
    };

    const routine = adaptRoutineInput(routineInput);
    const graph = buildExecutionGraph(
      routine,
      routineInput.routineId,
      routineInput.triggerData,
    );

    // Variables should be converted to Record<string, unknown>
    expect(graph.variables).toEqual({
      apiKey: "sk-secret-123",
      maxRetries: 3,
    });

    const node = graph.nodes.get("node-1");
    const state = new ExecutionState();
    const resolver = new ExpressionResolver({
      nodes: state.nodeOutputs,
      vars: graph.variables,
      trigger: graph.triggerData,
      execution: { id: "1", routineId: "1", startedAt: 1 },
    });

    const resolvedConfig = resolver.resolve(node!.parameters);

    expect(resolvedConfig).toEqual({
      data: {
        key: "sk-secret-123",
        retries: 3,
      },
    });
  });

  it("should handle empty variables array", () => {
    const routineInput: RoutineInput = {
      routineId: "routine-789",
      userId: "user-abc",
      nodes: [
        {
          id: "node-1",
          pluginId: "static-data",
          config: {
            data: {
              message: "{{ vars.missing }}",
            },
          },
        },
      ],
      connections: [],
      variables: [], // Empty array
      triggerData: {},
    };

    const routine = adaptRoutineInput(routineInput);
    const graph = buildExecutionGraph(
      routine,
      routineInput.routineId,
      routineInput.triggerData,
    );

    expect(graph.variables).toEqual({});

    const node = graph.nodes.get("node-1");
    const state = new ExecutionState();
    const resolver = new ExpressionResolver({
      nodes: state.nodeOutputs,
      vars: graph.variables,
      trigger: graph.triggerData,
      execution: { id: "1", routineId: "1", startedAt: 1 },
    });

    const resolvedConfig = resolver.resolve(node!.parameters);

    // Expression should resolve to undefined (not the literal string)
    expect(resolvedConfig).toEqual({
      data: {
        message: undefined,
      },
    });
  });

  it("should handle undefined variables field", () => {
    const routineInput: RoutineInput = {
      routineId: "routine-xyz",
      userId: "user-def",
      nodes: [
        {
          id: "node-1",
          pluginId: "static-data",
          config: {
            data: { test: "{{ vars.foo }}" },
          },
        },
      ],
      connections: [],
      // variables field is undefined
      triggerData: {},
    };

    const routine = adaptRoutineInput(routineInput);
    const graph = buildExecutionGraph(
      routine,
      routineInput.routineId,
      routineInput.triggerData,
    );

    expect(graph.variables).toEqual({});

    const node = graph.nodes.get("node-1");
    const state = new ExecutionState();
    const resolver = new ExpressionResolver({
      nodes: state.nodeOutputs,
      vars: graph.variables,
      trigger: graph.triggerData,
      execution: { id: "1", routineId: "1", startedAt: 1 },
    });

    const resolvedConfig = resolver.resolve(node!.parameters);

    expect(resolvedConfig).toEqual({
      data: {
        test: undefined,
      },
    });
  });
});
