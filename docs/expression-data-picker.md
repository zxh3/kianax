# Expression Data Picker

A tree-based UI component for browsing and selecting expression data, inspired by n8n's expression picker.

## Overview

The Expression Data Picker provides an intuitive way for users to:
1. Browse available data sources in a hierarchical tree view
2. Explore nested data structures by expanding/collapsing nodes
3. See actual runtime values inline
4. Insert expression paths by clicking or dragging

## Features

### Phase 1: Tree View Component
- Hierarchical tree displaying all completion sources (vars, nodes, trigger, execution)
- Expand/collapse functionality for nested data
- Type badges (str, num, bool, obj, arr) on leaf nodes
- Value preview on hover or inline

### Phase 2: Selection & Insertion
- Click on leaf node to insert expression path at cursor
- Copy path to clipboard option
- Keyboard navigation (arrow keys, Enter to select)

### Phase 3: Drag & Drop
- Drag leaf nodes from picker to any ExpressionInput
- Visual feedback during drag (ghost element with path)
- Drop target highlighting on compatible inputs
- Insert expression path on drop

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ExpressionDataPicker                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Search/Filter Input                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ TreeView                                                │ │
│ │  ▼ vars                                                 │ │
│ │    ├─ apiUrl          [str] "https://api.exam..."      │ │
│ │    ├─ userId          [str] "user-123"                 │ │
│ │    └─ ▶ config        [obj]                            │ │
│ │  ▼ nodes                                                │ │
│ │    └─ ▼ http_1                                         │ │
│ │        └─ ▼ success                                    │ │
│ │            ├─ status  [num] 200                        │ │
│ │            └─ ▶ data  [obj]                            │ │
│ │  ▶ trigger                                              │ │
│ │  ▶ execution                                            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

Reuses the existing `ExpressionContext` with `CompletionItem` tree:

```typescript
interface CompletionItem {
  name: string;
  type?: string;      // Type badge
  detail?: string;    // Description
  info?: string;      // Extended info
  children?: CompletionItem[];
  value?: unknown;    // Runtime value for expansion
}

interface ExpressionContext {
  completions: CompletionItem[];
}
```

## Component API

### ExpressionDataPicker

```typescript
interface ExpressionDataPickerProps {
  /** Expression context (same as ExpressionInput) */
  context: ExpressionContext;

  /** Called when user selects a leaf node */
  onSelect?: (path: string, value: unknown) => void;

  /** Called when drag starts */
  onDragStart?: (path: string, value: unknown) => void;

  /** Enable/disable drag functionality */
  draggable?: boolean;

  /** Show search/filter input */
  showSearch?: boolean;

  /** Initially expanded paths */
  defaultExpanded?: string[];

  /** Additional CSS class */
  className?: string;
}
```

### Integration with ExpressionInput

```typescript
// ExpressionInput gains drop target capability
interface ExpressionInputProps {
  // ... existing props

  /** Enable drop target for drag & drop */
  acceptDrop?: boolean;

  /** Called when expression is dropped */
  onDrop?: (path: string) => void;
}
```

## UI States

### Tree Node States
- **Collapsed**: Shows `▶` indicator, children hidden
- **Expanded**: Shows `▼` indicator, children visible
- **Leaf**: No indicator, shows value preview
- **Hover**: Highlighted background, full value tooltip
- **Dragging**: Semi-transparent, cursor changes

### Drop Target States (ExpressionInput)
- **Default**: Normal input appearance
- **Drag Active**: When ANY expression drag starts, ALL inputs with `acceptDrop=true` show dashed border (semi-transparent primary) to indicate they are valid drop targets
- **Drag Over**: When hovering over a specific input, shows stronger highlight (solid primary border, background tint, visible cursor at insertion point)
- **Drop Complete**: Expression inserted, all inputs return to default state

### Type Badges
| Type | Color | Label |
|------|-------|-------|
| string | Green | str |
| number | Blue | num |
| boolean | Purple | bool |
| object | Orange | obj |
| array | Cyan | arr |
| null | Gray | null |

## Interaction Patterns

### Click to Insert
1. User clicks leaf node in picker
2. `onSelect` fires with path (e.g., `"vars.apiUrl"`)
3. Parent component inserts `{{ vars.apiUrl }}` at cursor

### Drag to Input
1. User starts dragging leaf node
2. Drag ghost shows path being dragged
3. Compatible ExpressionInputs highlight as drop targets with:
   - **Dotted border**: Dashed primary-colored border to indicate drop zone
   - **Background tint**: Subtle primary color background
   - **Cursor indicator**: Input is auto-focused to show cursor position
4. As user drags over input, cursor follows mouse position showing exact insertion point
5. On drop, expression `{{ path }}` is inserted at the cursor position

### Keyboard Navigation
- `↑/↓`: Move selection
- `→`: Expand node / move into children
- `←`: Collapse node / move to parent
- `Enter`: Select current node
- `Escape`: Close picker

## File Structure

```
packages/ui/src/components/expression-data-picker/
├── index.tsx              # Main component & exports
├── tree-node.tsx          # Individual tree node component
├── tree-context.tsx       # React context for tree state
├── use-tree-navigation.ts # Keyboard navigation hook
├── drag-handle.tsx        # Drag handle component
└── expression-data-picker.stories.tsx
```

## Implementation Phases

### Phase 1: Basic Tree View (MVP)
- [ ] Create TreeNode component with expand/collapse
- [ ] Render CompletionItem tree recursively
- [ ] Add type badges and value previews
- [ ] Style to match shadcn/ui

### Phase 2: Interactivity
- [ ] Click to select with `onSelect` callback
- [ ] Keyboard navigation
- [ ] Search/filter functionality
- [ ] Hover tooltips with full values

### Phase 3: Drag & Drop
- [ ] Make leaf nodes draggable
- [ ] Create drag preview/ghost
- [ ] Add drop target to ExpressionInput
- [ ] Insert expression on drop

### Phase 4: Polish
- [ ] Animations for expand/collapse
- [ ] Empty states
- [ ] Loading states for lazy data
- [ ] Accessibility (ARIA attributes)

## Usage Example

```tsx
// Standalone picker
<ExpressionDataPicker
  context={expressionContext}
  onSelect={(path) => {
    insertAtCursor(`{{ ${path} }}`);
  }}
  draggable
/>

// With ExpressionInput (drag target)
<ExpressionInput
  value={url}
  onChange={setUrl}
  context={expressionContext}
  acceptDrop
/>
```

## Future Enhancements

- **Lazy loading**: Load nested data on expand for large datasets
- **Recent selections**: Show recently used expressions
- **Favorites**: Pin frequently used expressions
- **Type filtering**: Filter by type (show only strings, etc.)
- **Schema preview**: Show expected types for API responses
