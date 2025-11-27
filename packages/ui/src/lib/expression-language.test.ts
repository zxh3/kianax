import { describe, it, expect } from "bun:test";
import {
  containsExpression,
  extractExpressions,
  expressionLanguage,
} from "./expression-language";

describe("containsExpression", () => {
  it("returns false for plain text", () => {
    expect(containsExpression("hello world")).toBe(false);
    expect(containsExpression("")).toBe(false);
    expect(containsExpression("no expressions here")).toBe(false);
  });

  it("returns true for text with expressions", () => {
    expect(containsExpression("{{ vars.name }}")).toBe(true);
    expect(containsExpression("Hello {{ vars.name }}!")).toBe(true);
    expect(containsExpression("{{ nodes.http_1.success }}")).toBe(true);
  });

  it("returns true for multiple expressions", () => {
    expect(containsExpression("{{ vars.a }} and {{ vars.b }}")).toBe(true);
  });

  it("returns false for incomplete expressions", () => {
    expect(containsExpression("{{ vars.name")).toBe(false);
    expect(containsExpression("vars.name }}")).toBe(false);
    expect(containsExpression("{ vars.name }")).toBe(false);
  });
});

describe("extractExpressions", () => {
  it("returns empty array for plain text", () => {
    expect(extractExpressions("hello world")).toEqual([]);
    expect(extractExpressions("")).toEqual([]);
  });

  it("extracts single expression", () => {
    expect(extractExpressions("{{ vars.name }}")).toEqual(["{{ vars.name }}"]);
  });

  it("extracts expression from mixed text", () => {
    expect(extractExpressions("Hello {{ vars.name }}!")).toEqual([
      "{{ vars.name }}",
    ]);
  });

  it("extracts multiple expressions", () => {
    expect(extractExpressions("{{ vars.a }} and {{ vars.b }}")).toEqual([
      "{{ vars.a }}",
      "{{ vars.b }}",
    ]);
  });

  it("extracts expressions with dots and underscores", () => {
    expect(
      extractExpressions("{{ nodes.http_request_1.success.data }}"),
    ).toEqual(["{{ nodes.http_request_1.success.data }}"]);
  });

  it("extracts expressions with array indexing", () => {
    expect(extractExpressions("{{ nodes.loop.items[0].name }}")).toEqual([
      "{{ nodes.loop.items[0].name }}",
    ]);
  });
});

describe("expressionLanguage", () => {
  it("is a valid CodeMirror language", () => {
    // Basic sanity check - the language is defined
    expect(expressionLanguage).toBeDefined();
    expect(expressionLanguage.name).toBe("expression");
  });
});
