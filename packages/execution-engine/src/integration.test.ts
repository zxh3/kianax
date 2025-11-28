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
          sourcePort: "output",
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
      (o) => o.portName === "output",
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
            // Value comes from upstream node via expression
            value: "{{ nodes.static1.output }}",
            conditionGroups: [
              {
                conditions: [
                  {
                    operator: ">",
                    compareValue: 5,
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
          sourcePort: "output",
          targetNodeId: "if1",
          targetPort: "data",
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
          sourcePort: "output",
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

  describe("Variable expressions", () => {
    it("should resolve {{ vars.* }} expressions in node parameters", async () => {
      const routine: RoutineDefinition = {
        id: "test-vars",
        name: "Variables Test",
        variables: [
          {
            id: "v1",
            name: "apiUrl",
            type: "string",
            value: "https://api.example.com",
          },
          { id: "v2", name: "maxItems", type: "number", value: 100 },
          { id: "v3", name: "debug", type: "boolean", value: true },
        ],
        nodes: [
          {
            id: "static1",
            pluginId: "static-data",
            label: "Config Output",
            parameters: {
              // Use variable expressions in the data
              data: {
                url: "{{ vars.apiUrl }}",
                limit: "{{ vars.maxItems }}",
                debugMode: "{{ vars.debug }}",
              },
            },
          },
          {
            id: "sink",
            pluginId: "static-data",
            label: "Sink",
            parameters: { data: "done" },
          },
        ],
        connections: [
          {
            id: "e1",
            sourceNodeId: "static1",
            sourcePort: "output",
            targetNodeId: "sink",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      };

      const result = await executor.execute(routine);

      expect(result.status).toBe("completed");

      const nodeResult = result.nodeResults.get("static1");
      expect(nodeResult?.[0]?.status).toBe("success");

      const output = nodeResult?.[0]?.outputs.find(
        (o) => o.portName === "output",
      );
      expect(output?.items[0]?.data).toEqual({
        url: "https://api.example.com",
        limit: 100,
        debugMode: true,
      });
    });

    it("should resolve nested variable expressions", async () => {
      const routine: RoutineDefinition = {
        id: "test-nested-vars",
        name: "Nested Variables Test",
        variables: [
          {
            id: "v1",
            name: "config",
            type: "json",
            value: {
              api: {
                baseUrl: "https://api.example.com",
                timeout: 5000,
              },
              features: {
                enabled: true,
              },
            },
          },
        ],
        nodes: [
          {
            id: "static1",
            pluginId: "static-data",
            label: "Nested Config",
            parameters: {
              data: {
                baseUrl: "{{ vars.config.api.baseUrl }}",
                timeout: "{{ vars.config.api.timeout }}",
                featureFlag: "{{ vars.config.features.enabled }}",
              },
            },
          },
          {
            id: "sink",
            pluginId: "static-data",
            label: "Sink",
            parameters: { data: "done" },
          },
        ],
        connections: [
          {
            id: "e1",
            sourceNodeId: "static1",
            sourcePort: "output",
            targetNodeId: "sink",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      };

      const result = await executor.execute(routine);

      expect(result.status).toBe("completed");

      const output = result.nodeResults
        .get("static1")?.[0]
        ?.outputs.find((o) => o.portName === "output");

      expect(output?.items[0]?.data).toEqual({
        baseUrl: "https://api.example.com",
        timeout: 5000,
        featureFlag: true,
      });
    });

    it("should use variables in conditional branching", async () => {
      const routine: RoutineDefinition = {
        id: "test-vars-condition",
        name: "Variables in Condition Test",
        variables: [
          { id: "v1", name: "threshold", type: "number", value: 50 },
          { id: "v2", name: "inputValue", type: "number", value: 75 },
        ],
        nodes: [
          {
            id: "if1",
            pluginId: "if-else",
            label: "Check Against Threshold",
            parameters: {
              value: "{{ vars.inputValue }}",
              conditionGroups: [
                {
                  conditions: [
                    {
                      operator: ">",
                      // Note: compareValue should reference the threshold variable
                      compareValue: 50,
                    },
                  ],
                },
              ],
            },
          },
          {
            id: "trueNode",
            pluginId: "static-data",
            label: "Above Threshold",
            parameters: {
              data: { message: "Value is above threshold" },
            },
          },
          {
            id: "falseNode",
            pluginId: "static-data",
            label: "Below Threshold",
            parameters: {
              data: { message: "Value is below threshold" },
            },
          },
        ],
        connections: [
          {
            id: "e1",
            sourceNodeId: "if1",
            sourcePort: "true",
            targetNodeId: "trueNode",
            targetPort: "in",
            type: PortType.Main,
          },
          {
            id: "e2",
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

      // Should execute if1 and trueNode (75 > 50)
      expect(result.executionPath.map((p) => p.nodeId)).toEqual([
        "if1",
        "trueNode",
      ]);
    });
  });

  describe("Trigger expressions", () => {
    it("should resolve {{ trigger.* }} expressions in node parameters", async () => {
      const routine: RoutineDefinition = {
        id: "test-trigger",
        name: "Trigger Test",
        triggerData: {
          type: "webhook",
          payload: {
            userId: "user-123",
            action: "create",
            data: {
              name: "Test Item",
              quantity: 5,
            },
          },
        },
        nodes: [
          {
            id: "static1",
            pluginId: "static-data",
            label: "Process Trigger",
            parameters: {
              data: {
                userId: "{{ trigger.payload.userId }}",
                action: "{{ trigger.payload.action }}",
                itemName: "{{ trigger.payload.data.name }}",
                qty: "{{ trigger.payload.data.quantity }}",
              },
            },
          },
          {
            id: "sink",
            pluginId: "static-data",
            label: "Sink",
            parameters: { data: "done" },
          },
        ],
        connections: [
          {
            id: "e1",
            sourceNodeId: "static1",
            sourcePort: "output",
            targetNodeId: "sink",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      };

      const result = await executor.execute(routine);

      expect(result.status).toBe("completed");

      const output = result.nodeResults
        .get("static1")?.[0]
        ?.outputs.find((o) => o.portName === "output");

      expect(output?.items[0]?.data).toEqual({
        userId: "user-123",
        action: "create",
        itemName: "Test Item",
        qty: 5,
      });
    });
  });

  describe("Combined expressions", () => {
    it("should resolve mixed vars, nodes, and trigger expressions", async () => {
      const routine: RoutineDefinition = {
        id: "test-combined",
        name: "Combined Expressions Test",
        variables: [
          {
            id: "v1",
            name: "apiBase",
            type: "string",
            value: "https://api.example.com",
          },
        ],
        triggerData: {
          userId: "user-456",
          timestamp: 1700000000000,
        },
        nodes: [
          {
            id: "static1",
            pluginId: "static-data",
            label: "First Node",
            parameters: {
              data: {
                status: "success",
                count: 42,
              },
            },
          },
          {
            id: "static2",
            pluginId: "static-data",
            label: "Combined Output",
            parameters: {
              data: {
                // Mix of all expression types
                apiEndpoint: "{{ vars.apiBase }}/users/{{ trigger.userId }}",
                upstreamStatus: "{{ nodes.static1.output.status }}",
                upstreamCount: "{{ nodes.static1.output.count }}",
                triggerTime: "{{ trigger.timestamp }}",
              },
            },
          },
        ],
        connections: [
          {
            id: "e1",
            sourceNodeId: "static1",
            sourcePort: "output",
            targetNodeId: "static2",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      };

      const result = await executor.execute(routine);

      expect(result.status).toBe("completed");

      const output = result.nodeResults
        .get("static2")?.[0]
        ?.outputs.find((o) => o.portName === "output");

      expect(output?.items[0]?.data).toEqual({
        apiEndpoint: "https://api.example.com/users/user-456",
        upstreamStatus: "success",
        upstreamCount: 42,
        triggerTime: 1700000000000,
      });
    });

    it("should handle undefined variable gracefully", async () => {
      const routine: RoutineDefinition = {
        id: "test-undefined-var",
        name: "Undefined Variable Test",
        variables: [],
        nodes: [
          {
            id: "static1",
            pluginId: "static-data",
            label: "With Undefined Var",
            parameters: {
              data: {
                value: "{{ vars.nonexistent }}",
                fallback: "default",
              },
            },
          },
          {
            id: "sink",
            pluginId: "static-data",
            label: "Sink",
            parameters: { data: "done" },
          },
        ],
        connections: [
          {
            id: "e1",
            sourceNodeId: "static1",
            sourcePort: "output",
            targetNodeId: "sink",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      };

      const result = await executor.execute(routine);

      expect(result.status).toBe("completed");

      const output = result.nodeResults
        .get("static1")?.[0]
        ?.outputs.find((o) => o.portName === "output");

      // Undefined variable should resolve to undefined
      expect(output?.items[0]?.data).toEqual({
        value: undefined,
        fallback: "default",
      });
    });
  });
});
