import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BFSIterationStrategy,
  DFSIterationStrategy,
  getDefaultIterationStrategy,
  type NodeExecutor,
} from "./iteration-strategy.js";
import { ExecutionState } from "./execution-state.js";
import type { ExecutionGraph, Node, Edge } from "../types/graph.js";
import type { NodeExecutionResult } from "../types/execution.js";
import { PortType } from "@kianax/plugin-sdk";

describe("BFSIterationStrategy", () => {
  let strategy: BFSIterationStrategy;
  let state: ExecutionState;

  beforeEach(() => {
    strategy = new BFSIterationStrategy();
    state = new ExecutionState();
  });

  function createGraph(nodes: Node[], edges: Edge[]): ExecutionGraph {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const edgesByTarget = new Map<string, Edge[]>();
    const edgesBySource = new Map<string, Edge[]>();

    for (const edge of edges) {
      if (!edgesByTarget.has(edge.targetNodeId)) {
        edgesByTarget.set(edge.targetNodeId, []);
      }
      edgesByTarget.get(edge.targetNodeId)!.push(edge);

      if (!edgesBySource.has(edge.sourceNodeId)) {
        edgesBySource.set(edge.sourceNodeId, []);
      }
      edgesBySource.get(edge.sourceNodeId)!.push(edge);
    }

    return {
      routineId: "test-routine",
      nodes: nodeMap,
      edges,
      edgesByTarget,
      edgesBySource,
    };
  }

  function createMockExecutor(
    outputs: Record<string, NodeExecutionResult>,
  ): NodeExecutor {
    return async (nodeId: string) => {
      const result = outputs[nodeId];
      if (result) {
        state.addNodeResult(nodeId, result);
      }
    };
  }

  it("should execute a simple linear graph", async () => {
    const graph = createGraph(
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
      ],
    );

    const outputs: Record<string, NodeExecutionResult> = {
      node1: {
        outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      },
      node2: {
        outputs: [{ portName: "out", items: [{ data: 2, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      },
      node3: {
        outputs: [],
        executionTime: 10,
        status: "success",
      },
    };

    await strategy.execute(graph, state, createMockExecutor(outputs));

    expect(state.executionPath).toEqual([
      { nodeId: "node1", runIndex: 0 },
      { nodeId: "node2", runIndex: 0 },
      { nodeId: "node3", runIndex: 0 },
    ]);
  });

  it("should execute parallel branches", async () => {
    const graph = createGraph(
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

    const outputs: Record<string, NodeExecutionResult> = {
      node1: {
        outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      },
      node2: {
        outputs: [{ portName: "out", items: [{ data: 2, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      },
      node3: {
        outputs: [{ portName: "out", items: [{ data: 3, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      },
      node4: {
        outputs: [],
        executionTime: 10,
        status: "success",
      },
    };

    await strategy.execute(graph, state, createMockExecutor(outputs));

    // node2 and node3 should execute in parallel after node1
    expect(state.hasExecuted("node1")).toBe(true);
    expect(state.hasExecuted("node2")).toBe(true);
    expect(state.hasExecuted("node3")).toBe(true);
    expect(state.hasExecuted("node4")).toBe(true);

    // Check that node4 executed after both node2 and node3
    const node4Index = state.executionPath.findIndex(
      (p) => p.nodeId === "node4",
    );
    const node2Index = state.executionPath.findIndex(
      (p) => p.nodeId === "node2",
    );
    const node3Index = state.executionPath.findIndex(
      (p) => p.nodeId === "node3",
    );
    expect(node4Index).toBeGreaterThan(node2Index);
    expect(node4Index).toBeGreaterThan(node3Index);
  });

  it("should handle conditional branching via port-based routing", async () => {
    const graph = createGraph(
      [
        { id: "ifNode", pluginId: "if", label: "IF Node", parameters: {} },
        {
          id: "trueNode",
          pluginId: "test",
          label: "True Branch",
          parameters: {},
        },
        {
          id: "falseNode",
          pluginId: "test",
          label: "False Branch",
          parameters: {},
        },
      ],
      [
        {
          id: "e1",
          sourceNodeId: "ifNode",
          sourcePort: "true",
          targetNodeId: "trueNode",
          targetPort: "in",
          type: PortType.Main,
        },
        {
          id: "e2",
          sourceNodeId: "ifNode",
          sourcePort: "false",
          targetNodeId: "falseNode",
          targetPort: "in",
          type: PortType.Main,
        },
      ],
    );

    const outputs: Record<string, NodeExecutionResult> = {
      ifNode: {
        // IF node evaluated to true, so only outputs to "true" port
        outputs: [
          {
            portName: "true",
            items: [{ data: 1, metadata: {} }],
          },
          {
            portName: "false",
            items: [], // No items on false port
          },
        ],
        executionTime: 10,
        status: "success",
      },
      trueNode: {
        outputs: [],
        executionTime: 10,
        status: "success",
      },
      falseNode: {
        outputs: [],
        executionTime: 10,
        status: "success",
      },
    };

    await strategy.execute(graph, state, createMockExecutor(outputs));

    // Only trueNode should execute (because ifNode only output data to "true" port)
    expect(state.hasExecuted("ifNode")).toBe(true);
    expect(state.hasExecuted("trueNode")).toBe(true);
    expect(state.hasExecuted("falseNode")).toBe(false);
  });

  it.todo("should support loops via re-queueing", async () => {
    const graph = createGraph(
      [
        { id: "start", pluginId: "test", label: "Start", parameters: {} },
        { id: "loop", pluginId: "test", label: "Loop", parameters: {} },
        { id: "end", pluginId: "test", label: "End", parameters: {} },
      ],
      [
        {
          id: "e1",
          sourceNodeId: "start",
          sourcePort: "out",
          targetNodeId: "loop",
          targetPort: "in",
          type: PortType.Main,
        },
        {
          id: "e2",
          sourceNodeId: "loop",
          sourcePort: "continue",
          targetNodeId: "loop",
          targetPort: "in",
          type: PortType.Main,
        },
        {
          id: "e3",
          sourceNodeId: "loop",
          sourcePort: "done",
          targetNodeId: "end",
          targetPort: "in",
          type: PortType.Main,
        },
      ],
    );

    let loopExecutions = 0;
    const executeNode: NodeExecutor = async (nodeId: string) => {
      if (nodeId === "start") {
        state.addNodeResult("start", {
          outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
          executionTime: 10,
          status: "success",
        });
      } else if (nodeId === "loop") {
        loopExecutions++;
        // Loop 2 times, then exit
        if (loopExecutions < 3) {
          state.addNodeResult("loop", {
            outputs: [
              {
                portName: "continue",
                items: [{ data: loopExecutions, metadata: {} }],
              },
            ],
            executionTime: 10,
            status: "success",
          });
        } else {
          state.addNodeResult("loop", {
            outputs: [
              { portName: "done", items: [{ data: "finished", metadata: {} }] },
            ],
            executionTime: 10,
            status: "success",
          });
        }
      } else if (nodeId === "end") {
        state.addNodeResult("end", {
          outputs: [],
          executionTime: 10,
          status: "success",
        });
      }
    };

    await strategy.execute(graph, state, executeNode);

    expect(state.getRunIndex("loop")).toBe(3);
    expect(state.hasExecuted("end")).toBe(true);
  });

  it("should throw error when no entry nodes found", async () => {
    const graph = createGraph(
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

    await expect(strategy.execute(graph, state, vi.fn())).rejects.toThrow(
      "No entry nodes found",
    );
  });

  it.skip("should respect maxExecutionTime option", async () => {
    const graph = createGraph(
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

    let executionCount = 0;
    const slowExecutor: NodeExecutor = async (nodeId: string) => {
      executionCount++;
      // Second execution is slow
      if (executionCount === 2) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      state.addNodeResult(nodeId, {
        outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      });
    };

    await expect(
      strategy.execute(graph, state, slowExecutor, { maxExecutionTime: 100 }),
    ).rejects.toThrow("Execution timeout");
  });

  it("should respect maxExecutions option", async () => {
    const graph = createGraph(
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

    const outputs: Record<string, NodeExecutionResult> = {
      node1: {
        outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      },
      node2: {
        outputs: [],
        executionTime: 10,
        status: "success",
      },
    };

    await expect(
      strategy.execute(graph, state, createMockExecutor(outputs), {
        maxExecutions: 1,
      }),
    ).rejects.toThrow("Execution stopped after 1 executions");
  });

  it("should skip nodes with no port output", async () => {
    const graph = createGraph(
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

    const outputs: Record<string, NodeExecutionResult> = {
      node1: {
        outputs: [{ portName: "out", items: [] }], // Empty items
        executionTime: 10,
        status: "success",
      },
    };

    await strategy.execute(graph, state, createMockExecutor(outputs));

    expect(state.hasExecuted("node1")).toBe(true);
    expect(state.hasExecuted("node2")).toBe(false);
  });
});

describe("DFSIterationStrategy", () => {
  let strategy: DFSIterationStrategy;
  let state: ExecutionState;

  beforeEach(() => {
    strategy = new DFSIterationStrategy();
    state = new ExecutionState();
  });

  function createGraph(nodes: Node[], edges: Edge[]): ExecutionGraph {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const edgesByTarget = new Map<string, Edge[]>();
    const edgesBySource = new Map<string, Edge[]>();

    for (const edge of edges) {
      if (!edgesByTarget.has(edge.targetNodeId)) {
        edgesByTarget.set(edge.targetNodeId, []);
      }
      edgesByTarget.get(edge.targetNodeId)!.push(edge);

      if (!edgesBySource.has(edge.sourceNodeId)) {
        edgesBySource.set(edge.sourceNodeId, []);
      }
      edgesBySource.get(edge.sourceNodeId)!.push(edge);
    }

    return {
      routineId: "test-routine",
      nodes: nodeMap,
      edges,
      edgesByTarget,
      edgesBySource,
    };
  }

  function createMockExecutor(
    outputs: Record<string, NodeExecutionResult>,
  ): NodeExecutor {
    return async (nodeId: string) => {
      const result = outputs[nodeId];
      if (result) {
        state.addNodeResult(nodeId, result);
      }
    };
  }

  it("should execute a simple linear graph", async () => {
    const graph = createGraph(
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

    const outputs: Record<string, NodeExecutionResult> = {
      node1: {
        outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      },
      node2: {
        outputs: [],
        executionTime: 10,
        status: "success",
      },
    };

    await strategy.execute(graph, state, createMockExecutor(outputs));

    expect(state.hasExecuted("node1")).toBe(true);
    expect(state.hasExecuted("node2")).toBe(true);
  });

  it("should prevent infinite loops by tracking visited nodes", async () => {
    const graph = createGraph(
      [
        { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        { id: "node3", pluginId: "test", label: "Node 3", parameters: {} },
      ],
      [
        // Create a DAG with diamond pattern
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
      ],
    );

    const outputs: Record<string, NodeExecutionResult> = {
      node1: {
        outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      },
      node2: {
        outputs: [],
        executionTime: 10,
        status: "success",
      },
      node3: {
        outputs: [],
        executionTime: 10,
        status: "success",
      },
    };

    await strategy.execute(graph, state, createMockExecutor(outputs));

    // Each node should execute only once
    expect(state.getRunIndex("node1")).toBe(1);
    expect(state.getRunIndex("node2")).toBe(1);
    expect(state.getRunIndex("node3")).toBe(1);
  });

  it.skip("should respect maxExecutionTime option", async () => {
    const graph = createGraph(
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

    let executionCount = 0;
    const slowExecutor: NodeExecutor = async (nodeId: string) => {
      executionCount++;
      // Second execution is slow
      if (executionCount === 2) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      state.addNodeResult(nodeId, {
        outputs: [{ portName: "out", items: [{ data: 1, metadata: {} }] }],
        executionTime: 10,
        status: "success",
      });
    };

    await expect(
      strategy.execute(graph, state, slowExecutor, { maxExecutionTime: 100 }),
    ).rejects.toThrow("Execution timeout");
  });
});

describe("getDefaultIterationStrategy", () => {
  it("should return BFSIterationStrategy", () => {
    const strategy = getDefaultIterationStrategy();
    expect(strategy).toBeInstanceOf(BFSIterationStrategy);
  });
});
