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

### Phase 3: Validation & Tooling ✅ COMPLETE
- [x] Validate expressions at save time
- [x] Check for undefined variables
- [x] Verify upstream node references
- [x] Add validation errors to UI (ValidationPanel component)

### Phase 4: UI Enhancements 🚧 IN PROGRESS
- [x] Variable management panel
- [x] Expression input component with autocomplete (CodeMirror 6)
- [x] Syntax highlighting for expressions
- [x] Preview resolved values in editor (debounced)
- [x] ExpressionContextProvider with upstream node detection
- [ ] Pass context through NodeConfigDrawer
- [ ] Plugin config UI migration (ExpressionField wrapper)

---

## Phase 4: UI Enhancements - Detailed Design

### Problem Statement

Currently, users must manually type expression syntax (`{{ vars.name }}`, `{{ nodes.id.port }}`) without any assistance. This creates friction:

1. **Discovery** - Users don't know what variables/nodes are available
2. **Accuracy** - Typos in variable names or node IDs cause runtime failures
3. **Feedback** - No indication if an expression is valid until execution
4. **Context switching** - Must reference Variables panel or node labels while typing

### Goals

1. **Zero-friction expression authoring** - Autocomplete suggests valid references
2. **Immediate validation feedback** - Visual indication of expression validity
3. **Live preview** - See resolved values before execution
4. **Progressive enhancement** - Existing plugin UIs work unchanged; opt-in for new features

### Non-Goals

- Full IDE-like editing experience (code folding, multi-cursor, etc.)
- Expression debugging/stepping
- Complex expression builder UI (drag-drop)

---

### Technology Choice: CodeMirror 6

**Why CodeMirror 6 over custom overlay:**

| Consideration | Custom Overlay | CodeMirror 6 |
|---------------|----------------|--------------|
| Multi-line support | Complex scroll sync | Built-in |
| Cursor-aware highlighting | Manual implementation | Built-in |
| Autocomplete positioning | Manual calculation | Built-in |
| IME/composition handling | Edge cases | Handled |
| Accessibility | Manual ARIA | Built-in |
| Bundle size | ~0KB | ~100KB (lazy-loaded) |

Given the need for multi-line support (e.g., JSON fields in Static Data plugin), CodeMirror 6 is the right choice. The bundle cost is mitigated by lazy-loading the component.

**Key CodeMirror 6 packages:**
- `codemirror` - Core editor
- `@codemirror/autocomplete` - Autocomplete system
- `@codemirror/language` - Syntax highlighting infrastructure
- `@codemirror/view` - Editor view and theming

---

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ExpressionInput                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ CodeMirror EditorView                                          │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Content with syntax highlighting                        │  │  │
│  │  │                                                         │  │  │
│  │  │  Static text {{ vars.apiUrl }}/users/{{ nodes.id }}    │  │  │
│  │  │              ↑_______________↑       ↑____________↑      │  │  │
│  │  │              highlighted      highlighted               │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  Extensions:                                                   │  │
│  │   • expressionLanguage() - custom language for {{ }} syntax   │  │
│  │   • autocompletion() - triggered by {{ with context-aware     │  │
│  │   • editorTheme - matches shadcn/ui design system             │  │
│  │   • singleLine (optional) - restricts to one line             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Autocomplete dropdown (CodeMirror built-in positioning)        │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  § Variables                                            │  │  │
│  │  │    vars.apiUrl         string   "https://..."           │  │  │
│  │  │    vars.maxRetries     number   3                       │  │  │
│  │  │  § Upstream Nodes                                       │  │  │
│  │  │    nodes.http_1.success   object                        │  │  │
│  │  │    nodes.static_data.data object                        │  │  │
│  │  │  § Context                                              │  │  │
│  │  │    trigger.payload        object                        │  │  │
│  │  │    execution.id           string                        │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.1 ExpressionInput Component

**Location:** `packages/ui/src/components/expression-input.tsx`

**Purpose:** Drop-in replacement for Input/Textarea that provides expression-aware editing with autocomplete, syntax highlighting, and live preview.

#### API Design

```typescript
interface ExpressionInputProps {
  /** Current value (may contain {{ expressions }}) */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;

  /** Expression context for autocomplete suggestions */
  context?: ExpressionContext;

  /** Show live preview of resolved value */
  showPreview?: boolean;
  /** Context for resolving preview (subset of runtime context) */
  previewContext?: PreviewContext;

  /** Multi-line mode (renders as textarea) */
  multiline?: boolean;
  /** Number of rows for multiline */
  rows?: number;

  /** Standard input props */
  placeholder?: string;
  disabled?: boolean;
  className?: string;

  /** Validation error message */
  error?: string;
}

interface ExpressionContext {
  /** Available routine variables */
  variables: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "json";
    value: unknown;
    description?: string;
  }>;

  /** Upstream nodes with their output ports */
  upstreamNodes: Array<{
    id: string;
    label: string;
    pluginId: string;
    /** Output port names (e.g., ["success", "error"]) */
    outputs: string[];
  }>;

  /** Whether trigger context is available */
  hasTrigger?: boolean;
}

interface PreviewContext {
  vars: Record<string, unknown>;
  nodes: Record<string, Record<string, unknown>>;
  trigger?: unknown;
  execution?: { id: string; routineId: string; startedAt: number };
}
```

#### Behavior Specification

| Trigger | Action |
|---------|--------|
| Type `{{` | Open autocomplete popover |
| Type `{{` then space/letter | Filter suggestions by typed text |
| Arrow keys in popover | Navigate suggestions |
| Enter/Tab on suggestion | Insert selected reference, close popover |
| Escape | Close popover without inserting |
| Click outside | Close popover |
| Blur input | Close popover, validate expression |
| Type `}}` | Close any open expression, validate |

#### Visual States

| State | Appearance |
|-------|------------|
| Empty | Placeholder text, no decoration |
| Static text only | Normal input appearance |
| Valid expression | Expression highlighted in primary color |
| Invalid expression | Expression highlighted in destructive color |
| Resolving preview | Spinner in preview badge |
| Preview available | Truncated value in muted badge |
| Preview error | "Error" badge in destructive color |

#### Implementation Notes

1. **CodeMirror 6 Setup:**
   ```typescript
   import { EditorView, minimalSetup } from "codemirror";
   import { autocompletion } from "@codemirror/autocomplete";
   import { LanguageSupport, StreamLanguage } from "@codemirror/language";

   // Custom language for expression highlighting
   const expressionLanguage = StreamLanguage.define({
     token(stream) {
       if (stream.match("{{")) return "brace";
       if (stream.match("}}")) return "brace";
       if (stream.match(/vars|nodes|trigger|execution/)) return "keyword";
       if (stream.match(/\./)) return "punctuation";
       if (stream.match(/[a-zA-Z_][a-zA-Z0-9_]*/)) return "variableName";
       stream.next();
       return null;
     }
   });
   ```

2. **Autocomplete trigger detection:**
   - CodeMirror's `autocompletion` extension handles cursor position
   - Custom `completionSource` function triggers on `{{` pattern
   - Returns grouped completions (Variables, Upstream Nodes, Context)

3. **Single-line mode:**
   ```typescript
   // Prevent Enter key from inserting newlines
   const singleLineExtension = EditorView.domEventHandlers({
     keydown(event) {
       if (event.key === "Enter") {
         event.preventDefault();
         return true;
       }
       return false;
     }
   });
   ```

4. **Theming to match shadcn/ui:**
   ```typescript
   const shadcnTheme = EditorView.theme({
     "&": {
       fontSize: "14px",
       border: "1px solid hsl(var(--input))",
       borderRadius: "calc(var(--radius) - 2px)",
       backgroundColor: "hsl(var(--background))",
     },
     "&.cm-focused": {
       outline: "2px solid hsl(var(--ring))",
       outlineOffset: "2px",
     },
     ".cm-content": {
       padding: "8px 12px",
       fontFamily: "inherit",
     },
     ".cm-line": {
       padding: "0",
     },
   });
   ```

5. **Preview debouncing:**
   - 300ms debounce on value changes
   - Cancel pending preview on new input
   - Show resolved value in footer or tooltip

6. **Lazy loading:**
   ```typescript
   // In consuming components
   const ExpressionInput = lazy(() =>
     import("@kianax/ui/components/expression-input")
   );

   <Suspense fallback={<Textarea ... />}>
     <ExpressionInput ... />
   </Suspense>
   ```

---

### 4.2 ExpressionContext Provider

**Location:** `apps/web/components/routines/routine-editor/expression-context.tsx`

**Purpose:** React context that provides expression metadata to all descendant components, eliminating prop drilling.

#### API Design

```typescript
interface ExpressionContextValue {
  /** All routine variables */
  variables: RoutineVariable[];

  /** All nodes in the routine */
  allNodes: Array<{
    id: string;
    label: string;
    pluginId: string;
    outputs: string[];
  }>;

  /** Get upstream nodes for a specific node */
  getUpstreamNodes: (nodeId: string) => ExpressionContext["upstreamNodes"];

  /** Get preview context for a specific node */
  getPreviewContext: (nodeId: string) => PreviewContext | null;

  /** Validate an expression for a specific node */
  validateExpression: (nodeId: string, expression: string) => ValidationResult;
}

const ExpressionContextProvider: React.FC<{
  routineId: string;
  nodes: RoutineNode[];
  connections: RoutineConnection[];
  variables: RoutineVariable[];
  children: React.ReactNode;
}>;

const useExpressionContext: () => ExpressionContextValue;
```

#### Integration Point

```tsx
// In RoutineEditor
<ExpressionContextProvider
  routineId={routineId}
  nodes={nodes}
  connections={connections}
  variables={variables}
>
  <ReactFlow ... />
  <NodeConfigDrawer ... />
</ExpressionContextProvider>
```

---

### 4.3 Enhanced NodeConfigDrawer

**Location:** `apps/web/components/routines/node-config-drawer.tsx`

**Changes:**

1. **Pass expression context to plugin config UI:**

```typescript
interface PluginConfigProps<T = unknown> {
  value?: T;
  onChange: (value: T) => void;

  // NEW: Expression context for this node
  expressionContext?: {
    variables: RoutineVariable[];
    upstreamNodes: UpstreamNode[];
  };
}
```

2. **Compute upstream nodes from connections:**

```typescript
const upstreamNodes = useMemo(() => {
  return computeUpstreamNodes(nodeId, allNodes, connections);
}, [nodeId, allNodes, connections]);
```

3. **Pass context to config component:**

```tsx
const ConfigComponent = getPluginConfigComponent(pluginId);
return (
  <ConfigComponent
    value={localConfig}
    onChange={setLocalConfig}
    expressionContext={{
      variables,
      upstreamNodes,
    }}
  />
);
```

---

### 4.4 Plugin Config UI Migration

**Strategy:** Progressive enhancement - plugins opt-in to expression support.

#### Option A: ExpressionInput wrapper (Recommended)

Create `ExpressionField` component in `packages/plugins/ui/`:

```tsx
// packages/plugins/ui/expression-field.tsx

interface ExpressionFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  error?: string;
}

export function ExpressionField({
  label,
  description,
  value,
  onChange,
  multiline,
  placeholder,
  error,
}: ExpressionFieldProps) {
  // Get context from provider (if available)
  const expressionContext = useExpressionContext();

  return (
    <ConfigSection label={label} description={description} error={error}>
      <ExpressionInput
        value={value}
        onChange={onChange}
        context={expressionContext}
        multiline={multiline}
        placeholder={placeholder}
        showPreview
      />
    </ConfigSection>
  );
}
```

#### Plugin Migration Example

Before:
```tsx
<ConfigSection label="URL" description="API endpoint">
  <Input
    value={config.url}
    onChange={(e) => handleChange({ url: e.target.value })}
    placeholder="https://api.example.com"
  />
</ConfigSection>
```

After:
```tsx
<ExpressionField
  label="URL"
  description="API endpoint. Supports {{ vars.* }} and {{ nodes.* }}"
  value={config.url}
  onChange={(url) => handleChange({ url })}
  placeholder="https://api.example.com"
/>
```

---

### 4.5 Syntax Highlighting Implementation

**Approach:** CodeMirror 6 StreamLanguage with custom tokenizer

#### Token Types & Styles

| Token | CM Tag | CSS Variable | Example |
|-------|--------|--------------|---------|
| Expression delimiters | `brace` | `--expr-brace` | `{{`, `}}` |
| Source keyword | `keyword` | `--expr-keyword` | `vars`, `nodes` |
| Identifier | `variableName` | `--expr-variable` | `apiUrl`, `http_1` |
| Dot separator | `punctuation` | `--expr-punctuation` | `.` |
| Array bracket | `squareBracket` | `--expr-bracket` | `[`, `]` |
| Array index | `number` | `--expr-number` | `0`, `42` |
| Plain text | (none) | inherited | Everything outside `{{ }}` |

#### CodeMirror Language Definition

```typescript
// packages/ui/src/lib/expression-language.ts

import { StreamLanguage } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const expressionLanguage = StreamLanguage.define({
  name: "expression",

  token(stream, state) {
    // Match expression delimiters
    if (stream.match("{{")) {
      state.inExpression = true;
      return "brace";
    }
    if (stream.match("}}")) {
      state.inExpression = false;
      return "brace";
    }

    // Inside expression: highlight tokens
    if (state.inExpression) {
      // Source keywords
      if (stream.match(/vars|nodes|trigger|execution/)) {
        return "keyword";
      }
      // Dot separator
      if (stream.match(".")) {
        return "punctuation";
      }
      // Array access
      if (stream.match("[")) {
        return "squareBracket";
      }
      if (stream.match("]")) {
        return "squareBracket";
      }
      if (stream.match(/\d+/)) {
        return "number";
      }
      // Identifiers (variable names, node IDs, port names)
      if (stream.match(/[a-zA-Z_][a-zA-Z0-9_-]*/)) {
        return "variableName";
      }
      // Skip whitespace inside expression
      if (stream.match(/\s+/)) {
        return null;
      }
    }

    // Outside expression: plain text (no highlighting)
    stream.next();
    return null;
  },

  startState() {
    return { inExpression: false };
  },
});
```

#### Highlight Style

```typescript
// packages/ui/src/lib/expression-highlight.ts

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const expressionHighlightStyle = HighlightStyle.define([
  { tag: tags.brace, color: "hsl(var(--primary))", fontWeight: "600" },
  { tag: tags.keyword, color: "hsl(var(--chart-1))", fontWeight: "500" },
  { tag: tags.variableName, color: "hsl(var(--foreground))" },
  { tag: tags.punctuation, color: "hsl(var(--muted-foreground))" },
  { tag: tags.squareBracket, color: "hsl(var(--primary))" },
  { tag: tags.number, color: "hsl(var(--chart-4))" },
]);

export const expressionHighlight = syntaxHighlighting(expressionHighlightStyle);
```

---

### 4.6 Live Preview Implementation

**Approach:** Client-side expression resolution with mock context

#### Preview Context Construction

```typescript
function buildPreviewContext(
  nodeId: string,
  variables: RoutineVariable[],
  upstreamNodes: UpstreamNode[],
  lastExecutionResults?: ExecutionResults
): PreviewContext {
  return {
    vars: Object.fromEntries(
      variables.map(v => [v.name, v.value])
    ),
    nodes: Object.fromEntries(
      upstreamNodes.map(node => [
        node.id,
        // Use last execution results if available, else mock
        lastExecutionResults?.[node.id] ?? {
          success: { /* mock based on plugin output schema */ },
          error: null
        }
      ])
    ),
    trigger: { payload: { /* sample */ } },
    execution: {
      id: "preview-exec-id",
      routineId: "preview-routine-id",
      startedAt: Date.now(),
    },
  };
}
```

#### Preview Display

| Resolved Type | Display |
|---------------|---------|
| `string` | Truncated to 30 chars with ellipsis |
| `number` | Formatted number |
| `boolean` | "true" or "false" badge |
| `object/array` | "{...}" or "[...]" with item count |
| `undefined` | "undefined" in muted text |
| `null` | "null" in muted text |
| Error | Error icon with tooltip |

---

### Implementation Tasks

#### Phase 4.1: ExpressionInput Core with CodeMirror ✅ COMPLETE

- [x] Add CodeMirror 6 dependencies to `packages/ui`
- [x] Create `expression-language.ts` - StreamLanguage definition
- [x] Create `expression-highlight.ts` - syntax highlighting styles
- [x] Create `theme.ts` - shadcn/ui compatible CodeMirror theme
- [x] Create `editor.tsx` - EditorView wrapper component
- [x] Create `index.tsx` - main ExpressionInput component
- [x] Implement single-line mode (prevent Enter key)
- [x] Implement multi-line mode with configurable rows
- [x] Add unit tests for language tokenizer (11 tests)
- [ ] Add Storybook stories for visual testing

#### Phase 4.2: Autocomplete ✅ COMPLETE

- [x] Create `completions.ts` - completion source function
- [x] Trigger autocomplete on `{{` pattern detection
- [x] Build completion items from ExpressionContext
- [x] Group completions by category (Variables, Upstream Nodes, Context)
- [x] Show type badge and preview value in completion items
- [x] Insert completion with proper cursor positioning
- [x] Handle completion for nested paths (e.g., `nodes.http_1.` triggers port suggestions)

#### Phase 4.3: Context Provider ✅ COMPLETE

- [x] Create `ExpressionContextProvider` component
- [x] Implement `getUpstreamNodes` helper using BFS
- [x] Add `useExpressionContext` hook
- [x] Integrate into RoutineEditor
- [ ] Pass context through NodeConfigDrawer

#### Phase 4.4: Live Preview ✅ COMPLETE

- [x] Port ExpressionResolver to browser (no Node.js deps)
- [x] Build preview context from editor state
- [x] Add debounced preview resolution (300ms)
- [x] Display preview badge with type indicator
- [x] Handle resolution errors gracefully
- [x] Add unit tests for preview resolver (28 tests)

#### Phase 4.5: Plugin Migration (2-3 days)

- [ ] Create `ExpressionField` wrapper component
- [ ] Update HTTP Request plugin config UI
- [ ] Update Static Data plugin config UI
- [ ] Update OpenAI Chat plugin config UI
- [ ] Add expression syntax hints to all plugins
- [ ] Document migration guide for plugin authors

#### Phase 4.6: Testing & Polish (1-2 days)

- [ ] End-to-end test: create variable, use in expression, execute
- [ ] Test autocomplete with many variables (performance)
- [ ] Test with deeply nested expressions
- [ ] Accessibility audit (keyboard nav, screen reader)
- [ ] Dark mode styling verification

---

### File Structure

```
packages/ui/
├── src/
│   ├── components/
│   │   └── expression-input/
│   │       ├── index.tsx              # Main component (lazy-loadable)
│   │       ├── editor.tsx             # CodeMirror EditorView wrapper
│   │       ├── completions.ts         # Autocomplete completion source
│   │       └── theme.ts               # shadcn/ui theme for CodeMirror
│   └── lib/
│       ├── expression-language.ts     # CodeMirror StreamLanguage definition
│       └── expression-highlight.ts    # Syntax highlighting styles
├── package.json                       # Add codemirror dependencies

apps/web/components/routines/
├── routine-editor/
│   ├── expression-context.tsx         # React context provider
│   ├── use-upstream-nodes.ts          # Hook to compute upstream nodes
│   └── ...
├── node-config-drawer.tsx             # Updated to pass context

packages/plugins/ui/
├── expression-field.tsx               # Plugin-friendly wrapper
└── ...
```

### Dependencies to Add

```json
// packages/ui/package.json
{
  "dependencies": {
    "codemirror": "^6.0.1",
    "@codemirror/autocomplete": "^6.18.0",
    "@codemirror/language": "^6.10.0",
    "@codemirror/state": "^6.4.0",
    "@codemirror/view": "^6.34.0",
    "@lezer/highlight": "^1.2.0"
  }
}
```

---

### Testing Strategy

#### Unit Tests

```typescript
// expression-tokenizer.test.ts
describe("tokenize", () => {
  it("tokenizes plain text", () => { ... });
  it("tokenizes single expression", () => { ... });
  it("tokenizes multiple expressions", () => { ... });
  it("handles nested brackets", () => { ... });
  it("marks unclosed expressions as invalid", () => { ... });
});

// expression-input.test.tsx
describe("ExpressionInput", () => {
  it("renders plain text without decoration", () => { ... });
  it("highlights valid expressions", () => { ... });
  it("shows autocomplete on {{ trigger", () => { ... });
  it("filters suggestions as user types", () => { ... });
  it("inserts selected suggestion", () => { ... });
});
```

#### Integration Tests

```typescript
// expression-workflow.test.tsx
describe("Expression workflow", () => {
  it("creates variable and uses in node config", async () => {
    // 1. Open Variables panel
    // 2. Add variable "apiUrl" = "https://test.com"
    // 3. Open node config
    // 4. Type "{{ vars." in URL field
    // 5. Verify "apiUrl" appears in suggestions
    // 6. Select suggestion
    // 7. Verify field value is "{{ vars.apiUrl }}"
    // 8. Verify preview shows "https://test.com"
  });
});
```

---

### Future Considerations

1. **Schema-aware autocomplete:** Show expected type based on field schema
2. **Expression builder modal:** Visual drag-drop for complex expressions
3. **Expression history:** Recently used expressions for quick access
4. **Snippets:** Pre-defined expression patterns (e.g., "HTTP response body")
5. **Multi-expression fields:** Support multiple expressions in one field with visual chips

---

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
