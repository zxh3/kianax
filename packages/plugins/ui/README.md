# Plugin Config UI Components

Reusable components for building consistent, professional plugin configuration interfaces.

## Components

### `BaseConfigUI`

Wrapper component that provides consistent spacing and layout.

```tsx
import { BaseConfigUI } from "@kianax/plugins/ui";

<BaseConfigUI title="My Plugin Config" description="Configure your plugin">
  {/* Your config sections here */}
</BaseConfigUI>
```

### `ConfigSection`

Labeled section for form fields with optional description, action button, and error message.

```tsx
import { ConfigSection } from "@kianax/plugins/ui";
import { Input } from "@kianax/ui/components/input";

<ConfigSection
  label="API Key"
  description="Your secret API key"
  required
  error={errors.apiKey}
>
  <Input value={apiKey} onChange={...} />
</ConfigSection>

// With action button
<ConfigSection
  label="Headers"
  action={<Button onClick={addHeader}>Add</Button>}
>
  {headers.map(...)}
</ConfigSection>
```

### `ConfigCard`

Card component for repeated/removable items (conditions, headers, rules, etc.)

```tsx
import { ConfigCard } from "@kianax/plugins/ui";

{conditions.map((condition, i) => (
  <ConfigCard
    key={i}
    title={`Condition ${i + 1}`}
    removable
    onRemove={() => removeCondition(i)}
  >
    <Input value={condition.value} onChange={...} />
  </ConfigCard>
))}
```

### `InfoCard`

Help/tip card for providing context to users.

```tsx
import { InfoCard } from "@kianax/plugins/ui";

<InfoCard title="Usage Tip" variant="info">
  <p>This plugin will make an HTTP request to the specified URL.</p>
</InfoCard>

// Warning variant
<InfoCard variant="warning" title="Important">
  <p>Make sure to keep your API key secure.</p>
</InfoCard>

// Success variant
<InfoCard variant="success" title="Pro Tip">
  <p>Use environment variables for sensitive data.</p>
</InfoCard>
```

## Complete Example

```tsx
"use client";

import { useState } from "react";
import { Input } from "@kianax/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kianax/ui/components/select";
import { BaseConfigUI, ConfigSection, InfoCard } from "@kianax/plugins/ui";

interface MyPluginConfig {
  url: string;
  method: string;
  timeout: number;
}

export function MyPluginConfigUI({
  value,
  onChange
}: {
  value?: MyPluginConfig;
  onChange: (val: MyPluginConfig) => void;
}) {
  const [config, setConfig] = useState(value || {
    url: "",
    method: "GET",
    timeout: 30000,
  });

  const handleChange = (updates: Partial<MyPluginConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig);
  };

  return (
    <BaseConfigUI>
      <ConfigSection label="URL" description="API endpoint to call" required>
        <Input
          value={config.url}
          onChange={(e) => handleChange({ url: e.target.value })}
          placeholder="https://api.example.com"
        />
      </ConfigSection>

      <ConfigSection label="Method">
        <Select
          value={config.method}
          onValueChange={(method) => handleChange({ method })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
          </SelectContent>
        </Select>
      </ConfigSection>

      <ConfigSection label="Timeout (ms)">
        <Input
          type="number"
          value={String(config.timeout)}
          onChange={(e) => handleChange({ timeout: Number(e.target.value) })}
        />
      </ConfigSection>

      <InfoCard title="Usage Tip">
        <p>This plugin makes HTTP requests to external APIs.</p>
      </InfoCard>
    </BaseConfigUI>
  );
}
```

## Design Principles

1. **Consistency**: All plugins use the same visual language
2. **Composability**: Mix and match components as needed
3. **Accessibility**: Built on shadcn/ui components with proper labels
4. **Flexibility**: Components accept className for customization
5. **Type Safety**: Full TypeScript support

## Benefits

- ✅ Consistent spacing and typography
- ✅ Dark mode support out of the box
- ✅ Accessible labels and error messages
- ✅ Professional card designs
- ✅ Reduce code duplication across plugins
- ✅ Easier to maintain and update UI patterns
