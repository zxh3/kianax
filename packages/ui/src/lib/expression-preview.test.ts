import { describe, it, expect } from "bun:test";
import {
  resolvePreview,
  containsExpression,
  formatPreviewValue,
  type PreviewContext,
} from "./expression-preview";

describe("resolvePreview", () => {
  const context: PreviewContext = {
    vars: {
      baseUrl: "https://api.example.com",
      count: 42,
      enabled: true,
      config: { timeout: 5000, retries: 3 },
    },
    nodes: {
      http_1: {
        data: { status: 200, body: "Hello" },
        error: null,
      },
      transform_1: {
        output: [1, 2, 3],
      },
    },
    trigger: {
      payload: { userId: "user-123" },
      type: "webhook",
    },
    execution: {
      id: "exec-abc",
      routineId: "routine-xyz",
      startedAt: 1700000000000,
    },
  };

  describe("vars expressions", () => {
    it("resolves string variable", () => {
      const result = resolvePreview("{{ vars.baseUrl }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toBe("https://api.example.com");
      expect(result.type).toBe("string");
    });

    it("resolves number variable", () => {
      const result = resolvePreview("{{ vars.count }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
      expect(result.type).toBe("number");
    });

    it("resolves boolean variable", () => {
      const result = resolvePreview("{{ vars.enabled }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
      expect(result.type).toBe("boolean");
    });

    it("resolves nested object property", () => {
      const result = resolvePreview("{{ vars.config.timeout }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(5000);
      expect(result.type).toBe("number");
    });

    it("returns object for object variable", () => {
      const result = resolvePreview("{{ vars.config }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ timeout: 5000, retries: 3 });
      expect(result.type).toBe("object");
    });
  });

  describe("nodes expressions", () => {
    it("resolves node port data", () => {
      const result = resolvePreview("{{ nodes.http_1.data }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ status: 200, body: "Hello" });
      expect(result.type).toBe("object");
    });

    it("resolves nested node data", () => {
      const result = resolvePreview("{{ nodes.http_1.data.status }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(200);
      expect(result.type).toBe("number");
    });

    it("resolves array output", () => {
      const result = resolvePreview("{{ nodes.transform_1.output }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toEqual([1, 2, 3]);
      expect(result.type).toBe("array");
    });

    it("returns error for missing node", () => {
      const result = resolvePreview("{{ nodes.missing_node.data }}", context);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Node not found");
    });

    it("returns error for missing port", () => {
      const result = resolvePreview("{{ nodes.http_1.missing }}", context);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Port not found");
    });
  });

  describe("trigger expressions", () => {
    it("resolves trigger payload", () => {
      const result = resolvePreview("{{ trigger.payload.userId }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toBe("user-123");
    });

    it("resolves trigger type", () => {
      const result = resolvePreview("{{ trigger.type }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toBe("webhook");
    });
  });

  describe("execution expressions", () => {
    it("resolves execution id", () => {
      const result = resolvePreview("{{ execution.id }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toBe("exec-abc");
    });

    it("resolves execution routineId", () => {
      const result = resolvePreview("{{ execution.routineId }}", context);
      expect(result.success).toBe(true);
      expect(result.value).toBe("routine-xyz");
    });
  });

  describe("string interpolation", () => {
    it("interpolates multiple expressions", () => {
      const result = resolvePreview(
        "URL: {{ vars.baseUrl }}/users/{{ vars.count }}",
        context,
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe("URL: https://api.example.com/users/42");
      expect(result.type).toBe("string");
    });

    it("handles mixed content", () => {
      const result = resolvePreview(
        "Count is {{ vars.count }} and enabled is {{ vars.enabled }}",
        context,
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe("Count is 42 and enabled is true");
    });
  });

  describe("error handling", () => {
    it("returns error for invalid source", () => {
      const result = resolvePreview("{{ invalid.path }}", context);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown source");
    });
  });
});

describe("containsExpression", () => {
  it("returns true for string with expression", () => {
    expect(containsExpression("Hello {{ vars.name }}")).toBe(true);
  });

  it("returns false for plain string", () => {
    expect(containsExpression("Hello world")).toBe(false);
  });

  it("returns true for multiple expressions", () => {
    expect(containsExpression("{{ vars.a }} and {{ vars.b }}")).toBe(true);
  });
});

describe("formatPreviewValue", () => {
  it("formats string with quotes", () => {
    expect(formatPreviewValue("hello")).toBe('"hello"');
  });

  it("truncates long strings", () => {
    const long = "a".repeat(100);
    const formatted = formatPreviewValue(long, 50);
    expect(formatted.length).toBeLessThan(60);
    expect(formatted).toContain("...");
  });

  it("formats numbers directly", () => {
    expect(formatPreviewValue(42)).toBe("42");
  });

  it("formats booleans directly", () => {
    expect(formatPreviewValue(true)).toBe("true");
  });

  it("formats null and undefined", () => {
    expect(formatPreviewValue(null)).toBe("null");
    expect(formatPreviewValue(undefined)).toBe("undefined");
  });

  it("formats arrays with count", () => {
    expect(formatPreviewValue([1, 2, 3])).toBe("Array(3)");
  });

  it("formats objects with keys", () => {
    expect(formatPreviewValue({ a: 1, b: 2 })).toBe("{a, b}");
  });

  it("truncates objects with many keys", () => {
    const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    const formatted = formatPreviewValue(obj);
    expect(formatted).toContain("...");
  });
});
