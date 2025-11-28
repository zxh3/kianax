import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ExpressionDataPicker } from "./index";
import { ExpressionInput, type ExpressionContext } from "../expression-input";

const meta: Meta<typeof ExpressionDataPicker> = {
  title: "Components/ExpressionDataPicker",
  component: ExpressionDataPicker,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    draggable: {
      control: "boolean",
      description: "Enable drag & drop functionality",
    },
    showSearch: {
      control: "boolean",
      description: "Show search/filter input",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ExpressionDataPicker>;

// Rich sample context for stories (matches ExpressionInput stories)
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
          value: {
            timeout: 5000,
            retries: 3,
            baseUrl: "https://api.example.com",
            features: {
              caching: true,
              logging: false,
            },
          },
        },
        {
          name: "tags",
          type: "arr",
          detail: "Tag list",
          value: ["production", "critical", "monitored"],
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
          value: {
            success: {
              status: 200,
              headers: { "content-type": "application/json" },
              data: {
                users: [
                  { id: 1, name: "Alice", email: "alice@example.com" },
                  { id: 2, name: "Bob", email: "bob@example.com" },
                ],
                total: 2,
                page: 1,
              },
            },
            error: null,
          },
          children: [
            { name: "success", detail: "output" },
            { name: "error", detail: "output" },
          ],
        },
        {
          name: "transform_1",
          detail: "Data Transform",
          value: {
            data: [
              { processed: true, value: 100 },
              { processed: true, value: 200 },
            ],
          },
          children: [{ name: "data", detail: "output" }],
        },
        {
          name: "condition_1",
          detail: "Condition Check",
          value: { result: true, branch: "success" },
          children: [
            { name: "result", detail: "output" },
            { name: "branch", detail: "output" },
          ],
        },
      ],
    },
    {
      name: "trigger",
      detail: "Trigger data",
      info: "Access data from the routine trigger",
      value: {
        payload: { event: "user.created", timestamp: 1699000000000 },
        type: "webhook",
      },
      children: [
        { name: "payload", type: "obj", detail: "Trigger payload data" },
        { name: "type", type: "str", detail: "Trigger type" },
      ],
    },
    {
      name: "execution",
      detail: "Execution context",
      info: "Access execution metadata",
      value: {
        id: "exec-abc123",
        routineId: "routine-xyz",
        startedAt: 1699000000000,
      },
      children: [
        { name: "id", type: "str", detail: "Unique execution ID" },
        { name: "routineId", type: "str", detail: "Routine ID" },
        { name: "startedAt", type: "num", detail: "Start timestamp (ms)" },
      ],
    },
  ],
};

/**
 * Basic tree view with default state.
 * Click on items with children to expand/collapse.
 */
export const Default: Story = {
  args: {
    context: sampleContext,
  },
};

/**
 * Tree with some paths expanded by default.
 */
export const DefaultExpanded: Story = {
  args: {
    context: sampleContext,
    defaultExpanded: ["vars", "nodes", "nodes.http_1"],
  },
};

/**
 * Interactive selection - shows the selected path.
 */
export const WithSelection: Story = {
  render: (args) => {
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [selectedValue, setSelectedValue] = useState<unknown>(null);

    return (
      <div className="space-y-4">
        <ExpressionDataPicker
          {...args}
          onSelect={(path, value) => {
            setSelectedPath(path);
            setSelectedValue(value);
          }}
        />
        {selectedPath && (
          <div className="p-3 rounded-md bg-muted text-sm">
            <div className="font-medium">Selected:</div>
            <div className="font-mono text-xs mt-1">
              {"{{ "}
              {selectedPath}
              {" }}"}
            </div>
            <div className="text-muted-foreground text-xs mt-2">
              Value: {JSON.stringify(selectedValue)}
            </div>
          </div>
        )}
      </div>
    );
  },
  args: {
    context: sampleContext,
    defaultExpanded: ["vars"],
  },
};

/**
 * Draggable nodes - leaf nodes can be dragged.
 */
export const Draggable: Story = {
  render: (args) => {
    const [draggedPath, setDraggedPath] = useState<string | null>(null);

    return (
      <div className="space-y-4">
        <ExpressionDataPicker
          {...args}
          draggable
          onDragStart={(path) => setDraggedPath(path)}
        />
        <div
          role="region"
          aria-label="Drop zone for expression paths"
          className="p-4 rounded-md border-2 border-dashed border-muted-foreground/30 text-center text-sm text-muted-foreground"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("border-primary", "bg-primary/5");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("border-primary", "bg-primary/5");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("border-primary", "bg-primary/5");
            const path = e.dataTransfer.getData(
              "application/x-expression-path",
            );
            if (path) {
              alert(`Dropped: {{ ${path} }}`);
            }
          }}
        >
          Drop zone - drag a leaf node here
          {draggedPath && (
            <div className="mt-2 font-mono text-xs">
              Dragging: {draggedPath}
            </div>
          )}
        </div>
      </div>
    );
  },
  args: {
    context: sampleContext,
    defaultExpanded: ["vars", "nodes"],
  },
};

/**
 * Deep nesting - demonstrates introspection of nested object values.
 */
export const DeepNesting: Story = {
  args: {
    context: sampleContext,
    defaultExpanded: [
      "nodes",
      "nodes.http_1",
      "nodes.http_1.success",
      "nodes.http_1.success.data",
      "nodes.http_1.success.data.users",
    ],
  },
};

/**
 * Empty state when no context data is available.
 */
export const Empty: Story = {
  args: {
    context: { completions: [] },
  },
};

/**
 * With search input (disabled - coming in Phase 2).
 */
export const WithSearch: Story = {
  args: {
    context: sampleContext,
    showSearch: true,
    defaultExpanded: ["vars"],
  },
};

/**
 * Custom styling with additional class.
 */
export const CustomStyling: Story = {
  args: {
    context: sampleContext,
    className: "w-80 shadow-lg",
    defaultExpanded: ["vars"],
  },
};

/**
 * All types showcase - demonstrating different value types.
 */
export const AllTypes: Story = {
  args: {
    context: {
      completions: [
        {
          name: "types",
          detail: "Type examples",
          children: [
            { name: "stringValue", type: "str", value: "Hello, World!" },
            { name: "numberValue", type: "num", value: 42 },
            { name: "booleanTrue", type: "bool", value: true },
            { name: "booleanFalse", type: "bool", value: false },
            { name: "nullValue", type: "null", value: null },
            {
              name: "objectValue",
              type: "obj",
              value: { key: "value", nested: { deep: true } },
            },
            { name: "arrayValue", type: "arr", value: [1, 2, 3, 4, 5] },
            {
              name: "longString",
              type: "str",
              value:
                "This is a very long string that should be truncated in the preview display",
            },
          ],
        },
      ],
    },
    defaultExpanded: ["types"],
  },
};

/**
 * Combined drag & drop demo with ExpressionInput.
 * Drag leaf nodes from the picker and drop them into the input field.
 */
export const DragToExpressionInput: Story = {
  render: (args) => {
    const [value, setValue] = useState("Enter URL: ");

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Drag a leaf node from the tree below and drop it into the input field.
        </div>

        {/* ExpressionInput with acceptDrop enabled */}
        <div className="space-y-1">
          <span className="text-sm font-medium">API Endpoint</span>
          <ExpressionInput
            value={value}
            onChange={setValue}
            context={args.context}
            acceptDrop
            showPreview
            placeholder="Drag an expression here..."
          />
        </div>

        {/* Expression Data Picker */}
        <div className="space-y-1">
          <span className="text-sm font-medium">Available Data</span>
          <ExpressionDataPicker
            {...args}
            draggable
            onSelect={(path) => {
              // Also support click-to-insert
              setValue((prev) => `${prev}{{ ${path} }}`);
            }}
          />
        </div>

        {/* Current value preview */}
        <div className="p-3 rounded-md bg-muted text-sm font-mono">
          {value || "(empty)"}
        </div>
      </div>
    );
  },
  args: {
    context: sampleContext,
    defaultExpanded: ["vars", "nodes", "nodes.http_1"],
  },
};

/**
 * Side-by-side layout for drag & drop workflow.
 */
export const SideBySideLayout: Story = {
  render: (args) => {
    const [url, setUrl] = useState("");
    const [body, setBody] = useState("");

    return (
      <div className="flex gap-4">
        {/* Left: Form fields */}
        <div className="flex-1 space-y-4">
          <h3 className="text-sm font-semibold">HTTP Request Configuration</h3>

          <div className="space-y-1">
            <span className="text-sm font-medium">URL</span>
            <ExpressionInput
              value={url}
              onChange={setUrl}
              context={args.context}
              acceptDrop
              placeholder="https://api.example.com/{{ ... }}"
            />
          </div>

          <div className="space-y-1">
            <span className="text-sm font-medium">Request Body</span>
            <ExpressionInput
              value={body}
              onChange={setBody}
              context={args.context}
              acceptDrop
              multiline
              rows={4}
              placeholder='{"userId": "{{ vars.userId }}"}'
            />
          </div>
        </div>

        {/* Right: Data picker */}
        <div className="w-80">
          <h3 className="text-sm font-semibold mb-2">Available Data</h3>
          <ExpressionDataPicker
            {...args}
            draggable
            showSearch
            className="h-80"
          />
        </div>
      </div>
    );
  },
  args: {
    context: sampleContext,
    defaultExpanded: ["vars", "nodes"],
  },
};
