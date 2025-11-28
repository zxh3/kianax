"use client";

import { useState } from "react";
import { Input } from "@kianax/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { BaseConfigUI, ConfigSection, InfoCard } from "../ui";

export interface OpenAIConfig {
  // Model configuration
  model: string;
  temperature: number;
  maxTokens?: number;

  // Runtime data (via expressions in flow-based system)
  message: string;
  systemPrompt?: string;
}

interface OpenAIConfigUIProps {
  value?: OpenAIConfig;
  onChange: (value: OpenAIConfig) => void;
}

/**
 * Configuration UI for OpenAI Message Plugin
 */
export function OpenAIConfigUI({ value, onChange }: OpenAIConfigUIProps) {
  const defaultConfig: OpenAIConfig = {
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: undefined,
    // Runtime fields - typically set via expressions in NodeConfigDrawer
    message: "",
    systemPrompt: undefined,
  };

  const [config, setConfig] = useState<OpenAIConfig>(value || defaultConfig);

  const handleChange = (updates: Partial<OpenAIConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig);
  };

  return (
    <BaseConfigUI>
      <ConfigSection
        label="Model"
        description="Select the OpenAI model to use."
      >
        <Select
          value={config.model}
          onValueChange={(val) => handleChange({ model: val })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
          </SelectContent>
        </Select>
      </ConfigSection>

      <ConfigSection
        label="Temperature"
        description="Controls randomness: 0 is deterministic, 1 is creative."
      >
        <Input
          type="number"
          value={String(config.temperature)}
          onChange={(e) =>
            handleChange({ temperature: Number(e.target.value) })
          }
          min={0}
          max={2}
          step={0.1}
        />
      </ConfigSection>

      <ConfigSection
        label="Max Tokens"
        description="The maximum number of tokens to generate. Leave empty for default."
      >
        <Input
          type="number"
          value={config.maxTokens ? String(config.maxTokens) : ""}
          onChange={(e) => {
            const val = e.target.value;
            handleChange({ maxTokens: val ? Number(val) : undefined });
          }}
          placeholder="Optional"
          min={1}
        />
      </ConfigSection>

      <InfoCard title="Credential Required" variant="warning">
        <p>
          This plugin requires an <strong>OpenAI API Key</strong> credential.
          Please ensure you have selected a valid credential in the settings
          above.
        </p>
      </InfoCard>
    </BaseConfigUI>
  );
}
