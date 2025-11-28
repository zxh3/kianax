# ExpressionInput Component Testing Checklist

## Test Environment
- Storybook at http://localhost:6006
- Component: Components/ExpressionInput
- Test Date: 2025-11-27

---

## 1. Basic Rendering & Styling

- [x] **Default story renders** - Component displays without errors
- [x] **Matches shadcn/ui styling** - Border, background, shadow match Input component
- [x] **Placeholder displays** - Shows placeholder text when empty
- [x] **Focus ring appears** - Blue/ring color border on focus
- [x] **Dark mode support** - Styles adapt correctly in dark mode

---

## 2. Syntax Highlighting

- [x] **Expression brackets highlighted** - `{{` and `}}` visible in editor
- [x] **Variable paths highlighted** - `vars.apiUrl` shows in editor
- [x] **Node paths highlighted** - `nodes.http_1.success` shows in editor
- [x] **Mixed content works** - Plain text + expressions both render correctly
- [x] **Nested expressions** - Multiple expressions in one value all render

---

## 3. Autocomplete - Root Level

- [x] **Autocomplete triggers on `{{`** - Popup appears after typing `{{`
- [x] **Shows `vars` option** - "Routine variables" suggestion appears
- [x] **Shows `nodes` option** - "Node outputs" suggestion appears
- [x] **Shows `trigger` option** - "Trigger data" suggestion appears
- [x] **Shows `execution` option** - "Execution context" suggestion appears
- [x] **Keyboard navigation works** - Arrow keys select options
- [x] **Enter/Tab selects** - Pressing Enter inserts completion

---

## 4. Autocomplete - Variable Completions (vars.*)

- [x] **Variable names appear** - After `vars.`, shows apiUrl, userId, config, debugMode, maxRetries
- [x] **Type badges display** - Shows "str", "num", "bool", "json" indicators
- [x] **Descriptions show** - "Base API URL" and other descriptions appear
- [x] **Selection inserts correctly** - Selecting a variable completes the path

---

## 5. Autocomplete - Node Completions (nodes.*)

- [x] **Node IDs appear** - After `nodes.`, shows http_1, transform_1
- [x] **Plugin ID as detail** - Shows "http-request", "transform" as detail
- [x] **Output ports appear** - After `nodes.http_1.`, shows success, error
- [x] **Full path completes** - Can build `nodes.http_1.success.data.message`

---

## 6. Autocomplete - Other Sources

- [x] **Trigger completions** - `trigger.` available (hasTrigger=true in context)
- [x] **Execution completions** - `execution.` shows id, routineId, startedAt

---

## 7. Live Preview Feature

- [x] **Preview appears when enabled** - Badge shows below input with showPreview=true
- [x] **String type shows correctly** - Green "str" badge with `"https://api.example.com"`
- [x] **Number type shows correctly** - Blue "num" badge with `3`
- [x] **Boolean type shows correctly** - Purple "bool" badge with `true`
- [x] **Object type shows correctly** - Orange "obj" badge with `{timeout, retries}`
- [x] **Array type shows correctly** - Cyan "arr" badge with `Array(3)`
- [x] **Debounced updates** - Preview updates after typing stops (300ms)
- [ ] **Error state displays** - Not tested (need invalid expression context)

---

## 8. Multiline Mode

- [x] **Multiline story renders** - Textarea-like appearance with taller height
- [x] **Enter creates newlines** - JSON template spans multiple lines
- [x] **Rows prop works** - Min-height set to 8 rows
- [x] **Expressions work across lines** - All expressions in JSON visible
- [ ] **Scrolling works** - Not tested with very long content

---

## 9. Input States

- [x] **Disabled state** - Input is non-interactive when disabled=true
- [x] **Disabled styling** - Reduced opacity visible
- [x] **Error state styling** - Red border when error prop provided
- [x] **Error message displays** - "Unknown variable: unknownVariable" shows in red
- [ ] **No context mode** - Not explicitly tested

---

## 10. User Interactions

- [x] **Typing works** - Can type plain text and expressions
- [x] **Backspace works** - Can delete characters
- [ ] **Selection works** - Not explicitly tested
- [ ] **Copy/paste works** - Not explicitly tested
- [ ] **Undo/redo works** - Not explicitly tested

---

## 11. Edge Cases

- [x] **Empty value** - Component handles empty string (Default story)
- [x] **Very long expressions** - Nested paths like `nodes.http_1.success.data.message` work
- [x] **Special characters** - JSON with quotes, brackets handled in Multiline
- [ ] **Rapid typing** - Not stress tested
- [x] **Multiple expressions** - MultipleExpressions story works

---

## 12. Specific Stories to Test

| Story | Status | Notes |
|-------|--------|-------|
| Default | [x] | Basic empty input with placeholder |
| WithExpression | [x] | Pre-filled URL template renders |
| WithPreview | [x] | Live preview badge shows resolved value |
| Multiline | [x] | JSON template with 8 rows |
| WithError | [x] | Error message in red below input |
| Disabled | [x] | Non-interactive with reduced opacity |
| NoContext | [ ] | Not explicitly tested |
| MultipleExpressions | [x] | Several expressions in template |
| NodeOutputReference | [x] | Nested node path resolves to "OK" |
| PreviewTypes | [x] | All 5 preview type badges visible |

---

## Issues Found

| Issue | Severity | Description |
|-------|----------|-------------|
| Autocomplete dropdown styling | Fixed | Added z-index: 50, box shadow, padding, and hidden default icons in theme.ts |

---

## Summary

**Tested: 2025-11-27 via Chrome DevTools MCP**

### Passed Tests: ~45/50 (90%)
### Key Features Verified:
1. Autocomplete with all 4 root sources (vars, nodes, trigger, execution)
2. Variable completions with type badges
3. Node output completions with nested paths
4. Live preview with all type badges (str, num, bool, obj, arr)
5. Multiline mode with JSON template
6. Error state with red styling
7. Disabled state with reduced opacity

### Not Tested (require manual interaction):
- Copy/paste functionality
- Undo/redo functionality
- Selection with mouse
- Scrolling in very long content
- Rapid typing stress test

### Fixes Applied:
- **theme.ts**: Improved autocomplete dropdown styling with z-index: 50, box shadow, padding, border-radius, and hidden default completion icons
