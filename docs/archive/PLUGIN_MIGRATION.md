# Plugin Migration Guide: Class-Based to Builder Pattern

This guide helps you migrate existing class-based plugins to the new builder pattern.

## Why Migrate?

The builder pattern provides several advantages:

- **Full Type Safety**: Input, output, and config types are automatically inferred in the execute function
- **Less Boilerplate**: No duplicate port names, cleaner syntax
- **Better DX**: Autocomplete works everywhere, catch errors at compile-time
- **Progressive Enhancement**: Start simple and add complexity as needed

## Quick Comparison

### Before (Class-Based)

```typescript
export class WeatherPlugin extends Plugin {
  static metadata: PluginMetadata = {
    id: "weather",
    name: "Weather API",
    description: "Fetch weather data",
    version: "1.0.0",
    tags: ["api", "weather"],
    icon: "☀️",
  };

  defineSchemas() {
    return {
      inputs: {
        location: {
          name: "location", // Redundant!
          label: "Location",
          description: "City name",
          schema: z.object({ city: z.string() }),
        },
      },
      outputs: {
        weather: {
          name: "weather", // Redundant!
          label: "Weather Data",
          schema: z.object({ temp: z.number() }),
        },
      },
      config: z.object({ apiKey: z.string() }),
    };
  }

  async execute(inputs: any, config: any, context: any) {
    // No type safety here!
    const city = inputs.location.city;
    const apiKey = config.apiKey;
    // ...
    return { weather: { temp: 72 } };
  }
}
```

### After (Builder Pattern)

```typescript
export const weatherPlugin = createPlugin("weather")
  .withMetadata({
    name: "Weather API",
    description: "Fetch weather data",
    version: "1.0.0",
    tags: ["api", "weather"],
    icon: "☀️",
  })
  .withInput("location", {
    label: "Location",
    description: "City name",
    schema: z.object({ city: z.string() }),
  })
  .withOutput("weather", {
    label: "Weather Data",
    schema: z.object({ temp: z.number() }),
  })
  .withConfig(z.object({ apiKey: z.string() }))
  .execute(async ({ inputs, config, context }) => {
    // Fully typed!
    const city = inputs.location.city; // string
    const apiKey = config.apiKey; // string
    // ...
    return { weather: { temp: 72 } };
  })
  .build();
```

## Step-by-Step Migration

### Step 1: Change Import

```diff
-import { Plugin, type PluginMetadata, z } from "@kianax/plugin-sdk";
+import { createPlugin, z } from "@kianax/plugin-sdk";
```

### Step 2: Convert Metadata

**Before:**

```typescript
export class MyPlugin extends Plugin {
  static metadata: PluginMetadata = {
    id: "my-plugin",
    name: "My Plugin",
    // ...
  };
}
```

**After:**

```typescript
export const myPlugin = createPlugin("my-plugin").withMetadata({
  name: "My Plugin",
  // ... (id is in createPlugin call)
});
```

**Note:** The `id` moves from metadata to the `createPlugin()` function call.

### Step 3: Convert Inputs

**Before:**

```typescript
defineSchemas() {
  return {
    inputs: {
      query: {
        name: "query",  // Remove this line
        label: "Query",
        description: "Search query",
        schema: z.object({ text: z.string() })
      }
    }
  };
}
```

**After:**

```typescript
.withInput("query", {
  // name parameter becomes the method argument
  label: "Query",
  description: "Search query",
  schema: z.object({ text: z.string() })
})
```

**Key changes:**

- `name` field is removed (becomes method parameter)
- Each input is a separate `.withInput()` call
- No need to wrap in `inputs: {}`

### Step 4: Convert Outputs

**Before:**

```typescript
outputs: {
  results: {
    name: "results",  // Remove this line
    label: "Results",
    schema: z.object({ items: z.array(z.string()) })
  }
}
```

**After:**

```typescript
.withOutput("results", {
  label: "Results",
  schema: z.object({ items: z.array(z.string()) })
})
```

Same pattern as inputs.

### Step 5: Convert Config

**Before:**

```typescript
config: z.object({ apiKey: z.string() })
```

**After:**

```typescript
.withConfig(z.object({ apiKey: z.string() }))
```

Simple wrapper method.

### Step 6: Convert Execute Function

**Before:**

```typescript
async execute(inputs: any, config: any, context: any) {
  const query = inputs.query.text;
  const apiKey = config.apiKey;
  // ...
  return { results: { items: [] } };
}
```

**After:**

```typescript
.execute(async ({ inputs, config, context }) => {
  const query = inputs.query.text; // Now fully typed!
  const apiKey = config.apiKey;     // Also typed!
  // ...
  return { results: { items: [] } };
})
```

**Key changes:**

- Parameters become destructured object: `{ inputs, config, context }`
- Full type inference - no more `any` types!

### Step 7: Add `.build()`

Don't forget to call `.build()` at the end:

```typescript
.execute(async ({ inputs, config, context }) => {
  // ...
})
.build(); // Required!
```

### Step 8: Export as Const

**Before:**

```typescript
export class MyPlugin extends Plugin { ... }
```

**After:**

```typescript
export const myPlugin = createPlugin("my-plugin")
  // ...
  .build();
```

## Complete Examples

### Example 1: Simple Data Source

**Before:**

```typescript
export class RandomNumberPlugin extends Plugin {
  static metadata: PluginMetadata = {
    id: "random-number",
    name: "Random Number",
    description: "Generate random numbers",
    version: "1.0.0",
    tags: ["input", "data"],
  };

  defineSchemas() {
    return {
      inputs: {},
      outputs: {
        number: {
          name: "number",
          label: "Number",
          schema: z.object({ value: z.number() }),
        },
      },
      config: z.object({
        min: z.number().default(0),
        max: z.number().default(100),
      }),
    };
  }

  async execute(_inputs: any, config: any, _context: any) {
    const value = Math.random() * (config.max - config.min) + config.min;
    return { number: { value } };
  }
}
```

**After:**

```typescript
export const randomNumberPlugin = createPlugin("random-number")
  .withMetadata({
    name: "Random Number",
    description: "Generate random numbers",
    version: "1.0.0",
    tags: ["input", "data"],
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
  )
  .execute(async ({ config }) => {
    const value = Math.random() * (config.max - config.min) + config.min;
    return { number: { value } };
  })
  .build();
```

### Example 2: Transformer Plugin

**Before:**

```typescript
export class UpperCasePlugin extends Plugin {
  static metadata: PluginMetadata = {
    id: "uppercase",
    name: "Uppercase",
    description: "Convert to uppercase",
    version: "1.0.0",
    tags: ["transform", "text"],
  };

  defineSchemas() {
    return {
      inputs: {
        text: {
          name: "text",
          label: "Text",
          schema: z.object({ value: z.string() }),
        },
      },
      outputs: {
        result: {
          name: "result",
          label: "Result",
          schema: z.object({ value: z.string() }),
        },
      },
    };
  }

  async execute(inputs: any, _config: any, _context: any) {
    return {
      result: { value: inputs.text.value.toUpperCase() },
    };
  }
}
```

**After:**

```typescript
export const upperCasePlugin = createPlugin("uppercase")
  .withMetadata({
    name: "Uppercase",
    description: "Convert to uppercase",
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

### Example 3: API Integration with Credentials

**Before:**

```typescript
export class GitHubPlugin extends Plugin {
  static metadata: PluginMetadata = {
    id: "github-api",
    name: "GitHub API",
    description: "Fetch GitHub data",
    version: "1.0.0",
    tags: ["api", "github"],
    credentials: [
      {
        key: "githubToken",
        label: "GitHub Token",
        type: "password",
        required: true,
      },
    ],
  };

  defineSchemas() {
    return {
      inputs: {
        repo: {
          name: "repo",
          label: "Repository",
          schema: z.object({
            owner: z.string(),
            name: z.string(),
          }),
        },
      },
      outputs: {
        stats: {
          name: "stats",
          label: "Statistics",
          schema: z.object({
            stars: z.number(),
            forks: z.number(),
          }),
        },
      },
    };
  }

  async execute(inputs: any, config: any, context: any) {
    const { owner, name } = inputs.repo;
    const token = context.credentials?.githubToken;
    // ... API call
    return { stats: { stars: 123, forks: 45 } };
  }
}
```

**After:**

```typescript
export const githubPlugin = createPlugin("github-api")
  .withMetadata({
    name: "GitHub API",
    description: "Fetch GitHub data",
    version: "1.0.0",
    tags: ["api", "github"],
  })
  .withCredentials([
    {
      key: "githubToken",
      label: "GitHub Token",
      type: "password",
      required: true,
    },
  ])
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
  .execute(async ({ inputs, context }) => {
    const { owner, name } = inputs.repo;
    const token = context.credentials?.githubToken;
    // ... API call
    return { stats: { stars: 123, forks: 45 } };
  })
  .build();
```

## Common Patterns

### Multiple Inputs

**Before:**

```typescript
inputs: {
  input1: { name: "input1", label: "Input 1", schema: z.string() },
  input2: { name: "input2", label: "Input 2", schema: z.number() },
}
```

**After:**

```typescript
.withInput("input1", { label: "Input 1", schema: z.string() })
.withInput("input2", { label: "Input 2", schema: z.number() })
```

### Multiple Outputs

**Before:**

```typescript
outputs: {
  output1: { name: "output1", label: "Output 1", schema: z.string() },
  output2: { name: "output2", label: "Output 2", schema: z.number() },
}
```

**After:**

```typescript
.withOutput("output1", { label: "Output 1", schema: z.string() })
.withOutput("output2", { label: "Output 2", schema: z.number() })
```

### No Config

If your plugin doesn't need configuration, just omit `.withConfig()`:

```typescript
createPlugin("my-plugin")
  .withMetadata({...})
  .withOutput("result", {...})
  .execute(async ({ inputs }) => {...})
  .build();
```

### No Inputs (Data Source)

If your plugin is a pure data source, just omit `.withInput()`:

```typescript
createPlugin("my-plugin")
  .withMetadata({...})
  .withOutput("data", {...})
  .execute(async () => {...})
  .build();
```

## Updating the Registry

After migrating your plugin, update the registry:

**Before:**

```typescript
import { MyPlugin } from "./my-plugin/plugin";

export const pluginRegistry = new Map([
  [MyPlugin.metadata.id, MyPlugin],
]);
```

**After:**

```typescript
import { myPlugin } from "./my-plugin/plugin";

export const pluginRegistry = new Map([
  [myPlugin.getId(), myPlugin],
]);
```

## Testing

Testing builder plugins is the same as class plugins:

```typescript
import { describe, it, expect } from "bun:test";
import { myPlugin } from "./plugin";

describe("MyPlugin", () => {
  it("should work correctly", async () => {
    const result = await myPlugin.execute(
      { input: { value: "test" } },
      { /* config */ },
      {
        userId: "test-user",
        routineId: "test-routine",
        executionId: "test-exec",
        nodeId: "test-node",
      },
    );

    expect(result.output.value).toBe("TEST");
  });
});
```

## Gradual Migration

You don't have to migrate all plugins at once:

1. **Keep both versions**: Old class-based and new builder-based
2. **Register builder version**: Update registry to use new version
3. **Test thoroughly**: Ensure new version works correctly
4. **Remove old version**: Once confident, delete the class file

## Troubleshooting

### "Property does not exist" errors

This usually means type inference is working! The builder catches type errors at compile-time:

```typescript
.execute(async ({ inputs }) => {
  inputs.query.unknown // Error: Property 'unknown' does not exist
})
```

Fix by using the correct property name from your schema.

### "Cannot read property of undefined"

Make sure all required builder methods are called before `.build()`:

- `.withMetadata()` with name, description, version, tags
- At least one `.withOutput()`
- `.execute()`

### Build errors

If `.build()` throws an error, check that you've provided all required fields:

```typescript
Error: Plugin name is required (use .withMetadata())
Error: At least one output is required (use .withOutput())
Error: Plugin execute function is required (use .execute())
```

## Getting Help

- Check [Plugin SDK README](../packages/plugin-sdk/README.md) for full API reference
- Look at migrated examples in `packages/plugins/*/plugin-builder.ts`
- Ask in #plugin-development channel

## Summary

**Key Changes:**

1. `export class` → `export const`
2. `extends Plugin` → `createPlugin(id)`
3. `static metadata` → `.withMetadata()`
4. `defineSchemas()` → `.withInput()` / `.withOutput()` / `.withConfig()`
5. Remove redundant `name` fields from ports
6. `execute(inputs, config, context)` → `execute({ inputs, config, context })`
7. Add `.build()` at the end

**Benefits:**

- ✅ Full type inference in execute function
- ✅ Less boilerplate code
- ✅ Better autocomplete
- ✅ Compile-time error checking
- ✅ More intuitive API

Happy migrating! 🚀
