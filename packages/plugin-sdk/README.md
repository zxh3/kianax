# Kianax Plugin SDK

Build powerful, type-safe plugins for the Kianax automation platform.

## Installation

```bash
npm install @kianax/plugin-sdk
# or
bun add @kianax/plugin-sdk
```

## Quick Start

### Builder Pattern (Recommended)

The builder pattern provides the best developer experience with full type inference:

```typescript
import { createPlugin, z } from "@kianax/plugin-sdk";

export const myPlugin = createPlugin("my-plugin")
  .withMetadata({
    name: "My Plugin",
    description: "Does something awesome",
    version: "1.0.0",
    tags: ["api", "data"],
    icon: "🚀",
  })
  .withInput("query", {
    label: "Search Query",
    description: "Text to search for",
    schema: z.object({ text: z.string() }),
  })
  .withOutput("results", {
    label: "Results",
    schema: z.object({ items: z.array(z.string()) }),
  })
  .withConfig(
    z.object({
      apiKey: z.string().describe("API key for authentication"),
    }),
  )
  .execute(async ({ inputs, config, context }) => {
    // Fully typed! inputs.query.text is string
    const searchText = inputs.query.text;
    const apiKey = config.apiKey; // Also fully typed!

    // Your plugin logic here
    const items = await searchApi(searchText, apiKey);

    return { results: { items } };
  })
  .build();
```

### Class Pattern (Alternative)

The class-based pattern is still supported for complex plugins:

```typescript
import { Plugin, type PluginMetadata, z } from "@kianax/plugin-sdk";

export class MyPlugin extends Plugin {
  static metadata: PluginMetadata = {
    id: "my-plugin",
    name: "My Plugin",
    description: "Does something awesome",
    version: "1.0.0",
    tags: ["api", "data"],
    icon: "🚀",
  };

  defineSchemas() {
    return {
      inputs: {
        query: {
          name: "query",
          label: "Search Query",
          schema: z.object({ text: z.string() }),
        },
      },
      outputs: {
        results: {
          name: "results",
          label: "Results",
          schema: z.object({ items: z.array(z.string()) }),
        },
      },
      config: z.object({ apiKey: z.string() }),
    };
  }

  async execute(inputs: any, config: any, context: any) {
    const searchText = inputs.query.text;
    const items = await searchApi(searchText, config.apiKey);
    return { results: { items } };
  }
}
```

## Builder API Reference

### `createPlugin(id: string)`

Create a new plugin builder. The ID must be unique across all plugins.

```typescript
const builder = createPlugin("unique-plugin-id");
```

### `.withMetadata(metadata)`

Set plugin metadata (name, description, version, etc.)

**Required fields:**

- `name` - Human-readable plugin name
- `description` - What the plugin does
- `version` - Semantic version (e.g., "1.0.0")
- `tags` - Array of tags for discovery

**Optional fields:**

- `icon` - Emoji or URL
- `author` - Object with name, email, url

```typescript
builder.withMetadata({
  name: "Weather API",
  description: "Fetch current weather data",
  version: "1.0.0",
  tags: ["api", "weather", "input"],
  icon: "☀️",
  author: {
    name: "Your Name",
    url: "https://yoursite.com",
  },
});
```

### `.withInput(name, definition)`

Add an input port. Can be called multiple times for multiple inputs.

```typescript
builder.withInput("location", {
  label: "Location",
  description: "City name or coordinates",
  schema: z.object({
    city: z.string(),
    country: z.string().optional(),
  }),
});
```

### `.withOutput(name, definition)`

Add an output port. Can be called multiple times. **At least one output is required.**

```typescript
builder.withOutput("weather", {
  label: "Weather Data",
  description: "Current weather information",
  schema: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number(),
  }),
});
```

### `.withConfig(schema)`

Set the configuration schema. Configuration is plugin-level settings (like API keys) that don't change between executions.

```typescript
builder.withConfig(
  z.object({
    apiKey: z.string().describe("OpenWeather API key"),
    units: z.enum(["metric", "imperial"]).default("metric"),
  }),
);
```

### `.withCredentials(credentials[])`

Specify required credentials (API keys, OAuth tokens, etc.)

```typescript
builder.withCredentials([
  {
    key: "apiKey",
    label: "API Key",
    description: "Your service API key",
    type: "password",
    required: true,
  },
]);
```

### `.withConfigUI(component)`

Provide a custom React component for configuration UI.

```typescript
import { MyConfigUI } from "./config-ui";

builder.withConfigUI(MyConfigUI);
```

### `.execute(fn)`

Set the execution function. This is where your plugin logic lives.

**Fully typed parameters:**

- `inputs` - All input port values (typed based on schemas)
- `config` - Configuration values (typed based on config schema)
- `context` - Execution context (userId, routineId, etc.)

```typescript
builder.execute(async ({ inputs, config, context }) => {
  // All fully typed!
  const city = inputs.location.city; // string
  const apiKey = config.apiKey; // string
  const userId = context.userId; // string

  // Your logic here...
  const weatherData = await fetchWeather(city, apiKey);

  // Return must match output schemas
  return {
    weather: {
      temperature: weatherData.temp,
      condition: weatherData.condition,
      humidity: weatherData.humidity,
    },
  };
});
```

### `.build()`

Build and return the final Plugin instance. Validates that all required fields are set.

```typescript
const plugin = builder.build();
```

## Type Safety

The builder pattern provides complete type inference:

```typescript
createPlugin("example")
  .withInput("user", {
    schema: z.object({ name: z.string(), age: z.number() }),
  })
  .withOutput("greeting", {
    schema: z.object({ message: z.string() }),
  })
  .withConfig(z.object({ prefix: z.string() }))
  .execute(async ({ inputs, config }) => {
    // TypeScript knows:
    inputs.user.name; // ✓ string
    inputs.user.age; // ✓ number
    config.prefix; // ✓ string

    // Type errors:
    inputs.user.email; // ✗ Property 'email' does not exist
    inputs.unknown; // ✗ Property 'unknown' does not exist

    return {
      greeting: {
        message: `${config.prefix} ${inputs.user.name}`,
      },
    };
  })
  .build();
```

## Plugin Context

The `context` object provides execution environment information:

```typescript
interface PluginContext {
  userId: string; // User executing the routine
  routineId: string; // Routine being executed
  executionId: string; // Unique execution ID
  nodeId: string; // This plugin node's ID
  credentials?: Record<string, string>; // User's credentials
  triggerData?: unknown; // Data from trigger
}
```

## Examples

### Data Source (No Inputs)

```typescript
export const randomNumberPlugin = createPlugin("random-number")
  .withMetadata({
    name: "Random Number",
    description: "Generate a random number",
    version: "1.0.0",
    tags: ["input", "data", "random"],
  })
  .withOutput("number", {
    label: "Number",
    schema: z.object({ value: z.number() }),
  })
  .withConfig(
    z.object({
      min: z.number().default(0),
      max: z.number().default(100),
    }),
  })
  .execute(async ({ config }) => {
    const value = Math.random() * (config.max - config.min) + config.min;
    return { number: { value } };
  })
  .build();
```

### Data Transformer (Input → Output)

```typescript
export const upperCasePlugin = createPlugin("uppercase")
  .withMetadata({
    name: "Uppercase",
    description: "Convert text to uppercase",
    version: "1.0.0",
    tags: ["transform", "text"],
  })
  .withInput("text", {
    label: "Text",
    schema: z.object({ value: z.string() }),
  })
  .withOutput("result", {
    label: "Result",
    schema: z.object({ value: z.string() }),
  })
  .execute(async ({ inputs }) => {
    return {
      result: { value: inputs.text.value.toUpperCase() },
    };
  })
  .build();
```

### API Integration

```typescript
export const githubPlugin = createPlugin("github-stars")
  .withMetadata({
    name: "GitHub Stars",
    description: "Get star count for a repository",
    version: "1.0.0",
    tags: ["api", "github", "input"],
  })
  .withInput("repo", {
    label: "Repository",
    schema: z.object({
      owner: z.string(),
      name: z.string(),
    }),
  })
  .withOutput("stats", {
    label: "Statistics",
    schema: z.object({
      stars: z.number(),
      forks: z.number(),
    }),
  })
  .withCredentials([
    {
      key: "githubToken",
      label: "GitHub Token",
      type: "password",
      required: false,
    },
  ])
  .execute(async ({ inputs, context }) => {
    const { owner, name } = inputs.repo;
    const token = context.credentials?.githubToken;

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${name}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );

    const data = await response.json();

    return {
      stats: {
        stars: data.stargazers_count,
        forks: data.forks_count,
      },
    };
  })
  .build();
```

## Best Practices

### 1. Use Descriptive Schemas

```typescript
// Good
z.object({
  city: z.string().describe("City name (e.g., San Francisco)"),
  units: z.enum(["celsius", "fahrenheit"]).describe("Temperature units"),
});

// Bad
z.object({
  city: z.string(),
  units: z.string(),
});
```

### 2. Validate Early

Let Zod handle validation - don't manually check inputs:

```typescript
// Good - schema enforces this
schema: z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
})

// Bad - manual validation in execute
execute: async ({ inputs }) => {
  if (!inputs.email.includes('@')) throw new Error('Invalid email');
  if (inputs.age < 0) throw new Error('Invalid age');
}
```

### 3. Use Proper Tags

Help users discover your plugin:

```typescript
tags: [
  "input", // or "output", "transform", "logic"
  "api", // category
  "github", // service name
  "data", // type
];
```

### 4. Handle Errors Gracefully

```typescript
.execute(async ({ inputs }) => {
  try {
    const result = await apiCall(inputs.query);
    return { result };
  } catch (error) {
    throw new Error(`API call failed: ${error.message}`);
  }
})
```

## Testing

```typescript
import { describe, it, expect } from "bun:test";

describe("MyPlugin", () => {
  it("should transform input correctly", async () => {
    const result = await myPlugin.execute(
      {
        input: { text: "hello" },
      },
      { /* config */ },
      {
        userId: "test-user",
        routineId: "test-routine",
        executionId: "test-exec",
        nodeId: "test-node",
      },
    );

    expect(result.output.text).toBe("HELLO");
  });
});
```

## Migration from Class Pattern

See [PLUGIN_MIGRATION.md](../../docs/PLUGIN_MIGRATION.md) for a detailed guide on migrating from class-based to builder-based plugins.

## License

MIT
