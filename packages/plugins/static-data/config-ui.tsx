"use client";

import { useState } from "react";
import { Button } from "@kianax/ui/components/button";
import { Input } from "@kianax/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { toast } from "sonner";
import {
  ExpressionInput,
  buildExpressionContext,
} from "@kianax/ui/components/expression-input";
import { BaseConfigUI, ConfigSection, InfoCard } from "../ui";
import type { ExpressionContext } from "../config-registry";

export interface StaticDataConfig {
  data: unknown;
}

interface StaticDataConfigUIProps {
  value?: StaticDataConfig;
  onChange: (value: StaticDataConfig) => void;
  /** Expression context for autocomplete (from routine editor) */
  expressionContext?: ExpressionContext;
}

type DataType = "json" | "string" | "number" | "boolean";

/**
 * Configuration UI for Static Data Plugin
 *
 * Allows users to enter static data (JSON, string, number, or boolean) output.
 */
export function StaticDataConfigUI({
  value,
  onChange,
  expressionContext,
}: StaticDataConfigUIProps) {
  // Convert domain-specific context to generic tree format
  const uiContext = buildExpressionContext(expressionContext);

  // Helper to determine initial type
  const getInitialType = (data: unknown): DataType => {
    if (data === null || data === undefined) return "json";
    if (typeof data === "number") return "number";
    if (typeof data === "boolean") return "boolean";
    if (typeof data === "string") return "string";
    return "json";
  };

  const [dataType, setDataType] = useState<DataType>(() =>
    getInitialType(value?.data),
  );

  const [jsonString, setJsonString] = useState(() => {
    const data = value?.data;
    if (
      data === null ||
      data === undefined ||
      typeof data === "object" ||
      Array.isArray(data)
    ) {
      try {
        return JSON.stringify(data || {}, null, 2);
      } catch {
        return "{}";
      }
    }
    return "{\n  \n}";
  });

  const [stringValue, setStringValue] = useState(() =>
    typeof value?.data === "string" ? value.data : "",
  );

  const [numberValue, setNumberValue] = useState<string>(() =>
    typeof value?.data === "number" ? String(value.data) : "",
  );

  const [booleanValue, setBooleanValue] = useState<string>(() =>
    typeof value?.data === "boolean" ? String(value.data) : "true",
  );

  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleTypeChange = (newType: DataType) => {
    setDataType(newType);
    setJsonError(null);

    // Set default value for new type
    switch (newType) {
      case "json":
        onChange({ data: {} });
        setJsonString("{}");
        break;
      case "string":
        onChange({ data: "" });
        setStringValue("");
        break;
      case "number":
        onChange({ data: 0 });
        setNumberValue("0");
        break;
      case "boolean":
        onChange({ data: true });
        setBooleanValue("true");
        break;
    }
  };

  const handleJsonChange = (newValue: string) => {
    setJsonString(newValue);
    setJsonError(null);

    try {
      if (newValue.trim() === "") {
        onChange({ data: {} });
        return;
      }
      const parsed = JSON.parse(newValue);
      onChange({ data: parsed });
    } catch {
      setJsonError("Invalid JSON format");
    }
  };

  const handleStringChange = (val: string) => {
    setStringValue(val);
    onChange({ data: val });
  };

  const handleNumberChange = (val: string) => {
    setNumberValue(val);
    const num = Number(val);
    if (!Number.isNaN(num)) {
      onChange({ data: num });
    }
  };

  const handleBooleanChange = (val: string) => {
    setBooleanValue(val);
    onChange({ data: val === "true" });
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonString);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonString(formatted);
      setJsonError(null);
      toast.success("JSON formatted successfully");
    } catch {
      toast.error("Cannot format invalid JSON");
    }
  };

  return (
    <BaseConfigUI>
      <ConfigSection
        label="Data Type"
        description="Type of static data to output"
      >
        <Select
          value={dataType}
          onValueChange={(v) => handleTypeChange(v as DataType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON (Object/Array)</SelectItem>
            <SelectItem value="string">String</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="boolean">Boolean</SelectItem>
          </SelectContent>
        </Select>
      </ConfigSection>

      <ConfigSection
        label="Value"
        description="This value will be passed downstream as the output of this node"
        action={
          dataType === "json" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFormat}
              className="h-7 text-xs"
            >
              Format JSON
            </Button>
          ) : undefined
        }
        error={jsonError || undefined}
      >
        {dataType === "json" && (
          <div className="relative">
            <ExpressionInput
              value={jsonString}
              onChange={handleJsonChange}
              context={uiContext}
              showPreview={false}
              multiline
              rows={12}
              placeholder='{ "key": "value" }'
              className={`font-mono text-xs ${
                jsonError
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
            />
          </div>
        )}

        {dataType === "string" && (
          <ExpressionInput
            value={stringValue}
            onChange={handleStringChange}
            context={uiContext}
            showPreview
            placeholder="Enter text value..."
          />
        )}

        {dataType === "number" && (
          <Input
            type="number"
            value={numberValue}
            onChange={(e) => handleNumberChange(e.target.value)}
            placeholder="Enter number..."
          />
        )}

        {dataType === "boolean" && (
          <Select value={booleanValue} onValueChange={handleBooleanChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        )}
      </ConfigSection>

      <InfoCard title="Using Variables">
        <p className="mb-2">
          You can use expressions to reference routine variables or upstream
          node outputs:
        </p>
        <div className="space-y-1.5 font-mono text-xs">
          <div>
            <code className="bg-background px-1.5 py-0.5 rounded">
              {"{{ vars.variableName }}"}
            </code>
            <span className="text-muted-foreground ml-2">
              - routine variable
            </span>
          </div>
          <div>
            <code className="bg-background px-1.5 py-0.5 rounded">
              {"{{ nodes.nodeId.portName }}"}
            </code>
            <span className="text-muted-foreground ml-2">
              - upstream output
            </span>
          </div>
          <div>
            <code className="bg-background px-1.5 py-0.5 rounded">
              {"{{ trigger.data }}"}
            </code>
            <span className="text-muted-foreground ml-2">- trigger data</span>
          </div>
        </div>
      </InfoCard>

      <InfoCard title="Usage Tip">
        <p>
          Use this node to provide constant values, mock API responses, or test
          data for your routine. The data will be available to downstream nodes.
        </p>
      </InfoCard>

      {dataType === "json" && (
        <InfoCard title="JSON Examples" variant="info">
          <div className="space-y-2">
            <div>
              <strong className="text-foreground">Static Object:</strong>
              <code className="block text-xs mt-1 p-2 bg-background rounded">
                {`{ "name": "John", "age": 30 }`}
              </code>
            </div>
            <div>
              <strong className="text-foreground">With Variables:</strong>
              <code className="block text-xs mt-1 p-2 bg-background rounded whitespace-pre">
                {`{
  "city": "{{ vars.city }}",
  "apiKey": "{{ vars.apiKey }}"
}`}
              </code>
            </div>
          </div>
        </InfoCard>
      )}
    </BaseConfigUI>
  );
}
