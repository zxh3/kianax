# Plugin Development Guide

Complete guide for building, testing, and contributing plugins to Kianax routines.

**Note:** This is the guide for Phase 2's builder pattern plugin architecture. Currently, all plugins are built into the monorepo.

## Table of Contents

- [Overview](#overview)
- [Plugin Architecture](#plugin-architecture)
- [Getting Started](#getting-started)
- [Plugin Types](#plugin-types)
- [Building Your First Plugin](#building-your-first-plugin)
- [Schema Definition with Zod](#schema-definition-with-zod)
- [Testing Plugins](#testing-plugins)
- [Credential Management](#credential-management)
- [Publishing Plugins](#publishing-plugins)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

Kianax plugins are self-contained TypeScript modules built with a **builder pattern API** that execute as Temporal Activities. Each plugin defines:

- **Metadata** - Name, description, version, icon, tags, author
- **Input/Output ports** - Named ports with Zod schemas for type safety
- **Configuration** - Optional UI-configurable settings with custom React components
- **Execute function** - The plugin logic with full type inference

**Key Benefits:**
- ✅ Builder pattern API with full type inference
- ✅ Multiple input/output ports (not just single in/out)
- ✅ Custom config UI components (React)
- ✅ Automatic validation of inputs/outputs with Zod
- ✅ Secure credential management (coming in Phase 3)
- ✅ Works with visual routine editor (ReactFlow)

## Plugin Architecture

```
Plugin Definition (definePlugin)
    ↓
Input Schema (Zod) → Validate → Execute Logic → Validate → Output Schema (Zod)
                                      ↓
                            Access credentials, context
                            Make API calls, transform data
```

**Plugins run as Temporal Activities**, which means:
- ✅ Can make network calls (HTTP, databases, external APIs)
- ✅ Can use Date.now() and other non-deterministic operations
- ✅ Automatic retries on failure
- ✅ Timeout protection
- ✅ Activity heartbeats for long-running operations

**NOT allowed:**
- ❌ Accessing other users' data (enforced by context isolation)
- ❌ Calling arbitrary URLs (must be declared in plugin manifest)

## Getting Started

### Prerequisites

- Node.js 18+ with Bun
- TypeScript knowledge
- Familiarity with Zod (schema validation library)

### Install Plugin SDK

The Plugin SDK is already available in the monorepo:

```bash
# If working in the monorepo
cd /path/to/kianax
bun install

# The SDK is at packages/plugin-sdk
```

### CLI Tools

The plugin CLI provides commands to scaffold, test, and validate plugins:

```bash
# Create a new plugin
plugin create my-plugin --type input

# Test a plugin locally
plugin test ./plugins/my-plugin/index.ts

# Validate plugin structure
plugin validate ./plugins/my-plugin/index.ts
```

## Plugin Types

Kianax has 4 plugin types:

### 1. **Input** - Data Sources
Fetch data from external sources (APIs, databases, files).

**Examples:** Stock prices, Twitter feed, RSS reader, Database query

```typescript
type: "input"
input: {} (usually empty or minimal)
output: { data: any } (the fetched data)
```

### 2. **Processor** - Data Transformers
Transform, filter, or enrich data.

**Examples:** AI Transform, JSON parser, Data mapper, Text formatter

```typescript
type: "processor"
input: { data: any } (data to process)
output: { data: any } (transformed data)
```

### 3. **Logic** - Conditional Branching
Evaluate conditions and route workflow execution.

**Examples:** If-Else, Switch-Case, Filter, Data validator

```typescript
type: "logic"
input: { data: any, condition: string }
output: { result: boolean, branch: "true" | "false" }
```

### 4. **Output** - Actions
Send data to external services or trigger actions.

**Examples:** Email sender, HTTP request, Slack message, Database insert

```typescript
type: "output"
input: { data: any, ...params }
output: { success: boolean, message?: string }
```

## Building Your First Plugin

### Step 1: Create Plugin Structure

Use the CLI to generate a plugin template:

```bash
plugin create weather-fetch --type input
```

This creates `weather-fetch.ts` with a complete plugin template.

### Step 2: Define Your Plugin (Builder Pattern)

```typescript
import { createPlugin, z } from "@kianax/plugin-sdk";

// Define schemas
const inputSchema = z.object({
  city: z.string().describe("City name"),
  units: z.enum(["metric", "imperial"]).optional().default("metric"),
});

const outputSchema = z.object({
  temperature: z.number(),
  condition: z.string(),
  humidity: z.number(),
  city: z.string(),
});

const configSchema = z.object({
  refreshInterval: z.number().optional().default(300),
});

export const weatherFetchPlugin = createPlugin("weather-fetch")
  .withMetadata({
    name: "Weather Fetch",
    description: "Fetch current weather data for a city",
    version: "1.0.0",
    icon: "🌤️",
    tags: ["weather", "data-source", "api"],
    author: {
      name: "Your Name",
      url: "https://yoursite.com",
    },
  })
  .withInput("params", {
    label: "Parameters",
    description: "Weather fetch parameters",
    schema: inputSchema,
  })
  .withOutput("weather", {
    label: "Weather Data",
    description: "Current weather information",
    schema: outputSchema,
  })
  .withConfig(configSchema)
  // Optional: Add custom config UI component
  // .withConfigUI(WeatherConfigUI)
  .execute(async ({ inputs, config }) => {
    // Fully typed! inputs.params is typed from inputSchema
    const { city, units } = inputs.params;

    // TODO: Add credential support in Phase 3
    const apiKey = process.env.WEATHER_API_KEY;

    if (!apiKey) {
      throw new Error("Weather API key not configured");
    }

    // Make API request
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Return on the "weather" output port (fully typed!)
    return {
      weather: {
        temperature: data.main.temp,
        condition: data.weather[0].description,
        humidity: data.main.humidity,
        city: data.name,
      },
    };
  })
  .build();
```

### Step 3: Test Your Plugin

```bash
plugin test weather-fetch.ts
```

Or use the PluginTester programmatically:

```typescript
import { PluginTester } from "@kianax/plugin-sdk/testing";
import { weatherFetch } from "./weather-fetch";

const tester = new PluginTester(weatherFetch);

const result = await tester.execute({
  input: { city: "London", units: "metric" },
  credentials: { weatherApiKey: "your-test-key" },
});

console.log(result);
```

## Schema Definition with Zod

Kianax uses [Zod](https://zod.dev/) for runtime validation and TypeScript type inference.

### Common Schema Patterns

```typescript
import { z } from "@kianax/plugin-sdk";

// String with validation
z.string().min(1).max(100).email()
z.string().url()
z.string().regex(/^\d{4}-\d{2}-\d{2}$/) // Date format

// Numbers
z.number().int().positive()
z.number().min(0).max(100)

// Enums
z.enum(["small", "medium", "large"])

// Arrays
z.array(z.string())
z.array(z.object({ id: z.string(), value: z.number() }))

// Objects
z.object({
  name: z.string(),
  age: z.number().optional(),
  tags: z.array(z.string()).default([]),
})

// Union types
z.union([z.string(), z.number()])

// Transform data
z.string().transform((val) => val.toUpperCase())

// Custom validation
z.string().refine((val) => val.startsWith("SK-"), {
  message: "API key must start with SK-",
})
```

### Schema Descriptions

Add descriptions for better UX in the routine builder UI:

```typescript
inputSchema: z.object({
  query: z.string().describe("Search query (e.g., 'machine learning')"),
  limit: z.number().min(1).max(100).default(10).describe("Maximum results"),
})
```

## Testing Plugins

### Manual Testing with CLI

```bash
# Test with default mock data
plugin test ./plugins/my-plugin/index.ts

# Test with custom data (create test-data.json)
plugin test ./plugins/my-plugin/index.ts
```

### Programmatic Testing

```typescript
import { PluginTester, mockContext } from "@kianax/plugin-sdk/testing";
import { myPlugin } from "./my-plugin";

// Create tester
const tester = new PluginTester(myPlugin);

// Test execution
const result = await tester.execute({
  input: { query: "test" },
  config: { maxResults: 10 },
  credentials: { apiKey: "test-key" },
  context: { userId: "user-123" }, // Override context fields
});

// Test validation
const validInput = tester.validateInput({ query: "test" }); // ✅ Pass
const invalidInput = tester.validateInput({ foo: "bar" }); // ❌ Throws

// Get metadata
const metadata = tester.getMetadata();
console.log(metadata.name, metadata.version);
```

## Credential Management

### Defining Credentials

```typescript
credentials: [
  {
    key: "apiKey",
    label: "API Key",
    description: "Your service API key (starts with sk-)",
    type: "password", // or "text" | "oauth"
    required: true,
    pattern: "^sk-", // Optional regex validation
  },
  {
    key: "apiSecret",
    label: "API Secret",
    type: "password",
    required: false,
  },
],
```

### OAuth Credentials

For OAuth-based services:

```typescript
credentials: [
  {
    key: "googleAuth",
    label: "Google Account",
    type: "oauth",
    required: true,
    oauth: {
      provider: "google",
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
    },
  },
],
```

### Accessing Credentials

```typescript
async execute(input, config, context) {
  const apiKey = context.credentials?.apiKey;

  if (!apiKey) {
    throw new Error("API key not configured");
  }

  // Use credential in API call
  const response = await fetch("https://api.example.com/data", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  // ...
}
```

**Security:**
- ✅ Credentials are encrypted at rest
- ✅ Scoped per user (never shared between users)
- ✅ Only accessible to plugins that declare them
- ✅ Never logged or exposed in workflow history

## Publishing Plugins

### Phase 1: Monorepo Contribution (Current)

1. **Create your plugin** in `plugins/<category>/<name>/index.ts`
2. **Register in registry** at `plugins/registry.ts`
3. **Submit a Pull Request** with:
   - Plugin code
   - Tests (if applicable)
   - README with usage examples
4. **Code review** by Kianax team
5. **Merge** and deploy with next release

### Phase 2: GitHub-Based (Coming Soon)

- Submit plugins via GitHub PR to dedicated repo
- Automated tests and validation
- Community review process
- Version tagging and releases

### Phase 3: npm-like Registry (Future)

- `plugin publish` command
- Semantic versioning
- Dependency management
- Private plugins for teams

## Best Practices

### 1. Error Handling

Always provide clear error messages:

```typescript
async execute(input, config, context) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return processData(await response.json());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Weather fetch failed: ${error.message}`);
    }
    throw error;
  }
}
```

### 2. Validate External Data

Don't trust external API responses - validate with Zod:

```typescript
const apiResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    value: z.number(),
  })),
});

const response = await fetch(url);
const json = await response.json();

// Validate before processing
const validatedData = apiResponseSchema.parse(json);
```

### 3. Use Descriptive Schemas

```typescript
// ❌ Bad
inputSchema: z.object({
  q: z.string(),
  n: z.number(),
})

// ✅ Good
inputSchema: z.object({
  query: z.string().describe("Search query string"),
  maxResults: z.number().min(1).max(100).describe("Maximum number of results to return"),
})
```

### 4. Handle Timeouts

For long-running operations, send heartbeats:

```typescript
import { Context } from "@temporalio/activity";

async execute(input, config, context) {
  for (let i = 0; i < largeDataset.length; i++) {
    // Send heartbeat every 100 iterations
    if (i % 100 === 0) {
      Context.current().heartbeat();
    }

    await processItem(largeDataset[i]);
  }
}
```

### 5. Credential Validation

Check credentials early:

```typescript
async execute(input, config, context) {
  const apiKey = context.credentials?.apiKey;

  if (!apiKey) {
    throw new Error("API key is required. Please configure your credentials in Settings.");
  }

  if (!apiKey.startsWith("sk-")) {
    throw new Error("Invalid API key format. Key must start with 'sk-'");
  }

  // Now use the credential...
}
```

## Examples

### Complete Examples

See the official plugins for reference implementations:

- **[If-Else](../../packages/plugins/if-else/index.ts)** - Conditional logic with custom config UI
- **[AI Transform](../../packages/plugins/ai-transformer/index.ts)** - AI-powered data transformation
- **[Stock Price](../../packages/plugins/stock-price/index.ts)** - Stock data source
- **[HTTP Request](../../packages/plugins/http/index.ts)** - Generic HTTP client
- **[Email](../../packages/plugins/email/index.ts)** - Email sender
- **[Static Data](../../packages/plugins/static-data/index.ts)** - Simple data source
- **[Mock Weather](../../packages/plugins/mock-weather/index.ts)** - Mock weather data

### Mini Examples

#### Simple Data Source Plugin

```typescript
import { createPlugin, z } from "@kianax/plugin-sdk";

const configSchema = z.object({
  min: z.number().default(0),
  max: z.number().default(100),
});

const outputSchema = z.object({
  value: z.number(),
});

export const randomNumberPlugin = createPlugin("random-number")
  .withMetadata({
    name: "Random Number",
    description: "Generate a random number",
    version: "1.0.0",
    icon: "🎲",
    tags: ["data-source", "utility"],
  })
  .withOutput("number", {
    label: "Random Number",
    schema: outputSchema,
  })
  .withConfig(configSchema)
  .execute(async ({ config }) => {
    return {
      number: {
        value: Math.random() * (config.max - config.min) + config.min,
      },
    };
  })
  .build();
```

#### Simple Processor Plugin

```typescript
import { createPlugin, z } from "@kianax/plugin-sdk";

const inputSchema = z.object({
  text: z.string(),
});

const outputSchema = z.object({
  text: z.string(),
});

export const uppercasePlugin = createPlugin("uppercase")
  .withMetadata({
    name: "Uppercase Text",
    description: "Convert text to uppercase",
    version: "1.0.0",
    icon: "🔤",
    tags: ["processor", "text"],
  })
  .withInput("text", {
    label: "Input Text",
    schema: inputSchema,
  })
  .withOutput("result", {
    label: "Uppercase Text",
    schema: outputSchema,
  })
  .execute(async ({ inputs }) => {
    return {
      result: {
        text: inputs.text.text.toUpperCase(),
      },
    };
  })
  .build();
```

---

## Need Help?

- **GitHub Issues**: Report bugs or request features
- **Documentation**: Check `/docs` for architecture and guides
- **Examples**: Study existing plugins in `/plugins`

Happy plugin building! 🚀
