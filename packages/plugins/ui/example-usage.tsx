/**
 * Example usage of base config UI components
 *
 * This file demonstrates how to build plugin config UIs using
 * the reusable base components.
 */

"use client";

import { useState } from "react";
import { Input } from "@kianax/ui/components/input";
import { Button } from "@kianax/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { IconPlus } from "@tabler/icons-react";
import { BaseConfigUI } from "./base-config-ui";
import { ConfigSection } from "./config-section";
import { ConfigCard } from "./config-card";
import { InfoCard } from "./info-card";

/**
 * Example 1: Simple config with sections
 */
interface SimpleConfig {
  url: string;
  method: string;
}

function SimpleConfigExample({
  value,
  onChange,
}: {
  value?: SimpleConfig;
  onChange: (val: SimpleConfig) => void;
}) {
  const [config, setConfig] = useState(value || { url: "", method: "GET" });

  const handleChange = (updates: Partial<SimpleConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig);
  };

  return (
    <BaseConfigUI>
      <ConfigSection label="URL" description="The endpoint to call" required>
        <Input
          value={config.url}
          onChange={(e) => handleChange({ url: e.target.value })}
          placeholder="https://api.example.com/data"
        />
      </ConfigSection>

      <ConfigSection label="HTTP Method">
        <Select
          value={config.method}
          onValueChange={(method) => handleChange({ method })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
      </ConfigSection>

      <InfoCard title="Usage Tip">
        <p>
          This plugin will make an HTTP request to the specified URL using the
          selected method.
        </p>
      </InfoCard>
    </BaseConfigUI>
  );
}

/**
 * Example 2: Complex config with repeatable cards
 */
interface Header {
  key: string;
  value: string;
}

interface ComplexConfig {
  headers: Header[];
}

function ComplexConfigExample({
  value,
  onChange,
}: {
  value?: ComplexConfig;
  onChange: (val: ComplexConfig) => void;
}) {
  const [config, setConfig] = useState(value || { headers: [] });

  const handleChange = (newConfig: ComplexConfig) => {
    setConfig(newConfig);
    onChange(newConfig);
  };

  const addHeader = () => {
    handleChange({
      headers: [...config.headers, { key: "", value: "" }],
    });
  };

  const removeHeader = (index: number) => {
    handleChange({
      headers: config.headers.filter((_, i) => i !== index),
    });
  };

  const updateHeader = (index: number, field: keyof Header, value: string) => {
    const newHeaders = [...config.headers];
    const currentHeader = newHeaders[index];
    if (currentHeader) {
      newHeaders[index] = { ...currentHeader, [field]: value };
      handleChange({ headers: newHeaders });
    }
  };

  return (
    <BaseConfigUI title="HTTP Headers">
      <ConfigSection
        label="Headers"
        description="Custom headers to include in the request"
        action={
          <Button size="sm" variant="outline" onClick={addHeader}>
            <IconPlus className="mr-2 size-3.5" />
            Add Header
          </Button>
        }
      >
        <div className="space-y-3">
          {config.headers.map((header, index) => (
            <ConfigCard
              key={index}
              title={`Header ${index + 1}`}
              removable
              onRemove={() => removeHeader(index)}
            >
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={header.key}
                  onChange={(e) => updateHeader(index, "key", e.target.value)}
                  placeholder="Key"
                />
                <Input
                  value={header.value}
                  onChange={(e) => updateHeader(index, "value", e.target.value)}
                  placeholder="Value"
                />
              </div>
            </ConfigCard>
          ))}
          {config.headers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No headers configured. Click "Add Header" to get started.
            </p>
          )}
        </div>
      </ConfigSection>

      <InfoCard title="Common Headers" variant="info">
        <ul className="list-disc list-inside space-y-1">
          <li>
            <code className="text-xs">Content-Type: application/json</code>
          </li>
          <li>
            <code className="text-xs">Authorization: Bearer TOKEN</code>
          </li>
        </ul>
      </InfoCard>
    </BaseConfigUI>
  );
}

// Export examples (not used in production, just for reference)
export { SimpleConfigExample, ComplexConfigExample };
