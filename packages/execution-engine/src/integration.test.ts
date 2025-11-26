/**
 * Integration tests with real plugins
 *
 * Tests the execution engine with actual plugins from @kianax/plugins
 */

import { describe, it, expect } from "vitest";
import { RoutineExecutor, type PluginRegistry } from "./engine/executor.js";
import type { RoutineDefinition } from "./types/graph.js";
import { PortType } from "./types/graph.js";

// Import real plugins
import { getPlugin, createPluginInstance } from "../../plugins/registry.js";

describe("Integration Tests with Real Plugins", () => {
  const realPluginRegistry: PluginRegistry = {
    getPlugin: (id: string) => {
      const plugin = getPlugin(id);
      return plugin
        ? {
            execute: plugin.execute.bind(plugin),
            getId: plugin.getId.bind(plugin),
            getMetadata: plugin.getMetadata.bind(plugin),
          }
        : undefined;
    },
    createPluginInstance: (id: string) => {
      const plugin = createPluginInstance(id);
      return plugin
        ? {
            execute: plugin.execute.bind(plugin),
            getId: plugin.getId.bind(plugin),
            getMetadata: plugin.getMetadata.bind(plugin),
          }
        : undefined;
    },
  };

  const executor = new RoutineExecutor(realPluginRegistry);

  it("should execute static-data plugin in a simple flow", async () => {
    const routine: RoutineDefinition = {
      id: "test-static-data",
      name: "Static Data Test",
      nodes: [
        {
          id: "static1",
          pluginId: "static-data",
          label: "Static Data",
          parameters: {
            data: {
              message: "Hello World",
              count: 42,
            },
          },
        },
        {
          id: "static2",
          pluginId: "static-data",
          label: "Pass Through",
          parameters: {
            data: { passThrough: true },
          },
        },
      ],
      connections: [
        {
          id: "e1",
          sourceNodeId: "static1",
          sourcePort: "data",
          targetNodeId: "static2",
          targetPort: "in",
          type: PortType.Main,
        },
      ],
    };

    const result = await executor.execute(routine);

    expect(result.status).toBe("completed");
    expect(result.nodeResults.size).toBe(2);

    const staticResult = result.nodeResults.get("static1");
    expect(staticResult).toBeDefined();
    expect(staticResult?.[0]?.status).toBe("success");
    expect(staticResult?.[0]?.outputs).toBeDefined();

    // Check the output data
    const output = staticResult?.[0]?.outputs.find(
      (o) => o.portName === "data",
    );
    expect(output).toBeDefined();
    expect(output?.items).toHaveLength(1);
    expect(output?.items[0]?.data).toEqual({
      message: "Hello World",
      count: 42,
    });
  });

  it("should execute if-else plugin with conditional branching", async () => {
    const routine: RoutineDefinition = {
      id: "test-if-else",
      name: "If-Else Test",
      nodes: [
        {
          id: "static1",
          pluginId: "static-data",
          label: "Input Data",
          parameters: {
            data: 10, // Pass the number directly, not wrapped in an object
          },
        },
        {
          id: "if1",
          pluginId: "if-else",
          label: "Check Value",
          parameters: {
            conditionGroups: [
              {
                conditions: [
                  {
                    operator: ">",
                    compareValue: "5",
                  },
                ],
              },
            ],
          },
        },
        {
          id: "trueNode",
          pluginId: "static-data",
          label: "True Branch",
          parameters: {
            data: { result: "Value is greater than 5" },
          },
        },
        {
          id: "falseNode",
          pluginId: "static-data",
          label: "False Branch",
          parameters: {
            data: { result: "Value is not greater than 5" },
          },
        },
      ],
      connections: [
        {
          id: "e1",
          sourceNodeId: "static1",
          sourcePort: "data",
          targetNodeId: "if1",
          targetPort: "value",
          type: PortType.Main,
        },
        {
          id: "e2",
          sourceNodeId: "if1",
          sourcePort: "true",
          targetNodeId: "trueNode",
          targetPort: "in",
          type: PortType.Main,
        },
        {
          id: "e3",
          sourceNodeId: "if1",
          sourcePort: "false",
          targetNodeId: "falseNode",
          targetPort: "in",
          type: PortType.Main,
        },
      ],
    };

    const result = await executor.execute(routine);

    expect(result.status).toBe("completed");

    // Should execute static1, if1, and trueNode (but NOT falseNode)
    expect(result.executionPath).toHaveLength(3);
    expect(result.executionPath.map((p) => p.nodeId)).toEqual([
      "static1",
      "if1",
      "trueNode",
    ]);

    // Check if-else output
    const ifResult = result.nodeResults.get("if1");
    expect(ifResult?.[0]?.status).toBe("success");

    // True port should have data
    const trueOutput = ifResult?.[0]?.outputs.find(
      (o) => o.portName === "true",
    );
    expect(trueOutput?.items).toHaveLength(1);
    expect((trueOutput?.items[0]?.data as any)?.result).toBe(true);

    // False port should not exist in outputs (plugin only returns active branch)
    const falseOutput = ifResult?.[0]?.outputs.find(
      (o) => o.portName === "false",
    );
    expect(falseOutput).toBeUndefined();

    // True branch should have executed
    const trueNodeResult = result.nodeResults.get("trueNode");
    expect(trueNodeResult?.[0]?.status).toBe("success");

    // False branch should NOT have executed
    const falseNodeResult = result.nodeResults.get("falseNode");
    expect(falseNodeResult).toBeUndefined();
  });

  it("should handle missing plugin", async () => {
    const routine: RoutineDefinition = {
      id: "test-missing",
      name: "Missing Plugin Test",
      nodes: [
        {
          id: "start",
          pluginId: "static-data",
          label: "Start",
          parameters: { data: { test: 1 } },
        },
        {
          id: "missing1",
          pluginId: "nonexistent-plugin",
          label: "Missing Plugin",
          parameters: {},
        },
      ],
      connections: [
        {
          id: "e1",
          sourceNodeId: "start",
          sourcePort: "data",
          targetNodeId: "missing1",
          targetPort: "in",
          type: PortType.Main,
        },
      ],
    };

    await expect(executor.execute(routine)).rejects.toThrow(
      "Plugin not found: nonexistent-plugin",
    );
  });
});
