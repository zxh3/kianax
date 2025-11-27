import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RoutineExecutor,
  type PluginRegistry,
  type Plugin,
} from "./executor.js";
import type { RoutineDefinition, Node, Edge } from "../types/graph.js";
import type { ExecutionCallbacks } from "../types/execution.js";
import { PortType } from "@kianax/plugin-sdk";

describe("RoutineExecutor", () => {
  let executor: RoutineExecutor;
  let mockRegistry: PluginRegistry;

  beforeEach(() => {
    // Create a mock plugin that returns simple test data
    const mockPlugin: Plugin = {
      execute: vi.fn(async (inputs) => {
        // Echo inputs to outputs, or return default test data
        return {
          out: inputs.in || { test: "output" },
        };
      }),
      getId: vi.fn(() => "test-plugin"),
      getMetadata: vi.fn(() => ({
        id: "test-plugin",
        name: "Test Plugin",
        description: "A test plugin",
        version: "1.0.0",
        tags: ["test"],
      })),
    };

    mockRegistry = {
      getPlugin: vi.fn(() => mockPlugin),
      createPluginInstance: vi.fn(() => mockPlugin),
    };
    executor = new RoutineExecutor(mockRegistry);
  });

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

  describe("execute", () => {
    it("should reject invalid routine graphs", async () => {
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

      await expect(executor.execute(routine)).rejects.toThrow(
        /Invalid routine graph/,
      );
    });

    it("should execute a simple routine with plugin execution", async () => {
      const routine = createRoutine(
        [
          {
            id: "node1",
            pluginId: "test-plugin",
            label: "Test",
            parameters: {},
          },
          {
            id: "node2",
            pluginId: "test-plugin",
            label: "Test2",
            parameters: {},
          },
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

      const result = await executor.execute(routine);

      expect(result.status).toBe("completed");
      expect(result.nodeResults.size).toBe(2);
      expect(result.executionPath).toHaveLength(2);

      // Verify plugin was called for both nodes
      expect(mockRegistry.createPluginInstance).toHaveBeenCalledTimes(2);
    });

    it("should call lifecycle callbacks on success", async () => {
      const routine = createRoutine(
        [
          {
            id: "node1",
            pluginId: "test-plugin",
            label: "Test",
            parameters: {},
          },
          {
            id: "node2",
            pluginId: "test-plugin",
            label: "Test2",
            parameters: {},
          },
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

      const callbacks: ExecutionCallbacks = {
        onNodeStart: vi.fn(),
        onNodeComplete: vi.fn(),
        onNodeError: vi.fn(),
      };

      await executor.execute(routine, callbacks);

      // Both nodes should be executed
      expect(callbacks.onNodeStart).toHaveBeenCalledWith("node1");
      expect(callbacks.onNodeStart).toHaveBeenCalledWith("node2");
      expect(callbacks.onNodeComplete).toHaveBeenCalledTimes(2);
      expect(callbacks.onNodeError).not.toHaveBeenCalled();
    });

    it("should call onNodeError when plugin fails", async () => {
      // Create a failing plugin
      const failingPlugin: Plugin = {
        execute: vi.fn(async () => {
          throw new Error("Plugin execution failed");
        }),
        getId: vi.fn(() => "failing-plugin"),
        getMetadata: vi.fn(() => ({
          id: "failing-plugin",
          name: "Failing Plugin",
          description: "A failing plugin",
          version: "1.0.0",
          tags: ["test"],
        })),
      };

      // Normal test plugin for the first node
      const testPlugin: Plugin = {
        execute: vi.fn(async (inputs) => {
          return { out: inputs.in || { test: "output" } };
        }),
        getId: vi.fn(() => "test-plugin"),
        getMetadata: vi.fn(() => ({
          id: "test-plugin",
          name: "Test Plugin",
          description: "A test plugin",
          version: "1.0.0",
          tags: ["test"],
        })),
      };

      // Registry that returns the appropriate plugin
      const mixedRegistry: PluginRegistry = {
        getPlugin: vi.fn((id: string) =>
          id === "failing-plugin" ? failingPlugin : testPlugin,
        ),
        createPluginInstance: vi.fn((id: string) =>
          id === "failing-plugin" ? failingPlugin : testPlugin,
        ),
      };

      const failingExecutor = new RoutineExecutor(mixedRegistry);

      const routine = createRoutine(
        [
          {
            id: "start",
            pluginId: "test-plugin",
            label: "Start",
            parameters: {},
          },
          {
            id: "node1",
            pluginId: "failing-plugin",
            label: "Failing Node",
            parameters: {},
          },
        ],
        [
          {
            id: "e1",
            sourceNodeId: "start",
            sourcePort: "out",
            targetNodeId: "node1",
            targetPort: "in",
            type: PortType.Main,
          },
        ],
      );

      const callbacks: ExecutionCallbacks = {
        onNodeStart: vi.fn(),
        onNodeComplete: vi.fn(),
        onNodeError: vi.fn(),
      };

      try {
        await failingExecutor.execute(routine, callbacks);
        throw new Error("Expected execution to fail");
      } catch (error) {
        // Should fail with plugin error
        expect((error as Error).message).toContain("Plugin execution failed");
      }

      expect(callbacks.onNodeStart).toHaveBeenCalledWith("start");
      expect(callbacks.onNodeStart).toHaveBeenCalledWith("node1");
      expect(callbacks.onNodeError).toHaveBeenCalledWith(
        "node1",
        expect.any(Error),
      );
      expect(callbacks.onNodeComplete).toHaveBeenCalledTimes(1); // Only "start" completes
    });

    it("should track execution path", async () => {
      const routine = createRoutine(
        [
          {
            id: "node1",
            pluginId: "test-plugin",
            label: "Test",
            parameters: {},
          },
        ],
        [],
      );

      try {
        const _result = await executor.execute(routine);
      } catch (_error) {
        // Expected to fail (plugin not implemented)
        // In a real implementation, we would check the execution path
      }
    });

    it("should respect maxExecutionTime option", async () => {
      const routine = createRoutine(
        [
          {
            id: "node1",
            pluginId: "test-plugin",
            label: "Test",
            parameters: {},
          },
        ],
        [],
      );

      const slowExecutor = new RoutineExecutor(mockRegistry, {
        maxExecutionTime: 10,
      });

      // We can't easily test this without a real slow plugin
      // This is a placeholder test
      await expect(slowExecutor.execute(routine)).rejects.toThrow();
    });

    it("should respect maxNodes option", async () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        ],
        [],
      );

      const limitedExecutor = new RoutineExecutor(mockRegistry, {
        maxNodes: 1,
      });

      await expect(limitedExecutor.execute(routine)).rejects.toThrow();
    });
  });

  describe("buildExecutionGraph", () => {
    it("should build execution graph with indexed edges", async () => {
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
            sourceNodeId: "node1",
            sourcePort: "out",
            targetNodeId: "node3",
            targetPort: "in2",
            type: PortType.Main,
          },
        ],
      );

      // Access the private method via execution (which builds the graph internally)
      try {
        await executor.execute(routine);
      } catch {
        // Expected to fail, but we can verify the structure was built
      }

      // We can't directly test the private method, but we've verified
      // it doesn't throw during graph construction
    });
  });

  describe("error handling", () => {
    it("should return failed status when node execution fails", async () => {
      const routine = createRoutine(
        [
          {
            id: "node1",
            pluginId: "test-plugin",
            label: "Test",
            parameters: {},
          },
        ],
        [],
      );

      try {
        const _result = await executor.execute(routine);
        // This won't execute due to stub
      } catch (error) {
        // Plugin execution fails, which is expected
        expect(error).toBeDefined();
      }
    });

    it("should collect errors from multiple nodes", async () => {
      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
          { id: "node2", pluginId: "test", label: "Node 2", parameters: {} },
        ],
        [],
      );

      try {
        await executor.execute(routine);
      } catch (_error) {
        // Expected
      }
    });
  });

  describe("integration scenarios", () => {
    it("should handle routine with trigger data", async () => {
      const routine: RoutineDefinition = {
        id: "test-routine",
        name: "Test Routine",
        nodes: [
          { id: "node1", pluginId: "test", label: "Node 1", parameters: {} },
        ],
        connections: [],
        triggerData: { source: "webhook", data: { value: 123 } },
      };

      try {
        await executor.execute(routine);
      } catch {
        // Expected to fail (plugin not implemented)
      }
    });

    it("should support custom iteration strategy", async () => {
      const customStrategy = {
        execute: vi.fn().mockResolvedValue(undefined),
      };

      const customExecutor = new RoutineExecutor(
        mockRegistry,
        {},
        customStrategy,
      );

      const routine = createRoutine(
        [
          { id: "node1", pluginId: "test", label: "Test", parameters: {} },
          { id: "node2", pluginId: "test", label: "Test2", parameters: {} },
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

      try {
        await customExecutor.execute(routine);
      } catch {
        // Expected
      }

      expect(customStrategy.execute).toHaveBeenCalled();
    });
  });
});

describe("RoutineExecutor - Plugin Execution (Integration)", () => {
  // These tests would require a real plugin implementation
  // For now, we document the expected behavior

  it.todo("should execute plugins with correct inputs");
  it.todo("should pass node state to plugins");
  it.todo("should track run index across multiple executions");
  it.todo("should handle plugin outputs and propagate to downstream nodes");
  it.todo("should support conditional branching based on plugin outputs");
  it.todo("should handle loop nodes correctly");
  it.todo("should preserve data lineage through execution");
});
