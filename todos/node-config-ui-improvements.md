# Node Config UI Improvements

## Current Issues

1. **Config drawer is too narrow** - Limited space for complex configurations
2. **Redundant data pickers** - Each ExpressionField has its own collapsible data picker, wasteful when multiple fields exist
3. **No test run context** - Expression previews show "pending" even after test runs complete

## Proposed Solutions

### 1. Redesign Config Drawer Layout

**Option A: Wider Resizable Drawer**
- Increase default width from ~350px to ~450px
- Add drag handle for resizing
- Remember user preference in localStorage

**Option B: Split Panel Layout (Recommended)**
- Left side: Expression Data Browser (fixed, always visible)
- Right side: Config form fields (scrollable)
- Cleaner UX, data always accessible

```
┌─────────────────────────────────────────────────┐
│ Configure OpenAI Chat                        X  │
├──────────────────┬──────────────────────────────┤
│ Data Browser     │ Node Settings                │
│                  │                              │
│ > nodes          │ System Prompt                │
│   > Static Data  │ ┌────────────────────────┐   │
│     - output     │ │ You are a helpful...   │   │
│   > Cond Branch  │ └────────────────────────┘   │
│     - true       │                              │
│     - false      │ Message                      │
│ > trigger        │ ┌────────────────────────┐   │
│ > execution      │ │ What's the result...   │   │
│ > vars           │ └────────────────────────┘   │
│                  │                              │
│ [Search...]      │ Model                        │
│                  │ [gpt-4o          ▼]          │
│ Drag to insert   │                              │
│ or click field   │ [Cancel]  [Save Changes]    │
│ then click item  │                              │
└──────────────────┴──────────────────────────────┘
```

### 2. Shared Data Picker Architecture

**Current Flow:**
```
ExpressionField
  └── ExpressionInput
  └── CollapsibleDataPicker (per field)
```

**Proposed Flow:**
```
NodeConfigDrawer
  ├── SharedDataPicker (always visible, left panel)
  │     └── ExpressionDataPicker
  │           - onSelect: insert into focused field
  │           - draggable: true
  └── ConfigForm (right panel)
        └── ExpressionInput (without embedded picker)
              - acceptDrop: true
              - onFocus: register as active field
```

**Implementation Steps:**
1. Create `NodeConfigDrawerLayout` component with split panel
2. Add "active field" state management (which ExpressionInput is focused)
3. Modify `ExpressionDataPicker` to support click-to-insert into active field
4. Update `ExpressionField` to optionally hide its embedded picker
5. Add prop `hideDataPicker` to ExpressionField (already exists!)

### 3. Populate Test Run Results into Expression Context

**Goal:** After test run, show actual values instead of "pending"

**Data Flow:**
```
1. User runs test → Execution stored in Convex
2. Execution completes → nodeStates updated with outputs
3. User opens node config → Fetch latest execution results
4. Build PreviewContext from execution outputs
5. Expression previews show real values
```

**Implementation:**

**Step 1: Fetch execution results in ExpressionContextProvider**
```typescript
// Current: Only uses static schema info
const expressionContext = buildExpressionContext({
  variables,
  upstreamNodes,
  hasTrigger,
});

// Proposed: Also include execution results
const expressionContext = buildExpressionContext({
  variables,
  upstreamNodes,
  hasTrigger,
  executionResults: latestExecution?.nodeStates, // NEW
  triggerData: latestExecution?.triggerData, // NEW
});
```

**Step 2: Update buildExpressionContext to merge execution data**
```typescript
function buildExpressionContext(options) {
  const { upstreamNodes, executionResults } = options;

  return {
    nodes: upstreamNodes.map(node => ({
      id: node.id,
      label: node.label,
      outputs: node.outputs.map(output => ({
        name: output.name,
        // Use execution result if available, otherwise PENDING_VALUE
        value: executionResults?.[node.id]?.outputs?.[output.name]
          ?? PENDING_VALUE,
      })),
    })),
    // ...
  };
}
```

**Step 3: Pass execution context to NodeConfigDrawer**
```typescript
// In RoutineEditor, pass test execution to drawer
<NodeConfigDrawer
  executionContext={testExecution?.nodeStates}
  triggerData={testExecution?.triggerData}
/>
```

## Implementation Order

### Phase 1: Shared Data Picker (Medium effort)
1. [ ] Create `NodeConfigDrawerLayout` with split panel design
2. [ ] Add focus tracking for ExpressionInputs
3. [ ] Implement click-to-insert from shared picker
4. [ ] Update drawer width and layout

### Phase 2: Test Run Context (Medium effort)
1. [ ] Extend ExpressionContextProvider to accept execution results
2. [ ] Modify buildExpressionContext to merge execution data
3. [ ] Pass testExecution to NodeConfigDrawer
4. [ ] Update preview display to show "from test run" indicator

### Phase 3: Polish (Low effort)
1. [ ] Add visual indicator when field is active/focused
2. [ ] Add "Refresh from test" button
3. [ ] Remember drawer width preference
4. [ ] Add keyboard shortcut to insert expression

## Files to Modify

- `apps/web/components/routines/node-config-drawer/index.tsx` - Layout redesign
- `packages/ui/src/components/expression-input/index.tsx` - Focus tracking, shared picker support
- `packages/plugins/ui/expression-field.tsx` - Remove embedded picker option
- `apps/web/components/routines/routine-editor/expression-context.tsx` - Add execution results
- `packages/ui/src/lib/expression-preview.ts` - Handle execution result values

## Open Questions

1. Should the data picker be collapsible or always visible?
2. How to handle stale test results (show warning if routine changed since last test)?
3. Should we show both "schema type" and "actual value" in the picker?
