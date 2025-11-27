# Variable System Design for Routine Executor

## Overview

This document outlines the design for a variable system that allows nodes in a routine to access data from multiple sources:

1. **Node Outputs** - Access outputs from previously executed nodes
2. **Routine Variables** - Global variables defined at the routine level by the user

## Goals

- Enable dynamic data flow beyond direct port connections
- Allow users to define reusable values at the routine level
- Support expression-based value interpolation in node configurations
- Maintain type safety and validation where possible
- Keep the system simple and intuitive

## Variable Sources

### 1. Node Output Variables

Access the output of any upstream node that has already executed.

**Syntax:** `{{ nodes.<nodeId>.<portName> }}`

**Examples:**
```
{{ nodes.http_request_1.success }}
{{ nodes.static_data.data }}
{{ nodes.openai_chat.response.content }}
```

**Behavior:**
- Only accessible if the source node is upstream (has a path to current node)
- Returns the full output data from the specified port
- Supports dot notation for nested property access
- Returns `undefined` if node hasn't executed or port doesn't exist

### 2. Routine Variables

User-defined variables at the routine level, available to all nodes.

**Syntax:** `{{ vars.<variableName> }}`

**Examples:**
```
{{ vars.apiBaseUrl }}
{{ vars.maxRetries }}
{{ vars.environment }}
```

**Variable Types:**
- `string` - Text values
- `number` - Numeric values
- `boolean` - True/false
- `json` - Complex objects/arrays

### 3. Trigger Data (Existing)

Access data passed when the routine was triggered.

**Syntax:** `{{ trigger.<path> }}`

**Examples:**
```
{{ trigger.webhookPayload.userId }}
{{ trigger.scheduledTime }}
```

### 4. Execution Context

Access execution metadata.

**Syntax:** `{{ execution.<property> }}`

**Examples:**
```
{{ execution.id }}
{{ execution.startedAt }}
{{ execution.routineId }}
```

## Schema Changes

### Routine Schema Update

```typescript
// apps/server/convex/schema.ts

routines: defineTable({
  // ... existing fields ...

  // NEW: Routine-level variables
  variables: v.optional(v.array(v.object({
    id: v.string(),           // Unique identifier
    name: v.string(),         // Variable name (alphanumeric + underscore)
    type: v.union(
      v.literal("string"),
      v.literal("number"),
      v.literal("boolean"),
      v.literal("json")
    ),
    value: v.any(),           // The actual value
    description: v.optional(v.string()),
  }))),
})
```

### Node Configuration Enhancement

Node configurations can now contain expression strings that will be evaluated at runtime.

```typescript
// Example node config with variables
{
  id: "http_1",
  pluginId: "http-request",
  config: {
    url: "{{ vars.apiBaseUrl }}/users/{{ nodes.extract_id.data.userId }}",
    headers: {
      "Authorization": "Bearer {{ vars.apiToken }}",
      "X-Request-Id": "{{ execution.id }}"
    },
    timeout: "{{ vars.defaultTimeout }}"
  }
}
```

## Expression Syntax

### Basic Syntax

```
{{ <source>.<path> }}
```

Where:
- `source` is one of: `nodes`, `vars`, `trigger`, `execution`
- `path` is a dot-separated property path

### Path Notation

Support for:
- Dot notation: `{{ nodes.http_1.success.data.items }}`
- Array indexing: `{{ nodes.loop.items[0].name }}`
- Optional chaining: `{{ nodes.http_1.success?.data }}`

### Filters (Future Enhancement)

```
{{ nodes.http_1.success.data | json }}
{{ vars.name | uppercase }}
{{ nodes.data.items | length }}
```

## Execution Engine Changes

### 1. Expression Resolver

New module: `packages/execution-engine/src/engine/expression-resolver.ts`

```typescript
interface ExpressionContext {
  nodes: Map<string, PortData[]>;      // Node outputs
  vars: Record<string, unknown>;        // Routine variables
  trigger: unknown;                     // Trigger data
  execution: {
    id: string;
    routineId: string;
    startedAt: number;
  };
}

class ExpressionResolver {
  constructor(private context: ExpressionContext) {}

  /**
   * Resolve all expressions in a value.
   * Handles strings, objects, and arrays recursively.
   */
  resolve<T>(value: T): T;

  /**
   * Check if a string contains expressions.
   */
  hasExpressions(value: string): boolean;

  /**
   * Extract all variable references from a value.
   * Useful for dependency analysis.
   */
  extractReferences(value: unknown): VariableReference[];
}
```

### 2. Integration Points

**Before Node Execution:**
```typescript
// In node-executor.ts or iteration-strategy.ts

async function executeNode(node: Node, state: ExecutionState): Promise<NodeExecutionResult> {
  // 1. Build expression context
  const context: ExpressionContext = {
    nodes: state.nodeOutputs,
    vars: graph.routineVariables,
    trigger: graph.triggerData,
    execution: {
      id: state.executionId,
      routineId: graph.routineId,
      startedAt: state.startedAt,
    }
  };

  // 2. Resolve expressions in node config
  const resolver = new ExpressionResolver(context);
  const resolvedConfig = resolver.resolve(node.parameters);

  // 3. Execute plugin with resolved config
  return executePlugin({
    ...node,
    parameters: resolvedConfig
  });
}
```

### 3. Dependency Validation

Ensure nodes only reference upstream node outputs:

```typescript
function validateNodeExpressions(
  node: Node,
  upstreamNodeIds: Set<string>,
  routineVariables: Variable[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const refs = extractReferences(node.parameters);

  for (const ref of refs) {
    if (ref.source === 'nodes' && !upstreamNodeIds.has(ref.nodeId)) {
      errors.push({
        nodeId: node.id,
        message: `Cannot reference node "${ref.nodeId}" - not upstream`,
        path: ref.path
      });
    }

    if (ref.source === 'vars' && !routineVariables.find(v => v.name === ref.name)) {
      errors.push({
        nodeId: node.id,
        message: `Unknown variable "${ref.name}"`,
        path: ref.path
      });
    }
  }

  return errors;
}
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Routine                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Variables                                                │   │
│  │  - apiBaseUrl: "https://api.example.com"                │   │
│  │  - maxRetries: 3                                        │   │
│  │  - debug: true                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐              │
│  │  Node A  │─────▶│  Node B  │─────▶│  Node C  │              │
│  │          │      │          │      │          │              │
│  │ output:  │      │ config:  │      │ config:  │              │
│  │ {userId} │      │ url:     │      │ retries: │              │
│  └──────────┘      │ {{vars.  │      │ {{vars.  │              │
│                    │ apiBase  │      │ maxRetr  │              │
│                    │ Url}}/   │      │ ies}}    │              │
│                    │ users/   │      └──────────┘              │
│                    │ {{nodes. │                                 │
│                    │ A.output │                                 │
│                    │ .userId}}│                                 │
│                    └──────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Expression System ✅ COMPLETE
- [x] Implement `ExpressionResolver` class
- [x] Add expression parsing (regex-based)
- [x] Support basic path resolution (dot notation)
- [x] Integrate into node execution flow (Temporal workflow)
- [x] Add unit tests (51 tests)
- [x] Add integration tests for workflow flow

### Phase 2: Routine Variables ✅ COMPLETE
- [x] Update Convex schema for `variables` field
- [x] Add CRUD mutations for routine variables
- [x] Update routine editor to manage variables (VariablesPanel component)
- [x] Pass variables to execution engine
- [x] Add expression syntax documentation to plugin config UIs

### Phase 3: Validation & Tooling 🔲 TODO
- [ ] Validate expressions at save time
- [ ] Check for undefined variables
- [ ] Verify upstream node references
- [ ] Add validation errors to UI

### Phase 4: UI Enhancements 🚧 IN PROGRESS
- [x] Variable management panel
- [ ] Expression input component with autocomplete
- [ ] Syntax highlighting for expressions
- [ ] Preview resolved values in editor

### Phase 5: Advanced Features (Future)
- [x] Array indexing in paths
- [ ] Filter functions (json, uppercase, etc.)
- [ ] Conditional expressions
- [ ] Default values: `{{ vars.timeout ?? 30000 }}`

## Security Considerations

1. **No Code Execution** - Expressions are data access only, not arbitrary code
2. **Sandboxed Resolution** - Expression resolver has no access to system resources
3. **Credential Isolation** - Variables cannot access credentials directly
4. **Input Validation** - Variable names must be alphanumeric + underscore
5. **Output Sanitization** - Consider escaping when used in certain contexts

## Error Handling

### Expression Errors

```typescript
type ExpressionError = {
  type: 'PARSE_ERROR' | 'REFERENCE_ERROR' | 'TYPE_ERROR';
  expression: string;
  message: string;
  path?: string;
};
```

### Runtime Behavior

| Scenario | Behavior |
|----------|----------|
| Unknown variable | Return `undefined`, log warning |
| Invalid path | Return `undefined`, log warning |
| Type mismatch | Attempt coercion, or return as-is |
| Circular reference | Detect at validation, block execution |
| Missing upstream node | Block execution with error |

## Appendix: Expression Grammar

```ebnf
expression     = "{{" whitespace? reference whitespace? "}}"
reference      = source "." path
source         = "nodes" | "vars" | "trigger" | "execution"
path           = segment ("." segment)*
segment        = identifier | array_access
identifier     = [a-zA-Z_][a-zA-Z0-9_]*
array_access   = identifier "[" index "]"
index          = [0-9]+
whitespace     = [ \t\n\r]+
```

## Open Questions

1. **Nested expressions** - Should `{{ vars.{{ nodes.a.key }} }}` be supported? (Recommendation: No, keep it simple)

2. **Expression in port connections** - Should expressions work in edge definitions? (Recommendation: No, use dedicated transformer nodes)

3. **Variable scoping** - Should there be node-local variables? (Recommendation: Not in Phase 1, evaluate need later)

4. **Type coercion** - How strict should type checking be? (Recommendation: Loose coercion with warnings)

5. **Sensitive variables** - Should there be a "secret" variable type? (Recommendation: Use credentials system instead)
