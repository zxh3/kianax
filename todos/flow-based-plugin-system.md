# Flow-Based Plugin System - Implementation Todo

> Reference: `/docs/flow-based-plugin-system.md`

## Phase 1: Core Infrastructure

### 1.1 Connection Model Update
- [ ] Add `sourceHandle` field to `Connection` type in `packages/execution-engine/src/types/graph.ts`
- [ ] Update `Edge` interface to support handle-based routing
- [ ] Create migration script for existing routines (port-based → flow-based)
- [ ] Update Convex schema for new connection structure

### 1.2 Plugin SDK Changes
- [ ] Add `withOutputSchema()` builder method to plugin SDK
- [ ] Add `withOutputHandles()` builder method for control flow nodes
- [ ] Deprecate `withInput()` / `withOutput()` port methods (keep for backwards compat)
- [ ] Add `__handle` return value support for routing
- [ ] Update plugin type definitions

### 1.3 Execution Engine Changes
- [ ] Implement `shouldExecute()` function for handle-based routing
- [ ] Update `executeNode()` to work with config-only plugins
- [ ] Remove port-based input gathering (or make optional)
- [ ] Add `setActiveHandle()` / `getActiveHandle()` to execution state
- [ ] Update topological sort to respect handle connections

## Phase 2: Control Flow Nodes

### 2.1 If-Else Node Migration
- [ ] Update if-else plugin to use output handles (`true`, `false`)
- [ ] Move condition evaluation to config expression
- [ ] Test branching behavior with new routing
- [ ] Update if-else config UI

### 2.2 New Control Flow Nodes
- [ ] Create Switch/Router node (multi-way branching)
  - Output handles: `case1`, `case2`, ..., `default`
  - Config: `value` expression + `cases` array
- [ ] Create Try/Catch node (error handling)
  - Output handles: `success`, `error`
  - Wrap execution in try-catch, route accordingly
- [ ] Create Loop node (iteration)
  - Output handles: `iteration`, `complete`
  - Config: `items` expression, iteration variable name
  - Provide `$current`, `$index` in loop body scope

### 2.3 Handle UI in Editor
- [ ] Add visual handle indicators on control flow nodes
- [ ] Allow connections from specific handles in ReactFlow
- [ ] Color-code handles (green=success/true, red=error/false)
- [ ] Show handle labels on hover

## Phase 3: Expression System Integration

### 3.1 Scope Enhancement
- [ ] Update `getUpstreamNodes()` to include output schemas
- [ ] Add output schema to `CompletionItem` tree in expression context
- [ ] Support deep autocomplete into output schema: `{{ nodes.http.output.data.` → shows schema fields
- [ ] Add validation for expression paths against output schemas

### 3.2 Special Context Variables
- [ ] Add `$input` shorthand for primary upstream node output
- [ ] Add loop context variables (`$current`, `$index`, `$isFirst`, `$isLast`)
- [ ] Add error context variables for try-catch (`$error.message`, `$error.stack`)

### 3.3 Design-Time Validation
- [ ] Warn when referencing non-upstream nodes
- [ ] Warn when expression path doesn't match output schema
- [ ] Highlight inactive branches in editor (based on static analysis)

## Phase 4: Plugin Migration

### 4.1 Core Plugins
- [ ] Migrate `http-request` to config-only (remove input ports)
- [ ] Migrate `static-data` (already has no inputs)
- [ ] Migrate `openai-message` to config-only
- [ ] Migrate `google-sheets` to config-only
- [ ] Update all plugin config UIs to use ExpressionField

### 4.2 Plugin Documentation
- [ ] Update plugin authoring guide for flow-based system
- [ ] Document output schema best practices
- [ ] Document control flow node creation
- [ ] Add migration guide for existing plugins

## Phase 5: UI/UX Updates

### 5.1 Routine Editor
- [ ] Simplify connection UI (no port selection needed)
- [ ] Auto-suggest connections when dragging
- [ ] Show data flow preview on hover
- [ ] Add "what data is available here?" panel in node config

### 5.2 Node Config Drawer
- [ ] Pass resolved output schemas to ExpressionDataPicker
- [ ] Show real output shape from last execution (if available)
- [ ] Add "Insert from upstream" quick action

### 5.3 Execution Visualization
- [ ] Highlight active execution path
- [ ] Gray out skipped branches
- [ ] Show data values flowing through connections
- [ ] Add branch indicator icons on control flow nodes

## Phase 6: Testing & Validation

### 6.1 Unit Tests
- [ ] Test handle-based routing logic
- [ ] Test expression resolution with new scope
- [ ] Test control flow node execution
- [ ] Test backwards compatibility with port-based plugins

### 6.2 Integration Tests
- [ ] Create routine: linear flow with expressions
- [ ] Create routine: if-else branching
- [ ] Create routine: nested if-else
- [ ] Create routine: loop with iteration
- [ ] Create routine: try-catch error handling

### 6.3 Migration Tests
- [ ] Test migration script on existing routines
- [ ] Verify no data loss during conversion
- [ ] Test mixed old/new plugin routines

## Phase 7: Cleanup & Deprecation

### 7.1 Remove Legacy Code
- [ ] Remove port-based input gathering from execution engine
- [ ] Remove `withInput()` / `withOutput()` from plugin SDK
- [ ] Remove port UI components from editor
- [ ] Remove port-related fields from Convex schema

### 7.2 Documentation
- [ ] Update README with new architecture
- [ ] Update variable-system-design.md
- [ ] Archive port-based documentation

---

## Priority Order

| Priority | Tasks | Estimated Effort |
|----------|-------|------------------|
| P0 | 1.1, 1.2, 1.3 (Core infrastructure) | 3-4 days |
| P0 | 2.1 (If-Else migration - critical) | 1 day |
| P1 | 3.1, 3.2 (Expression enhancements) | 2 days |
| P1 | 2.2 (New control flow nodes) | 2-3 days |
| P1 | 4.1 (Plugin migration) | 2 days |
| P2 | 5.1, 5.2, 5.3 (UI improvements) | 3-4 days |
| P2 | 6.1, 6.2, 6.3 (Testing) | 2 days |
| P3 | 7.1, 7.2 (Cleanup) | 1-2 days |

**Total Estimated Effort:** ~16-20 days

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-11-27 | Use `sourceHandle` for routing | Preserves if-else/branching while simplifying normal connections |
| 2025-11-27 | Keep output schemas required | Enables autocomplete and validation |
| 2025-11-27 | Phased migration | Minimizes risk, allows incremental rollout |

---

## Notes

- **If-Else must work** - This is a critical control flow pattern. The handle-based routing ensures branching is preserved.
- **Expression system is ready** - The existing `ExpressionInput` and `ExpressionResolver` already support the needed patterns.
- **Backwards compatibility** - During transition, both port-based and flow-based plugins should work together.
