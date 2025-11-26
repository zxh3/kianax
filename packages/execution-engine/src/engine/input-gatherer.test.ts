import { describe, it, expect, beforeEach } from "vitest";
import { gatherNodeInputs } from "./input-gatherer.js";
import { ExecutionState } from "./execution-state.js";
import type { ExecutionGraph, Node, Edge } from "../types/graph.js";
import type { NodeExecutionResult, PortData } from "../types/execution.js";
import { PortType } from "@kianax/plugin-sdk";

describe("gatherNodeInputs", () => {
  let state: ExecutionState;

  beforeEach(() => {
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

  it("should return empty array when node has no incoming edges", () => {
    const graph = createGraph(
      [{ id: "node1", pluginId: "test", label: "Test", parameters: {} }],
      [],
    );

    const inputs = gatherNodeInputs("node1", graph, state);
    expect(inputs).toEqual([]);
  });

  it("should gather inputs from single upstream node", () => {
    const graph = createGraph(
      [
        { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
      ],
      [
        {
          id: "edge1",
          sourceNodeId: "node1",
          sourcePort: "output",
          targetNodeId: "node2",
          targetPort: "input",
          type: PortType.Main,
        },
      ],
    );

    const result1: NodeExecutionResult = {
      outputs: [
        {
          portName: "output",
          items: [
            { data: { value: 1 }, metadata: {} },
            { data: { value: 2 }, metadata: {} },
          ],
        },
      ],
      executionTime: 100,
      status: "success",
    };

    state.addNodeResult("node1", result1);

    const inputs = gatherNodeInputs("node2", graph, state);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.portName).toBe("input");
    expect(inputs[0]!.items).toHaveLength(2);
    expect(inputs[0]!.items[0]!.metadata.sourceNode).toBe("node1");
    expect(inputs[0]!.items[0]!.metadata.sourcePort).toBe("output");
    expect(inputs[0]!.items[0]!.metadata.sourceItemIndex).toBe(0);
  });

  it("should gather inputs from multiple upstream nodes to same port", () => {
    const graph = createGraph(
      [
        { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        { id: "node3", pluginId: "test", label: "Node 3", parameters: {} },
      ],
      [
        {
          id: "edge1",
          sourceNodeId: "node1",
          sourcePort: "output",
          targetNodeId: "node3",
          targetPort: "input",
          type: PortType.Main,
        },
        {
          id: "edge2",
          sourceNodeId: "node2",
          sourcePort: "output",
          targetNodeId: "node3",
          targetPort: "input",
          type: PortType.Main,
        },
      ],
    );

    const result1: NodeExecutionResult = {
      outputs: [
        {
          portName: "output",
          items: [{ data: { source: "n1" }, metadata: {} }],
        },
      ],
      executionTime: 50,
      status: "success",
    };

    const result2: NodeExecutionResult = {
      outputs: [
        {
          portName: "output",
          items: [{ data: { source: "n2" }, metadata: {} }],
        },
      ],
      executionTime: 50,
      status: "success",
    };

    state.addNodeResult("node1", result1);
    state.addNodeResult("node2", result2);

    const inputs = gatherNodeInputs("node3", graph, state);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.portName).toBe("input");
    expect(inputs[0]!.items).toHaveLength(2);
    expect((inputs[0]!.items[0]!.data as any)?.source).toBe("n1");
    expect((inputs[0]!.items[1]!.data as any)?.source).toBe("n2");
  });

  it("should gather inputs to different target ports", () => {
    const graph = createGraph(
      [
        { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        { id: "node3", pluginId: "test", label: "Node 3", parameters: {} },
      ],
      [
        {
          id: "edge1",
          sourceNodeId: "node1",
          sourcePort: "output",
          targetNodeId: "node3",
          targetPort: "input1",
          type: PortType.Main,
        },
        {
          id: "edge2",
          sourceNodeId: "node2",
          sourcePort: "output",
          targetNodeId: "node3",
          targetPort: "input2",
          type: PortType.Main,
        },
      ],
    );

    const result1: NodeExecutionResult = {
      outputs: [
        {
          portName: "output",
          items: [{ data: "data1", metadata: {} }],
        },
      ],
      executionTime: 50,
      status: "success",
    };

    const result2: NodeExecutionResult = {
      outputs: [
        {
          portName: "output",
          items: [{ data: "data2", metadata: {} }],
        },
      ],
      executionTime: 50,
      status: "success",
    };

    state.addNodeResult("node1", result1);
    state.addNodeResult("node2", result2);

    const inputs = gatherNodeInputs("node3", graph, state);

    expect(inputs).toHaveLength(2);
    const input1 = inputs.find((p) => p.portName === "input1");
    const input2 = inputs.find((p) => p.portName === "input2");

    expect(input1?.items[0]!.data).toBe("data1");
    expect(input2?.items[0]!.data).toBe("data2");
  });

  it("should skip edges where source node failed", () => {
    const graph = createGraph(
      [
        { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
      ],
      [
        {
          id: "edge1",
          sourceNodeId: "node1",
          sourcePort: "output",
          targetNodeId: "node2",
          targetPort: "input",
          type: PortType.Main,
        },
      ],
    );

    const errorResult: NodeExecutionResult = {
      outputs: [],
      executionTime: 50,
      status: "error",
      error: { message: "Test error" },
    };

    state.addNodeResult("node1", errorResult);

    const inputs = gatherNodeInputs("node2", graph, state);
    expect(inputs).toEqual([]);
  });

  it("should skip edges where source node hasn't executed", () => {
    const graph = createGraph(
      [
        { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
      ],
      [
        {
          id: "edge1",
          sourceNodeId: "node1",
          sourcePort: "output",
          targetNodeId: "node2",
          targetPort: "input",
          type: PortType.Main,
        },
      ],
    );

    const inputs = gatherNodeInputs("node2", graph, state);
    expect(inputs).toEqual([]);
  });

  it("should throw error when source port doesn't exist in output", () => {
    const graph = createGraph(
      [
        { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
      ],
      [
        {
          id: "edge1",
          sourceNodeId: "node1",
          sourcePort: "nonexistent",
          targetNodeId: "node2",
          targetPort: "input",
          type: PortType.Main,
        },
      ],
    );

    const result: NodeExecutionResult = {
      outputs: [
        {
          portName: "output",
          items: [{ data: "test", metadata: {} }],
        },
      ],
      executionTime: 50,
      status: "success",
    };

    state.addNodeResult("node1", result);

    expect(() => gatherNodeInputs("node2", graph, state)).toThrow(
      /Source port "nonexistent" not found/,
    );
  });

  it("should preserve existing metadata from source items", () => {
    const graph = createGraph(
      [
        { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
      ],
      [
        {
          id: "edge1",
          sourceNodeId: "node1",
          sourcePort: "output",
          targetNodeId: "node2",
          targetPort: "input",
          type: PortType.Main,
        },
      ],
    );

    const result: NodeExecutionResult = {
      outputs: [
        {
          portName: "output",
          items: [
            {
              data: "test",
              metadata: {
                iteration: 5,
                sourceNode: "original-node",
              },
            },
          ],
        },
      ],
      executionTime: 50,
      status: "success",
    };

    state.addNodeResult("node1", result);

    const inputs = gatherNodeInputs("node2", graph, state);

    expect(inputs[0]!.items[0]!.metadata.iteration).toBe(5);
    expect(inputs[0]!.items[0]!.metadata.sourceNode).toBe("node1"); // Overwritten
    expect(inputs[0]!.items[0]!.metadata.sourcePort).toBe("output");
    expect(inputs[0]!.items[0]!.metadata.sourceItemIndex).toBe(0);
  });

  it("should handle multiple output ports from source node", () => {
    const graph = createGraph(
      [
        { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
      ],
      [
        {
          id: "edge1",
          sourceNodeId: "node1",
          sourcePort: "output1",
          targetNodeId: "node2",
          targetPort: "input1",
          type: PortType.Main,
        },
        {
          id: "edge2",
          sourceNodeId: "node1",
          sourcePort: "output2",
          targetNodeId: "node2",
          targetPort: "input2",
          type: PortType.Main,
        },
      ],
    );

    const result: NodeExecutionResult = {
      outputs: [
        {
          portName: "output1",
          items: [{ data: "from-out1", metadata: {} }],
        },
        {
          portName: "output2",
          items: [{ data: "from-out2", metadata: {} }],
        },
      ],
      executionTime: 50,
      status: "success",
    };

    state.addNodeResult("node1", result);

    const inputs = gatherNodeInputs("node2", graph, state);

    expect(inputs).toHaveLength(2);
    const input1 = inputs.find((p) => p.portName === "input1");
    const input2 = inputs.find((p) => p.portName === "input2");

    expect(input1?.items[0]!.data).toBe("from-out1");
    expect(input2?.items[0]!.data).toBe("from-out2");
  });
});
