/**
 * CodeMirror 6 decorations for expression syntax.
 *
 * Adds visual highlighting (background color) to entire {{ ... }} expressions
 * to make them stand out from surrounding text.
 */

import {
  ViewPlugin,
  Decoration,
  EditorView,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

/**
 * Decoration mark for expression blocks.
 * Uses a subtle primary-tinted background with rounded corners.
 */
const expressionMark = Decoration.mark({
  class: "cm-expression-block",
});

/**
 * Find all {{ ... }} expressions in the document and create decorations.
 */
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const text = doc.toString();

  // Match all {{ ... }} patterns (non-greedy)
  const regex = /\{\{.*?\}\}/g;
  let match = regex.exec(text);

  while (match !== null) {
    const from = match.index;
    const to = from + match[0].length;
    builder.add(from, to, expressionMark);
    match = regex.exec(text);
  }

  return builder.finish();
}

/**
 * ViewPlugin that tracks and decorates expression blocks.
 */
const expressionDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      // Rebuild decorations when document changes
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

/**
 * CSS styles for the expression block decoration.
 * Uses color-mix() for opacity since --primary may be in oklch format.
 */
const expressionDecorationTheme = EditorView.baseTheme({
  ".cm-expression-block": {
    backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
    border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
    borderRadius: "4px",
    padding: "1px 2px",
    margin: "0 1px",
  },
});

/**
 * Expression decoration extension for CodeMirror.
 *
 * Adds a subtle background highlight to {{ ... }} expressions.
 *
 * Usage:
 * ```typescript
 * import { expressionDecoration } from "./expression-decoration";
 *
 * const extensions = [expressionDecoration];
 * ```
 */
export const expressionDecoration = [
  expressionDecorationPlugin,
  expressionDecorationTheme,
];
