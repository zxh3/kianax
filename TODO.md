# Kianax Data Model & Plugin System Improvement Plan

## Executive Summary

This plan refactors Kianax's routine executor and plugin system by adopting proven patterns from n8n's architecture. The improvements address identified pain points around type safety, early validation, and developer experience while maintaining the Temporal-based execution model.

**Goals:**
- ✅ Compile-time type safety for connections and data flow
- ✅ Early validation (at save-time, not execution-time)
- ✅ Simplified plugin development with declarative parameters
- ✅ Clear separation between config, inputs, and outputs
- ✅ Versioned plugins with migration support

**Approach:** Incremental refactor across 5 core areas without backward compatibility constraints.

---

## 1. Core Data Model Redesign

### 1.1 Port & Connection Type System

**Current Issue:** Free-form `sourceHandle`/`targetHandle` strings with no validation.

**Solution:** Introduce typed port definitions and connection types.

#### New Port Definition Structure
```typescript
// packages/plugin-sdk/src/types/ports.ts
export enum PortType {
  Main = 'main',           // Standard data flow
  Config = 'config',       // Configuration cascade
  Condition = 'condition', // Boolean routing
  Error = 'error',         // Error handling
}

export interface PortDefinition {
  name: string;              // Unique identifier
  type: PortType;           // Connection type
  label: string;            // Display name
  description?: string;
  schema: z.ZodType;        // Type validation
  required?: boolean;       // For inputs
  multiple?: boolean;       // Allow multiple connections
}

export interface PortMetadata {
  name: string;
  type: PortType;
  label: string;
  description?: string;
  schemaJson: string;       // Serialized zod schema
  required: boolean;
  multiple: boolean;
}
```

#### Updated Connection Schema
```typescript
// apps/server/convex/schema.ts
connections: v.array(v.object({
  id: v.string(),
  sourceNodeId: v.string(),
  sourcePort: v.string(),      // Must match source node output port name
  targetNodeId: v.string(),
  targetPort: v.string(),      // Must match target node input port name
  type: v.union(               // Enforce connection type matching
    v.literal("main"),
    v.literal("config"),
    v.literal("condition"),
    v.literal("error")
  ),
  // Conditional routing metadata (only for condition type)
  conditionValue?: v.optional(v.string()),  // e.g., "true", "false", "default"
  // Loop metadata (only for main type with loop nodes)
  loopConfig?: v.optional(v.object({
    maxIterations: v.number(),
    accumulatorFields: v.array(v.string()),
  })),
}))
```

**Benefits:**
- Type-safe connections (can't connect config port to main port)
- Explicit port names (no implicit merging)
- Schema validation at save time
- Clear semantics for special connection types

---

### 1.2 Execution Data Structure

**Current Issue:** Untyped `Record<string, unknown>` everywhere, late validation.

**Solution:** Structured execution data with lineage tracking (inspired by n8n's `pairedItem`).

#### Execution Data Types
```typescript
// packages/shared/src/types/execution.ts
export interface ExecutionItem {
  data: unknown;              // The actual data
  json?: Record<string, unknown>;  // For JSON-serializable data
  binary?: Record<string, BinaryData>;  // For files/blobs
  metadata: {
    sourceNode?: string;
    sourcePort?: string;
    sourceItemIndex?: number; // Which input item produced this
    iteration?: number;       // Loop iteration
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface PortData {
  portName: string;
  items: ExecutionItem[];     // Array supports multiple items per port
}

export interface NodeExecutionResult {
  outputs: PortData[];        // One entry per output port
  executionTime: number;
  status: 'success' | 'error';
  error?: ExecutionError;
}

export interface ExecutionState {
  nodeResults: Map<string, NodeExecutionResult[]>;  // Array for loop iterations
  currentPath: string[];      // Execution order
  loopStates: Map<string, LoopState>;
}
```

**Benefits:**
- Track data lineage through workflow
- Support multiple items per connection (like n8n)
- Separate data from metadata
- Enable visual data flow debugging

---

### 1.3 Node Configuration vs Parameters

**Current Issue:** Blurred distinction between `config` (behavior) and `inputs` (data).

**Solution:** Separate parameter types with clear purposes.

#### Parameter Classification
```typescript
// packages/plugin-sdk/src/types/parameters.ts
export enum ParameterType {
  // Static configuration (stored on node, edited in UI)
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Select = 'select',
  MultiSelect = 'multiSelect',
  Json = 'json',
  Code = 'code',

  // Resource configuration
  Credential = 'credential',
  ResourceLocator = 'resourceLocator',  // Like n8n's resource picker

  // Complex structured types
  Collection = 'collection',            // Nested object
  FixedCollection = 'fixedCollection',  // Multiple named collections

  // UI elements
  Notice = 'notice',                    // Info/warning display
  Button = 'button',                    // Trigger action
}

export interface ParameterDefinition {
  name: string;
  type: ParameterType;
  displayName: string;
  description?: string;
  default?: unknown;
  required?: boolean;

  // Conditional display
  displayOptions?: {
    show?: Record<string, unknown[]>;
    hide?: Record<string, unknown[]>;
  };

  // Type-specific options
  options?: ParameterOption[];          // For select/multiSelect
  typeOptions?: {
    minValue?: number;
    maxValue?: number;
    rows?: number;                      // For textarea
    loadOptionsMethod?: string;         // Dynamic options
  };

  // Validation
  validation?: z.ZodType;
}

export interface ParameterOption {
  name: string;       // Display text
  value: unknown;     // Actual value
  description?: string;
}
```

#### Plugin Definition with Parameters
```typescript
// Builder API update
PluginBuilder
  .create("my-plugin", { category: "data" })
  .withParameters([
    {
      name: 'operation',
      type: ParameterType.Select,
      displayName: 'Operation',
      default: 'get',
      options: [
        { name: 'Get', value: 'get' },
        { name: 'Create', value: 'create' },
      ],
    },
    {
      name: 'resource',
      type: ParameterType.String,
      displayName: 'Resource ID',
      required: true,
      displayOptions: {
        show: { operation: ['get', 'update', 'delete'] },
      },
    },
  ])
  .withInput('trigger', {
    type: PortType.Main,
    schema: z.object({ id: z.string() })
  })
  .withOutput('result', {
    type: PortType.Main,
    schema: z.object({ data: z.any() })
  })
  .execute(async (context) => {
    const operation = context.getParameter('operation');
    const resource = context.getParameter('resource');
    const input = context.getInput('trigger');
    // ...
  })
```

**Benefits:**
- Auto-generate config UI from parameter definitions
- Conditional parameter display
- Type-safe parameter access
- Clear separation: parameters = static config, inputs = runtime data

---

## 2. Plugin System Refactor

### 2.1 Unified Plugin Model

**Current Issue:** Dual registry model (classes vs instances) creates complexity.

**Solution:** Single plugin definition model with versioning.

#### New Plugin Structure
```typescript
// packages/plugin-sdk/src/types/plugin.ts
export interface PluginDefinition {
  // Identity
  name: string;                    // Unique ID (e.g., "http-request")
  version: number;                 // Schema version
  displayName: string;
  description: string;
  category: PluginCategory;
  icon?: string;

  // Interface definition
  parameters: ParameterDefinition[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];

  // Credentials
  credentials?: {
    type: string;                  // Credential type name
    required: boolean;
  }[];

  // Execution
  execute: ExecuteFunction;

  // Dynamic behavior
  hooks?: {
    loadOptions?: Record<string, LoadOptionsFunction>;
    validateParameters?: ValidateFunction;
  };

  // Migration
  migrations?: {
    [fromVersion: number]: MigrationFunction;
  };
}

export type ExecuteFunction = (context: ExecutionContext) => Promise<PortData[]>;

export interface ExecutionContext {
  // Parameters
  getParameter<T = unknown>(name: string): T;
  getParameters(): Record<string, unknown>;

  // Inputs
  getInput(portName: string): ExecutionItem[];
  getAllInputs(): PortData[];

  // Credentials
  getCredentials<T = unknown>(type: string): Promise<T>;

  // Utilities
  helpers: {
    httpRequest(options: HttpOptions): Promise<unknown>;
    evaluateExpression(expr: string): unknown;
  };

  // Metadata
  node: NodeContext;
  routine: RoutineContext;
  execution: ExecutionMetadata;
}
```

#### Plugin Builder v2
```typescript
// Simplified builder with better types
export class PluginBuilder {
  private definition: Partial<PluginDefinition> = {
    parameters: [],
    inputs: [],
    outputs: [],
  };

  static create(name: string, options: {
    displayName: string;
    category: PluginCategory;
    version?: number;
  }) {
    return new PluginBuilder(name, options);
  }

  withParameter(param: ParameterDefinition) {
    this.definition.parameters!.push(param);
    return this;
  }

  withInput(name: string, options: {
    type?: PortType;
    label?: string;
    schema: z.ZodType;
    required?: boolean;
  }) {
    this.definition.inputs!.push({
      name,
      type: options.type ?? PortType.Main,
      label: options.label ?? name,
      schema: options.schema,
      required: options.required ?? false,
    });
    return this;
  }

  withOutput(name: string, options: {
    type?: PortType;
    label?: string;
    schema: z.ZodType;
  }) {
    this.definition.outputs!.push({
      name,
      type: options.type ?? PortType.Main,
      label: options.label ?? name,
      schema: options.schema,
    });
    return this;
  }

  execute(fn: ExecuteFunction) {
    this.definition.execute = fn;
    return this;
  }

  build(): PluginDefinition {
    // Validate completeness
    if (!this.definition.execute) {
      throw new Error('Plugin must have execute function');
    }
    return this.definition as PluginDefinition;
  }
}
```

### 2.2 Plugin Registry v2

**Solution:** Simplified registry with metadata extraction.

```typescript
// packages/plugins/src/registry.ts
export class PluginRegistry {
  private plugins = new Map<string, PluginDefinition>();
  private metadata = new Map<string, PluginMetadata>();

  register(plugin: PluginDefinition) {
    this.plugins.set(plugin.name, plugin);
    this.metadata.set(plugin.name, this.extractMetadata(plugin));
  }

  get(name: string, version?: number): PluginDefinition | undefined {
    const plugin = this.plugins.get(name);
    if (!plugin) return undefined;

    // Handle version migration if needed
    if (version && version < plugin.version) {
      return this.migratePlugin(plugin, version);
    }

    return plugin;
  }

  getMetadata(name: string): PluginMetadata | undefined {
    return this.metadata.get(name);
  }

  private extractMetadata(plugin: PluginDefinition): PluginMetadata {
    return {
      name: plugin.name,
      version: plugin.version,
      displayName: plugin.displayName,
      description: plugin.description,
      category: plugin.category,
      icon: plugin.icon,

      parameters: plugin.parameters.map(p => ({
        name: p.name,
        type: p.type,
        displayName: p.displayName,
        description: p.description,
        default: p.default,
        required: p.required,
        displayOptions: p.displayOptions,
        options: p.options,
      })),

      inputs: plugin.inputs.map(p => ({
        name: p.name,
        type: p.type,
        label: p.label,
        description: p.description,
        required: p.required,
        schemaJson: JSON.stringify(p.schema),
      })),

      outputs: plugin.outputs.map(p => ({
        name: p.name,
        type: p.type,
        label: p.label,
        description: p.description,
        schemaJson: JSON.stringify(p.schema),
      })),
    };
  }

  private migratePlugin(plugin: PluginDefinition, fromVersion: number): PluginDefinition {
    // Apply migrations sequentially
    let current = { ...plugin };
    for (let v = fromVersion; v < plugin.version; v++) {
      const migration = plugin.migrations?.[v];
      if (migration) {
        current = migration(current);
      }
    }
    return current;
  }
}
```

**Benefits:**
- Single source of truth
- Metadata cached and serializable
- Version migration built-in
- Type-safe plugin access

---

## 3. Validation & Type Safety

### 3.1 Save-Time Validation

**Current Issue:** Invalid routines can be saved and only fail at execution.

**Solution:** Validate routine structure when saving.

#### Validation Pipeline
```typescript
// apps/server/convex/routines.ts
import { validateRoutine, ValidationError } from "@kianax/shared/validation";

export const saveRoutine = mutation({
  args: {
    id: v.optional(v.id("routines")),
    name: v.string(),
    nodes: v.array(/* ... */),
    connections: v.array(/* ... */),
  },
  handler: async (ctx, args) => {
    // 1. Validate routine structure
    const validation = validateRoutine({
      nodes: args.nodes,
      connections: args.connections,
    });

    if (!validation.valid) {
      throw new Error(`Routine validation failed:\n${
        validation.errors.map(e => `- ${e.path}: ${e.message}`).join('\n')
      }`);
    }

    // 2. Save to database
    const routineId = args.id ?? await ctx.db.insert("routines", {
      name: args.name,
      nodes: args.nodes,
      connections: args.connections,
      // ...
    });

    return routineId;
  },
});
```

#### Validation Logic
```typescript
// packages/shared/src/validation/routine-validator.ts
import { getPluginRegistry } from "@kianax/plugins";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'plugin_not_found' | 'port_not_found' | 'type_mismatch' | 'required_parameter' | 'graph_cycle';
  path: string;  // e.g., "nodes[2].config.timeout"
  message: string;
}

export function validateRoutine(routine: RoutineDefinition): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const registry = getPluginRegistry();

  // 1. Validate all nodes reference existing plugins
  for (const node of routine.nodes) {
    const plugin = registry.get(node.pluginId);
    if (!plugin) {
      errors.push({
        type: 'plugin_not_found',
        path: `nodes[${node.id}]`,
        message: `Plugin "${node.pluginId}" not found`,
      });
      continue;
    }

    // 2. Validate node parameters against plugin schema
    for (const param of plugin.parameters) {
      if (param.required && !(param.name in node.parameters)) {
        errors.push({
          type: 'required_parameter',
          path: `nodes[${node.id}].parameters.${param.name}`,
          message: `Required parameter "${param.displayName}" is missing`,
        });
      }

      // Validate parameter value if present
      if (param.name in node.parameters && param.validation) {
        const result = param.validation.safeParse(node.parameters[param.name]);
        if (!result.success) {
          errors.push({
            type: 'invalid_value',
            path: `nodes[${node.id}].parameters.${param.name}`,
            message: result.error.message,
          });
        }
      }
    }
  }

  // 3. Validate all connections
  for (const conn of routine.connections) {
    const sourceNode = routine.nodes.find(n => n.id === conn.sourceNodeId);
    const targetNode = routine.nodes.find(n => n.id === conn.targetNodeId);

    if (!sourceNode || !targetNode) {
      errors.push({
        type: 'node_not_found',
        path: `connections[${conn.id}]`,
        message: 'Source or target node not found',
      });
      continue;
    }

    const sourcePlugin = registry.get(sourceNode.pluginId);
    const targetPlugin = registry.get(targetNode.pluginId);

    if (!sourcePlugin || !targetPlugin) continue;

    // Validate ports exist
    const sourcePort = sourcePlugin.outputs.find(p => p.name === conn.sourcePort);
    const targetPort = targetPlugin.inputs.find(p => p.name === conn.targetPort);

    if (!sourcePort) {
      errors.push({
        type: 'port_not_found',
        path: `connections[${conn.id}].sourcePort`,
        message: `Output port "${conn.sourcePort}" not found on plugin "${sourcePlugin.displayName}"`,
      });
    }

    if (!targetPort) {
      errors.push({
        type: 'port_not_found',
        path: `connections[${conn.id}].targetPort`,
        message: `Input port "${conn.targetPort}" not found on plugin "${targetPlugin.displayName}"`,
      });
    }

    // Validate port types match
    if (sourcePort && targetPort && sourcePort.type !== targetPort.type) {
      errors.push({
        type: 'type_mismatch',
        path: `connections[${conn.id}]`,
        message: `Cannot connect ${sourcePort.type} port to ${targetPort.type} port`,
      });
    }

    // Validate schemas are compatible (basic check)
    if (sourcePort && targetPort) {
      const compatible = isSchemasCompatible(sourcePort.schema, targetPort.schema);
      if (!compatible) {
        warnings.push({
          type: 'schema_warning',
          path: `connections[${conn.id}]`,
          message: `Output schema may not match input schema - runtime validation will occur`,
        });
      }
    }
  }

  // 4. Validate graph structure
  const graphValidation = validateGraphStructure(routine.nodes, routine.connections);
  errors.push(...graphValidation.errors);
  warnings.push(...graphValidation.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

**Benefits:**
- Catch errors at design time
- Prevent saving invalid routines
- Clear error messages with paths
- Better user experience

---

## 4. UI Auto-Generation

### 4.1 Parameter Form Generation

**Solution:** Generate forms from parameter definitions.

```typescript
// apps/web/src/components/routine-editor/parameter-form.tsx
import { ParameterDefinition, ParameterType } from "@kianax/plugin-sdk";

interface ParameterFormProps {
  parameters: ParameterDefinition[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function ParameterForm({ parameters, values, onChange }: ParameterFormProps) {
  const visibleParams = parameters.filter(param =>
    shouldShowParameter(param, values)
  );

  return (
    <div className="space-y-4">
      {visibleParams.map(param => (
        <ParameterField
          key={param.name}
          parameter={param}
          value={values[param.name]}
          onChange={(value) => onChange({ ...values, [param.name]: value })}
        />
      ))}
    </div>
  );
}

function shouldShowParameter(param: ParameterDefinition, values: Record<string, unknown>): boolean {
  // Check display conditions
  if (param.displayOptions?.show) {
    for (const [condKey, condValues] of Object.entries(param.displayOptions.show)) {
      if (!condValues.includes(values[condKey])) {
        return false;
      }
    }
  }

  if (param.displayOptions?.hide) {
    for (const [condKey, condValues] of Object.entries(param.displayOptions.hide)) {
      if (condValues.includes(values[condKey])) {
        return false;
      }
    }
  }

  return true;
}

function ParameterField({ parameter, value, onChange }: ParameterFieldProps) {
  switch (parameter.type) {
    case ParameterType.String:
      return <Input value={value} onChange={e => onChange(e.target.value)} />;

    case ParameterType.Number:
      return <Input type="number" value={value} onChange={e => onChange(Number(e.target.value))} />;

    case ParameterType.Boolean:
      return <Switch checked={value} onCheckedChange={onChange} />;

    case ParameterType.Select:
      return (
        <Select value={value} onValueChange={onChange}>
          {parameter.options?.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.name}
            </SelectItem>
          ))}
        </Select>
      );

    case ParameterType.Json:
      return <JsonEditor value={value} onChange={onChange} />;

    // ... other types
  }
}
```

**Benefits:**
- No custom UI code needed per plugin
- Consistent UX across all plugins
- Automatic conditional display
- Easier plugin development

---

## 5. Execution Engine Updates

### 5.1 Updated Activity Execution

**Solution:** Use new execution context and structured outputs.

```typescript
// apps/workers/src/activities/plugins.ts
export async function executePlugin(args: {
  pluginId: string;
  pluginVersion: number;
  parameters: Record<string, unknown>;
  inputs: PortData[];
  context: ActivityContextData;
}): Promise<NodeExecutionResult> {
  const startTime = Date.now();

  try {
    // Get plugin definition
    const plugin = getPluginRegistry().get(args.pluginId, args.pluginVersion);
    if (!plugin) {
      throw new Error(`Plugin not found: ${args.pluginId}`);
    }

    // Create execution context
    const context = new ExecutionContextImpl({
      plugin,
      parameters: args.parameters,
      inputs: args.inputs,
      metadata: args.context,
    });

    // Execute plugin
    const outputs = await plugin.execute(context);

    // Validate outputs
    validateOutputs(outputs, plugin.outputs);

    return {
      outputs,
      executionTime: Date.now() - startTime,
      status: 'success',
    };
  } catch (error: any) {
    return {
      outputs: [],
      executionTime: Date.now() - startTime,
      status: 'error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    };
  }
}
```

### 5.2 Updated Graph Executor

**Solution:** Simplify input gathering with explicit port mapping.

```typescript
// apps/workers/src/lib/graph-executor.ts
export function gatherNodeInputs(
  nodeId: string,
  edges: Edge[],
  state: ExecutionState
): PortData[] {
  const incomingEdges = edges.filter(e => e.targetNodeId === nodeId);
  const portDataMap = new Map<string, ExecutionItem[]>();

  for (const edge of incomingEdges) {
    const sourceResult = state.nodeResults.get(edge.sourceNodeId)?.[0]; // Latest run
    if (!sourceResult || sourceResult.status === 'error') {
      continue;
    }

    // Find source port data
    const sourcePort = sourceResult.outputs.find(p => p.portName === edge.sourcePort);
    if (!sourcePort) {
      throw new Error(
        `Source port "${edge.sourcePort}" not found in node "${edge.sourceNodeId}" output`
      );
    }

    // Map to target port
    const targetPortName = edge.targetPort;
    const items = portDataMap.get(targetPortName) || [];

    // Add lineage metadata
    const itemsWithLineage = sourcePort.items.map((item, idx) => ({
      ...item,
      metadata: {
        ...item.metadata,
        sourceNode: edge.sourceNodeId,
        sourcePort: edge.sourcePort,
        sourceItemIndex: idx,
      },
    }));

    items.push(...itemsWithLineage);
    portDataMap.set(targetPortName, items);
  }

  // Convert map to array
  return Array.from(portDataMap.entries()).map(([portName, items]) => ({
    portName,
    items,
  }));
}
```

**Benefits:**
- No implicit merging
- Clear port-to-port mapping
- Data lineage tracking
- Better error messages

---

## 6. Execution Engine Package Refactor

### 6.1 New Package Structure

**Current Issue:** Execution logic is scattered across Temporal workers, mixing workflow orchestration with execution logic.

**Solution:** Create dedicated `packages/execution-engine` package.

```
packages/
  execution-engine/
    src/
      index.ts                      # Public API
      engine/
        executor.ts                 # Main execution engine (Temporal-agnostic)
        graph-executor.ts           # Graph traversal & BFS logic
        execution-state.ts          # Execution state management
        input-gatherer.ts           # Port-based input gathering
      validation/
        graph-validator.ts          # Graph structure validation (cycles, etc.)
        connection-validator.ts     # Connection compatibility checks
      context/
        execution-context.ts        # Plugin execution context implementation
      types/
        execution.ts                # Execution types (moved from shared)
        graph.ts                    # Graph types
```

#### Public API
```typescript
// packages/execution-engine/src/index.ts
export class RoutineExecutor {
  constructor(
    private pluginRegistry: PluginRegistry,
    private options: ExecutorOptions = {}
  ) {}

  async execute(routine: RoutineDefinition, options: {
    triggerData?: unknown;
    onNodeStart?: (nodeId: string) => Promise<void>;
    onNodeComplete?: (nodeId: string, result: NodeExecutionResult) => Promise<void>;
    onNodeError?: (nodeId: string, error: Error) => Promise<void>;
  }): Promise<ExecutionResult> {
    // Validate graph
    const validation = validateGraph(routine);
    if (!validation.valid) {
      throw new ExecutionError('Invalid routine graph', validation.errors);
    }

    // Build execution graph
    const graph = buildExecutionGraph(routine);
    const state = new ExecutionState();

    // Execute with callbacks
    await this.executeBFS(graph, state, options);

    return {
      status: state.hasErrors() ? 'failed' : 'completed',
      nodeResults: state.nodeResults,
      executionPath: state.executionPath,
      errors: state.getErrors(),
    };
  }

  private async executeBFS(
    graph: ExecutionGraph,
    state: ExecutionState,
    callbacks: ExecutionCallbacks
  ): Promise<void> {
    // BFS execution logic (moved from routine-executor.ts)
  }
}
```

#### Temporal Integration
```typescript
// apps/workers/src/workflows/routine-executor.ts
import { RoutineExecutor } from "@kianax/execution-engine";
import { getPluginRegistry } from "@kianax/plugins";

export async function routineExecutor(input: RoutineInput): Promise<void> {
  const { routineId, userId, triggerData } = input;
  const { workflowId: executionId, runId } = workflowInfo();

  // Create execution record
  await createRoutineExecution({ routineId, userId, workflowId: executionId, runId });

  // Create executor instance
  const executor = new RoutineExecutor(getPluginRegistry());

  try {
    // Execute routine with Temporal-specific callbacks
    const result = await executor.execute(input, {
      onNodeStart: async (nodeId) => {
        await storeNodeResult({
          workflowId: executionId,
          routineId,
          nodeId,
          status: 'running',
          startedAt: Date.now(),
        });
      },
      onNodeComplete: async (nodeId, result) => {
        await storeNodeResult({
          workflowId: executionId,
          routineId,
          nodeId,
          status: 'completed',
          output: result.outputs,
          completedAt: Date.now(),
        });
      },
      onNodeError: async (nodeId, error) => {
        await storeNodeResult({
          workflowId: executionId,
          routineId,
          nodeId,
          status: 'failed',
          error: { message: error.message, stack: error.stack },
          completedAt: Date.now(),
        });
      },
    });

    await updateRoutineStatus({
      workflowId: executionId,
      routineId,
      status: result.status,
      completedAt: Date.now(),
    });
  } catch (error: any) {
    await updateRoutineStatus({
      workflowId: executionId,
      routineId,
      status: 'failed',
      error: { message: error.message, stack: error.stack },
      completedAt: Date.now(),
    });
    throw error;
  }
}
```

**Benefits:**
- Execution engine is Temporal-agnostic
- Can be tested without Temporal infrastructure
- Could be used in other contexts (serverless functions, edge workers)
- Clear separation between orchestration and execution
- Easier to mock for testing

---

## 7. Implementation Order

### Phase 1: Foundation (Week 1)
1. Create `packages/execution-engine` package structure
2. Define new type structures (`ports.ts`, `parameters.ts`, `execution.ts`)
3. Update plugin builder API
4. Create plugin registry v2
5. Update one example plugin (e.g., `http-request`) to new structure

### Phase 2: Execution Engine Migration (Week 1-2)
1. Move graph execution logic to `execution-engine/engine/graph-executor.ts`
2. Move execution state to `execution-engine/engine/execution-state.ts`
3. Create `RoutineExecutor` class with callback-based API
4. Implement execution context in engine package
5. Update Temporal workflow to use new executor with callbacks

### Phase 3: Validation (Week 2)
1. Move graph validation to `execution-engine/validation/`
2. Implement routine validator in `packages/shared/validation/`
3. Implement schema compatibility checker
4. Add save-time validation to Convex mutations
5. Update UI to display validation errors

### Phase 4: UI Generation (Week 2-3)
1. Create parameter form generator
2. Update routine editor to use auto-generated forms
3. Remove custom config UI code from plugins
4. Update all plugins to use declarative parameters

### Phase 5: Plugin Migration (Week 3)
1. Migrate all existing plugins to new structure
2. Update plugin execution to use new context API
3. Test each plugin individually
4. Update plugin documentation

### Phase 6: Integration & Testing (Week 3-4)
1. End-to-end testing of execution engine
2. Integration testing with Temporal
3. Performance testing
4. Update all documentation
5. Migration guide for plugin developers

---

## 8. Critical Files to Modify

### New Package
- `packages/execution-engine/` - New dedicated package for execution logic
  - `src/index.ts` - Public API exports
  - `src/engine/executor.ts` - Main RoutineExecutor class
  - `src/engine/graph-executor.ts` - BFS traversal logic (moved from workers)
  - `src/engine/execution-state.ts` - State management
  - `src/engine/input-gatherer.ts` - Port-based input gathering
  - `src/validation/graph-validator.ts` - Graph validation
  - `src/validation/connection-validator.ts` - Connection validation
  - `src/context/execution-context.ts` - Plugin execution context
  - `src/types/execution.ts` - Execution types
  - `src/types/graph.ts` - Graph types
  - `package.json` - Package config with dependencies

### New Files in Existing Packages
- `packages/plugin-sdk/src/types/ports.ts` - Port definitions
- `packages/plugin-sdk/src/types/parameters.ts` - Parameter definitions
- `packages/shared/src/validation/routine-validator.ts` - Save-time validation
- `packages/shared/src/validation/schema-compatibility.ts` - Schema checking
- `apps/web/src/components/routine-editor/parameter-form.tsx` - Auto-generated forms

### Modified Files
- `packages/plugin-sdk/src/builder.ts` - Update builder API with new port/parameter system
- `packages/plugin-sdk/src/types/plugin-base.ts` - New plugin structure
- `packages/plugins/src/registry.ts` - Simplified registry with metadata caching
- `apps/server/convex/schema.ts` - Updated connection schema (sourcePort/targetPort)
- `apps/server/convex/routines.ts` - Add save-time validation
- `apps/workers/src/workflows/routine-executor.ts` - Use RoutineExecutor with callbacks
- `apps/workers/src/activities/plugins.ts` - Delegate to execution engine

### Files to Remove/Deprecate
- `apps/workers/src/lib/graph-executor.ts` - Moved to execution-engine package
- `packages/plugin-sdk/src/types/plugin-base.ts` (legacy class pattern) - Remove after migration

### Plugins to Migrate
- `packages/plugins/src/nodes/http-request.ts`
- `packages/plugins/src/nodes/if-else.ts`
- `packages/plugins/src/nodes/ai-transform.ts`
- `packages/plugins/src/nodes/loop-control.ts`
- `packages/plugins/src/nodes/static-data.ts`
- `packages/plugins/src/nodes/mock-weather.ts`

---

## Key Benefits Summary

1. **Type Safety**
   - Compile-time validation of plugin structure
   - Runtime validation of connections
   - Type-safe execution context

2. **Early Validation**
   - Validate routines on save
   - Check plugin existence, ports, and schemas
   - Prevent invalid routines from being saved

3. **Developer Experience**
   - Declarative parameter definitions
   - Auto-generated UIs
   - Simplified plugin API
   - Clear separation of concerns

4. **Better Data Model**
   - Explicit port mapping (no implicit merging)
   - Data lineage tracking
   - Structured execution results
   - Type-safe connections

5. **Versioning & Evolution**
   - Plugin versioning support
   - Migration functions
   - Schema evolution
   - Backward compatibility when needed

---

## Key Insights from n8n Architecture

1. **Separation of Concerns**: Node instance vs node type, execution data vs metadata
2. **Declarative > Imperative**: Most nodes defined declaratively with routing rules
3. **Data Lineage Tracking**: `pairedItem` system enables debugging and visualization
4. **Rich Type System**: 30+ parameter types with conditional display
5. **Resumability First**: Execution state designed to pause/resume
6. **Expression System**: Magic variables and proxy-based evaluation
7. **Multi-run Support**: Arrays of task data enable loop nodes
8. **Type-Safe Connections**: Different connection types for different data flows
9. **Helper Context**: Execution context provides everything nodes need

---

## Success Criteria

- ✅ All plugins migrated to new declarative structure
- ✅ Save-time validation prevents 90%+ of runtime errors
- ✅ Auto-generated UIs work for all parameter types
- ✅ Type safety enforced at compile and runtime
- ✅ Clear error messages for validation failures
- ✅ Data lineage visible in execution logs
- ✅ Plugin development requires 50% less code
