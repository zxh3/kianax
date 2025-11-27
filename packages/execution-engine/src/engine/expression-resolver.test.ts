import { describe, it, expect, beforeEach } from "vitest";
import {
  ExpressionResolver,
  type ExpressionContext,
  createEmptyContext,
} from "./expression-resolver.js";

describe("ExpressionResolver", () => {
  let context: ExpressionContext;
  let resolver: ExpressionResolver;

  beforeEach(() => {
    context = createEmptyContext();
    context.execution = {
      id: "exec-123",
      routineId: "routine-456",
      startedAt: 1700000000000,
    };
    context.vars = {
      apiUrl: "https://api.example.com",
      maxRetries: 3,
      debug: true,
      config: {
        timeout: 5000,
        headers: {
          "X-Custom": "value",
        },
      },
    };
    context.trigger = {
      type: "webhook",
      payload: {
        userId: "user-789",
        action: "create",
      },
    };
    context.nodes.set("http_1", [
      {
        portName: "success",
        items: [
          {
            data: {
              status: 200,
              body: {
                id: "item-1",
                name: "Test Item",
                tags: ["a", "b", "c"],
              },
            },
            metadata: {},
          },
        ],
      },
      {
        portName: "error",
        items: [],
      },
    ]);
    context.nodes.set("transform_1", [
      {
        portName: "output",
        items: [
          {
            data: ["item1", "item2", "item3"],
            metadata: {},
          },
        ],
      },
    ]);

    resolver = new ExpressionResolver(context);
  });

  describe("resolve()", () => {
    describe("primitive values", () => {
      it("should pass through null", () => {
        expect(resolver.resolve(null)).toBe(null);
      });

      it("should pass through undefined", () => {
        expect(resolver.resolve(undefined)).toBe(undefined);
      });

      it("should pass through numbers", () => {
        expect(resolver.resolve(42)).toBe(42);
      });

      it("should pass through booleans", () => {
        expect(resolver.resolve(true)).toBe(true);
      });

      it("should pass through strings without expressions", () => {
        expect(resolver.resolve("hello world")).toBe("hello world");
      });
    });

    describe("vars expressions", () => {
      it("should resolve simple var reference", () => {
        expect(resolver.resolve("{{ vars.apiUrl }}")).toBe(
          "https://api.example.com",
        );
      });

      it("should resolve numeric var", () => {
        expect(resolver.resolve("{{ vars.maxRetries }}")).toBe(3);
      });

      it("should resolve boolean var", () => {
        expect(resolver.resolve("{{ vars.debug }}")).toBe(true);
      });

      it("should resolve nested var path", () => {
        expect(resolver.resolve("{{ vars.config.timeout }}")).toBe(5000);
      });

      it("should resolve deeply nested var", () => {
        expect(resolver.resolve("{{ vars.config.headers.X-Custom }}")).toBe(
          "value",
        );
      });

      it("should return undefined for unknown var", () => {
        expect(resolver.resolve("{{ vars.unknown }}")).toBe(undefined);
      });

      it("should return all vars when just vars is used", () => {
        expect(resolver.resolve("{{ vars }}")).toEqual(context.vars);
      });
    });

    describe("nodes expressions", () => {
      it("should resolve node output", () => {
        const result = resolver.resolve("{{ nodes.http_1.success }}");
        expect(result).toEqual({
          status: 200,
          body: {
            id: "item-1",
            name: "Test Item",
            tags: ["a", "b", "c"],
          },
        });
      });

      it("should resolve nested node output path", () => {
        expect(resolver.resolve("{{ nodes.http_1.success.status }}")).toBe(200);
      });

      it("should resolve deeply nested node output", () => {
        expect(resolver.resolve("{{ nodes.http_1.success.body.name }}")).toBe(
          "Test Item",
        );
      });

      it("should return undefined for unknown node", () => {
        expect(resolver.resolve("{{ nodes.unknown.output }}")).toBe(undefined);
      });

      it("should return undefined for unknown port", () => {
        expect(resolver.resolve("{{ nodes.http_1.unknown }}")).toBe(undefined);
      });

      it("should return undefined for empty port", () => {
        expect(resolver.resolve("{{ nodes.http_1.error }}")).toBe(undefined);
      });

      it("should return all outputs when just nodeId is used", () => {
        const result = resolver.resolve("{{ nodes.http_1 }}");
        expect(result).toEqual({
          success: {
            status: 200,
            body: {
              id: "item-1",
              name: "Test Item",
              tags: ["a", "b", "c"],
            },
          },
        });
      });
    });

    describe("trigger expressions", () => {
      it("should resolve trigger data", () => {
        expect(resolver.resolve("{{ trigger.type }}")).toBe("webhook");
      });

      it("should resolve nested trigger path", () => {
        expect(resolver.resolve("{{ trigger.payload.userId }}")).toBe(
          "user-789",
        );
      });

      it("should return all trigger data when just trigger is used", () => {
        expect(resolver.resolve("{{ trigger }}")).toEqual(context.trigger);
      });
    });

    describe("execution expressions", () => {
      it("should resolve execution id", () => {
        expect(resolver.resolve("{{ execution.id }}")).toBe("exec-123");
      });

      it("should resolve execution routineId", () => {
        expect(resolver.resolve("{{ execution.routineId }}")).toBe(
          "routine-456",
        );
      });

      it("should resolve execution startedAt", () => {
        expect(resolver.resolve("{{ execution.startedAt }}")).toBe(
          1700000000000,
        );
      });
    });

    describe("string interpolation", () => {
      it("should interpolate expression in string", () => {
        expect(resolver.resolve("API: {{ vars.apiUrl }}/users")).toBe(
          "API: https://api.example.com/users",
        );
      });

      it("should interpolate multiple expressions", () => {
        expect(
          resolver.resolve(
            "{{ vars.apiUrl }}/users/{{ trigger.payload.userId }}",
          ),
        ).toBe("https://api.example.com/users/user-789");
      });

      it("should handle mixed content with expressions", () => {
        expect(
          resolver.resolve(
            "Status: {{ nodes.http_1.success.status }}, Retries: {{ vars.maxRetries }}",
          ),
        ).toBe("Status: 200, Retries: 3");
      });

      it("should stringify objects in interpolation", () => {
        const result = resolver.resolve(
          "Data: {{ nodes.http_1.success.body }}",
        );
        expect(result).toBe(
          'Data: {"id":"item-1","name":"Test Item","tags":["a","b","c"]}',
        );
      });

      it("should handle undefined in interpolation as empty string", () => {
        expect(resolver.resolve("Value: {{ vars.unknown }}")).toBe("Value: ");
      });
    });

    describe("array indexing", () => {
      it("should resolve array index", () => {
        expect(
          resolver.resolve("{{ nodes.http_1.success.body.tags[0] }}"),
        ).toBe("a");
      });

      it("should resolve array index in middle of path", () => {
        expect(resolver.resolve("{{ nodes.transform_1.output[1] }}")).toBe(
          "item2",
        );
      });

      it("should return undefined for out of bounds index", () => {
        expect(
          resolver.resolve("{{ nodes.http_1.success.body.tags[99] }}"),
        ).toBe(undefined);
      });
    });

    describe("objects and arrays", () => {
      it("should resolve expressions in object values", () => {
        const input = {
          url: "{{ vars.apiUrl }}",
          timeout: "{{ vars.config.timeout }}",
          userId: "{{ trigger.payload.userId }}",
        };
        expect(resolver.resolve(input)).toEqual({
          url: "https://api.example.com",
          timeout: 5000,
          userId: "user-789",
        });
      });

      it("should resolve expressions in nested objects", () => {
        const input = {
          request: {
            url: "{{ vars.apiUrl }}/items",
            headers: {
              "X-Request-Id": "{{ execution.id }}",
            },
          },
        };
        expect(resolver.resolve(input)).toEqual({
          request: {
            url: "https://api.example.com/items",
            headers: {
              "X-Request-Id": "exec-123",
            },
          },
        });
      });

      it("should resolve expressions in arrays", () => {
        const input = ["{{ vars.apiUrl }}", "{{ trigger.type }}", "static"];
        expect(resolver.resolve(input)).toEqual([
          "https://api.example.com",
          "webhook",
          "static",
        ]);
      });

      it("should handle mixed objects and arrays", () => {
        const input = {
          items: [
            { url: "{{ vars.apiUrl }}" },
            { url: "{{ vars.apiUrl }}/v2" },
          ],
          count: "{{ vars.maxRetries }}",
        };
        expect(resolver.resolve(input)).toEqual({
          items: [
            { url: "https://api.example.com" },
            { url: "https://api.example.com/v2" },
          ],
          count: 3,
        });
      });
    });

    describe("edge cases", () => {
      it("should handle whitespace in expressions", () => {
        expect(resolver.resolve("{{  vars.apiUrl  }}")).toBe(
          "https://api.example.com",
        );
        expect(resolver.resolve("{{vars.apiUrl}}")).toBe(
          "https://api.example.com",
        );
      });

      it("should handle empty expression", () => {
        expect(resolver.resolve("{{}}")).toBe("{{}}");
      });

      it("should handle invalid source", () => {
        expect(resolver.resolve("{{ invalid.path }}")).toBe(undefined);
      });

      it("should preserve non-expression braces", () => {
        expect(resolver.resolve("{ not an expression }")).toBe(
          "{ not an expression }",
        );
      });
    });
  });

  describe("hasExpressions()", () => {
    it("should return true for string with expression", () => {
      expect(resolver.hasExpressions("{{ vars.test }}")).toBe(true);
    });

    it("should return true for string with multiple expressions", () => {
      expect(resolver.hasExpressions("{{ vars.a }} and {{ vars.b }}")).toBe(
        true,
      );
    });

    it("should return false for plain string", () => {
      expect(resolver.hasExpressions("hello world")).toBe(false);
    });

    it("should return false for single braces", () => {
      expect(resolver.hasExpressions("{ not expression }")).toBe(false);
    });
  });

  describe("extractReferences()", () => {
    it("should extract single reference", () => {
      const refs = resolver.extractReferences("{{ vars.apiUrl }}");
      expect(refs).toHaveLength(1);
      expect(refs[0]).toEqual({
        source: "vars",
        path: ["apiUrl"],
        expression: "{{ vars.apiUrl }}",
      });
    });

    it("should extract multiple references", () => {
      const refs = resolver.extractReferences(
        "{{ vars.apiUrl }}/{{ trigger.payload.userId }}",
      );
      expect(refs).toHaveLength(2);
      expect(refs[0]?.source).toBe("vars");
      expect(refs[1]?.source).toBe("trigger");
    });

    it("should extract node references with nodeId and portName", () => {
      const refs = resolver.extractReferences(
        "{{ nodes.http_1.success.data }}",
      );
      expect(refs).toHaveLength(1);
      expect(refs[0]).toEqual({
        source: "nodes",
        path: ["http_1", "success", "data"],
        expression: "{{ nodes.http_1.success.data }}",
        nodeId: "http_1",
        portName: "success",
      });
    });

    it("should extract references from objects", () => {
      const refs = resolver.extractReferences({
        url: "{{ vars.apiUrl }}",
        nested: {
          id: "{{ execution.id }}",
        },
      });
      expect(refs).toHaveLength(2);
    });

    it("should extract references from arrays", () => {
      const refs = resolver.extractReferences([
        "{{ vars.a }}",
        "{{ vars.b }}",
        "static",
      ]);
      expect(refs).toHaveLength(2);
    });

    it("should return empty array for no references", () => {
      const refs = resolver.extractReferences("no expressions here");
      expect(refs).toHaveLength(0);
    });
  });
});
