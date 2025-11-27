/**
 * Tests for expression resolution in static-data node config
 *
 * This test simulates the exact scenario happening in routine-executor.ts
 * where a static-data node has JSON config with variable expressions.
 */

import { describe, it, expect } from "vitest";
import {
  ExpressionResolver,
  type ExpressionContext,
  createEmptyContext,
} from "./expression-resolver.js";

describe("ExpressionResolver with static-data node config", () => {
  /**
   * This test reproduces the exact scenario:
   * - User has a routine variable `haha` with value "world"
   * - User configures static-data node with: { data: { message: "{{ vars.haha }}" } }
   * - Expected output: { data: { message: "world" } }
   */
  it("should resolve {{ vars.haha }} in static-data config", () => {
    // Setup context with routine variables
    const context: ExpressionContext = {
      nodes: new Map(),
      vars: {
        haha: "world",
      },
      trigger: {},
      execution: {
        id: "exec-123",
        routineId: "routine-456",
        startedAt: Date.now(),
      },
    };

    // This is what the static-data node's `parameters` field looks like
    // (after conversion from node.config in routine-adapter.ts)
    const nodeParameters = {
      data: {
        message: "{{ vars.haha }}",
      },
    };

    const resolver = new ExpressionResolver(context);
    const resolved = resolver.resolve(nodeParameters);

    // The expression should be resolved
    expect(resolved).toEqual({
      data: {
        message: "world",
      },
    });
  });

  /**
   * Test with variables stored in format matching Convex schema
   */
  it("should work when vars are converted from Convex format", () => {
    // Convex stores variables as array
    const convexVariables = [
      { id: "var-1", name: "haha", type: "string", value: "world" },
      { id: "var-2", name: "count", type: "number", value: 42 },
    ];

    // Convert to Record<string, unknown> as done in buildExecutionGraph
    const vars: Record<string, unknown> = {};
    for (const v of convexVariables) {
      vars[v.name] = v.value;
    }

    const context: ExpressionContext = {
      nodes: new Map(),
      vars,
      trigger: {},
      execution: {
        id: "exec-123",
        routineId: "routine-456",
        startedAt: Date.now(),
      },
    };

    const nodeParameters = {
      data: {
        message: "{{ vars.haha }}",
        total: "{{ vars.count }}",
      },
    };

    const resolver = new ExpressionResolver(context);
    const resolved = resolver.resolve(nodeParameters);

    expect(resolved).toEqual({
      data: {
        message: "world",
        total: 42,
      },
    });
  });

  /**
   * Test that undefined variables result in undefined (not the literal string)
   */
  it("should return undefined for missing variable", () => {
    const context = createEmptyContext();
    context.vars = {
      existing: "value",
    };

    const resolver = new ExpressionResolver(context);
    const resolved = resolver.resolve({ data: { msg: "{{ vars.missing }}" } });

    // When the entire value is an expression that resolves to undefined,
    // the result should be undefined
    expect(resolved).toEqual({
      data: {
        msg: undefined,
      },
    });
  });

  /**
   * Test string interpolation with expressions
   */
  it("should interpolate expression in a longer string", () => {
    const context = createEmptyContext();
    context.vars = { name: "John" };

    const resolver = new ExpressionResolver(context);
    const resolved = resolver.resolve({
      data: { greeting: "Hello, {{ vars.name }}!" },
    });

    expect(resolved).toEqual({
      data: { greeting: "Hello, John!" },
    });
  });

  /**
   * Test that non-expression strings pass through unchanged
   */
  it("should not modify strings without expressions", () => {
    const context = createEmptyContext();
    context.vars = { haha: "world" };

    const resolver = new ExpressionResolver(context);
    const resolved = resolver.resolve({
      data: { message: "no expressions here" },
    });

    expect(resolved).toEqual({
      data: { message: "no expressions here" },
    });
  });

  /**
   * CRITICAL TEST: JSON data type with expression in nested leaf field
   * This is exactly what the user reported as not working
   */
  it("should resolve expression in nested JSON leaf field", () => {
    const context: ExpressionContext = {
      nodes: new Map(),
      vars: {
        haha: "world",
      },
      trigger: {},
      execution: {
        id: "exec-123",
        routineId: "routine-456",
        startedAt: Date.now(),
      },
    };

    // This is what gets stored when user enters JSON:
    // { "message": "{{ vars.haha }}" }
    // in the static-data node's JSON editor
    const nodeParameters = {
      data: {
        message: "{{ vars.haha }}",
      },
    };

    const resolver = new ExpressionResolver(context);
    const resolved = resolver.resolve(nodeParameters);

    // This should resolve the nested expression
    expect(resolved).toEqual({
      data: {
        message: "world",
      },
    });
  });

  /**
   * Test deeply nested JSON with expression
   */
  it("should resolve expression in deeply nested JSON", () => {
    const context: ExpressionContext = {
      nodes: new Map(),
      vars: {
        value: "resolved!",
      },
      trigger: {},
      execution: {
        id: "exec-123",
        routineId: "routine-456",
        startedAt: Date.now(),
      },
    };

    const nodeParameters = {
      data: {
        level1: {
          level2: {
            level3: {
              message: "{{ vars.value }}",
            },
          },
        },
      },
    };

    const resolver = new ExpressionResolver(context);
    const resolved = resolver.resolve(nodeParameters);

    expect(resolved).toEqual({
      data: {
        level1: {
          level2: {
            level3: {
              message: "resolved!",
            },
          },
        },
      },
    });
  });

  /**
   * Test what happens when vars is empty (bug scenario)
   */
  it("should return undefined when vars is empty and variable referenced", () => {
    const context: ExpressionContext = {
      nodes: new Map(),
      vars: {}, // Empty vars!
      trigger: {},
      execution: {
        id: "exec-123",
        routineId: "routine-456",
        startedAt: Date.now(),
      },
    };

    const nodeParameters = {
      data: {
        message: "{{ vars.haha }}", // This references a non-existent var
      },
    };

    const resolver = new ExpressionResolver(context);
    const resolved = resolver.resolve(nodeParameters);

    // When vars is empty, the expression resolves to undefined
    expect(resolved).toEqual({
      data: {
        message: undefined,
      },
    });
  });

  /**
   * Test the entire workflow simulation
   */
  it("should simulate the full workflow expression resolution", () => {
    // This simulates what happens in routine-executor.ts:executeNodeWithActivity

    // Step 1: Variables from Convex (as they would come through Temporal)
    const routineVariables = [
      { id: "v1", name: "apiKey", type: "string", value: "sk-123456" },
      { id: "v2", name: "debug", type: "boolean", value: true },
    ];

    // Step 2: Convert variables (as done in buildExecutionGraph)
    const graphVariables: Record<string, unknown> = {};
    for (const v of routineVariables) {
      graphVariables[v.name] = v.value;
    }

    // Step 3: Node parameters (node.config from the static-data node)
    const nodeParameters = {
      data: {
        key: "{{ vars.apiKey }}",
        isDebug: "{{ vars.debug }}",
        nested: {
          value: "{{ vars.apiKey }}",
        },
      },
    };

    // Step 4: Build expression context (as done in executeNodeWithActivity)
    const expressionContext: ExpressionContext = {
      nodes: new Map(),
      vars: graphVariables,
      trigger: {},
      execution: {
        id: "test-exec",
        routineId: "test-routine",
        startedAt: Date.now(),
      },
    };

    // Step 5: Resolve (this is what the workflow should do)
    const resolver = new ExpressionResolver(expressionContext);
    const resolvedConfig = resolver.resolve(nodeParameters);

    // Step 6: Verify
    expect(resolvedConfig).toEqual({
      data: {
        key: "sk-123456",
        isDebug: true,
        nested: {
          value: "sk-123456",
        },
      },
    });
  });

  /**
   * Test serialization/deserialization (Temporal passes data as JSON)
   * This simulates what happens when data goes through Temporal
   */
  it("should work after JSON serialization/deserialization", () => {
    // Simulate Temporal serialization
    const originalVariables = [
      { id: "var-1", name: "haha", type: "string", value: "world" },
    ];

    // Temporal serializes and deserializes to JSON
    const serialized = JSON.stringify(originalVariables);
    const deserializedVariables = JSON.parse(serialized);

    // Convert to vars format
    const vars: Record<string, unknown> = {};
    for (const v of deserializedVariables) {
      vars[v.name] = v.value;
    }

    const context: ExpressionContext = {
      nodes: new Map(),
      vars,
      trigger: {},
      execution: {
        id: "exec-123",
        routineId: "routine-456",
        startedAt: Date.now(),
      },
    };

    // Simulate the node parameters (also goes through JSON serialization)
    const originalParams = { data: { message: "{{ vars.haha }}" } };
    const nodeParameters = JSON.parse(JSON.stringify(originalParams));

    const resolver = new ExpressionResolver(context);
    const resolved = resolver.resolve(nodeParameters);

    expect(resolved).toEqual({
      data: {
        message: "world",
      },
    });
  });

  /**
   * Test regex pattern matching with various character representations
   */
  it("should match expression pattern with various whitespace", () => {
    const context: ExpressionContext = {
      nodes: new Map(),
      vars: { test: "resolved" },
      trigger: {},
      execution: { id: "1", routineId: "1", startedAt: 1 },
    };

    const resolver = new ExpressionResolver(context);

    // Test various whitespace patterns
    expect(resolver.resolve("{{ vars.test }}")).toBe("resolved");
    expect(resolver.resolve("{{vars.test}}")).toBe("resolved");
    expect(resolver.resolve("{{  vars.test  }}")).toBe("resolved");
    expect(resolver.resolve("{{\nvars.test\n}}")).toBe("resolved");
    expect(resolver.resolve("{{\tvars.test\t}}")).toBe("resolved");
  });

  /**
   * Test that hasExpressions correctly identifies expressions
   */
  it("should correctly identify strings containing expressions", () => {
    const context = createEmptyContext();
    const resolver = new ExpressionResolver(context);

    expect(resolver.hasExpressions("{{ vars.haha }}")).toBe(true);
    expect(resolver.hasExpressions("{{vars.haha}}")).toBe(true);
    expect(resolver.hasExpressions("no expression here")).toBe(false);
    expect(resolver.hasExpressions("{ single braces }")).toBe(false);
    expect(resolver.hasExpressions("")).toBe(false);
  });

  /**
   * Test that the ExpressionResolver actually modifies the input
   */
  it("should return different object when expression is resolved", () => {
    const context: ExpressionContext = {
      nodes: new Map(),
      vars: { test: "resolved" },
      trigger: {},
      execution: { id: "1", routineId: "1", startedAt: 1 },
    };

    const input = { value: "{{ vars.test }}" };
    const resolver = new ExpressionResolver(context);
    const output = resolver.resolve(input);

    // Input should not be mutated
    expect(input.value).toBe("{{ vars.test }}");
    // Output should be resolved
    expect(output.value).toBe("resolved");
    // Should not be the same object
    expect(output).not.toBe(input);
  });
});
