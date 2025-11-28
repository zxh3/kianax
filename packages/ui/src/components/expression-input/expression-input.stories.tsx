import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ExpressionInput } from "./index";
import type { ExpressionContext, PreviewContext } from "./index";

const meta: Meta<typeof ExpressionInput> = {
  title: "Components/ExpressionInput",
  component: ExpressionInput,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: "text",
      description: "Current input value (may contain {{ expressions }})",
    },
    multiline: {
      control: "boolean",
      description: "Enable multi-line mode (textarea)",
    },
    rows: {
      control: { type: "number", min: 1, max: 20 },
      description: "Number of rows for multiline mode",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
    disabled: {
      control: "boolean",
      description: "Disable the input",
    },
    showPreview: {
      control: "boolean",
      description: "Show live preview of resolved expressions",
    },
    error: {
      control: "text",
      description: "Error message to display",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ExpressionInput>;

// Sample expression context for stories
// This demonstrates the generic tree structure - no domain-specific assumptions
const sampleContext: ExpressionContext = {
  completions: [
    {
      name: "vars",
      detail: "Variables",
      info: "Access routine-level variables",
      children: [
        {
          name: "apiUrl",
          type: "str",
          detail: "Base API URL",
          value: "https://api.example.com",
        },
        {
          name: "userId",
          type: "str",
          detail: "Current user ID",
          value: "user-123",
        },
        {
          name: "maxRetries",
          type: "num",
          detail: "Maximum retry attempts",
          value: 3,
        },
        {
          name: "debugMode",
          type: "bool",
          detail: "Enable debug logging",
          value: true,
        },
        {
          name: "config",
          type: "obj",
          detail: "Configuration object",
          value: { timeout: 5000, retries: 3 },
        },
      ],
    },
    {
      name: "nodes",
      detail: "Node outputs",
      info: "Access outputs from upstream nodes",
      children: [
        {
          name: "http_1",
          detail: "HTTP Request",
          children: [
            { name: "success", detail: "output" },
            { name: "error", detail: "output" },
          ],
        },
        {
          name: "transform_1",
          detail: "Data Transform",
          children: [{ name: "data", detail: "output" }],
        },
      ],
    },
    {
      name: "trigger",
      detail: "Trigger data",
      info: "Access data from the routine trigger",
      children: [
        { name: "payload", type: "obj", detail: "Trigger payload data" },
        { name: "type", type: "str", detail: "Trigger type" },
      ],
    },
    {
      name: "execution",
      detail: "Execution context",
      info: "Access execution metadata",
      children: [
        { name: "id", type: "str", detail: "Unique execution ID" },
        { name: "routineId", type: "str", detail: "Routine ID" },
        { name: "startedAt", type: "num", detail: "Start timestamp (ms)" },
      ],
    },
  ],
};

const samplePreviewContext: PreviewContext = {
  vars: {
    apiUrl: "https://api.example.com",
    userId: "user-123",
    maxRetries: 3,
    debugMode: true,
    config: { timeout: 5000, retries: 3 },
  },
  nodes: {
    http_1: {
      success: { status: 200, data: { message: "OK" } },
      error: null,
    },
    transform_1: {
      data: [1, 2, 3],
    },
  },
};

/**
 * Interactive wrapper for controlled input
 */
function ControlledInput(props: React.ComponentProps<typeof ExpressionInput>) {
  const [value, setValue] = useState(props.value || "");
  return <ExpressionInput {...props} value={value} onChange={setValue} />;
}

/**
 * Basic single-line input with expression highlighting.
 * Type `{{` to see autocomplete suggestions.
 */
export const Default: Story = {
  render: (args) => <ControlledInput {...args} />,
  args: {
    value: "",
    placeholder: "Enter value or {{ expression }}",
    context: sampleContext,
  },
};

/**
 * Input pre-filled with an expression.
 */
export const WithExpression: Story = {
  render: (args) => <ControlledInput {...args} />,
  args: {
    value: "https://{{ vars.apiUrl }}/users/{{ vars.userId }}",
    placeholder: "Enter URL...",
    context: sampleContext,
  },
};

/**
 * Shows live preview of resolved expression values.
 */
export const WithPreview: Story = {
  render: (args) => <ControlledInput {...args} />,
  args: {
    value: "{{ vars.apiUrl }}",
    placeholder: "Enter expression...",
    context: sampleContext,
    showPreview: true,
    previewContext: samplePreviewContext,
  },
};

/**
 * Multi-line mode for longer content like JSON or templates.
 */
export const Multiline: Story = {
  render: (args) => <ControlledInput {...args} />,
  args: {
    value: `{
  "url": "{{ vars.apiUrl }}",
  "userId": "{{ vars.userId }}",
  "retries": {{ vars.maxRetries }}
}`,
    placeholder: "Enter JSON...",
    multiline: true,
    rows: 8,
    context: sampleContext,
  },
};

/**
 * Input with validation error displayed.
 */
export const WithError: Story = {
  render: (args) => <ControlledInput {...args} />,
  args: {
    value: "{{ vars.unknownVariable }}",
    placeholder: "Enter value...",
    context: sampleContext,
    error: "Unknown variable: unknownVariable",
  },
};

/**
 * Disabled state.
 */
export const Disabled: Story = {
  render: (args) => <ControlledInput {...args} />,
  args: {
    value: "{{ vars.apiUrl }}",
    disabled: true,
    context: sampleContext,
  },
};

/**
 * No expression context - autocomplete disabled.
 */
export const NoContext: Story = {
  render: (args) => <ControlledInput {...args} />,
  args: {
    value: "",
    placeholder: "Enter value (no autocomplete)...",
  },
};

/**
 * Multiple expressions in one value.
 */
export const MultipleExpressions: Story = {
  render: (args) => <ControlledInput {...args} />,
  args: {
    value:
      "User {{ vars.userId }} made {{ nodes.http_1.success.data.count }} requests to {{ vars.apiUrl }}",
    placeholder: "Enter template...",
    context: sampleContext,
    showPreview: true,
    previewContext: samplePreviewContext,
  },
};

/**
 * Node output reference with nested path.
 */
export const NodeOutputReference: Story = {
  render: (args) => <ControlledInput {...args} />,
  args: {
    value: "{{ nodes.http_1.success.data.message }}",
    placeholder: "Enter expression...",
    context: sampleContext,
    showPreview: true,
    previewContext: samplePreviewContext,
  },
};

/**
 * Preview showing different value types.
 */
export const PreviewTypes: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-1">String:</p>
        <ControlledInput
          value="{{ vars.apiUrl }}"
          context={sampleContext}
          showPreview
          previewContext={samplePreviewContext}
          onChange={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">Number:</p>
        <ControlledInput
          value="{{ vars.maxRetries }}"
          context={sampleContext}
          showPreview
          previewContext={samplePreviewContext}
          onChange={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">Boolean:</p>
        <ControlledInput
          value="{{ vars.debugMode }}"
          context={sampleContext}
          showPreview
          previewContext={samplePreviewContext}
          onChange={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">Object:</p>
        <ControlledInput
          value="{{ vars.config }}"
          context={sampleContext}
          showPreview
          previewContext={samplePreviewContext}
          onChange={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">Array:</p>
        <ControlledInput
          value="{{ nodes.transform_1.data }}"
          context={sampleContext}
          showPreview
          previewContext={samplePreviewContext}
          onChange={() => {}}
        />
      </div>
    </div>
  ),
};
