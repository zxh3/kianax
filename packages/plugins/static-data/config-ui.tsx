"use client";

import { useState } from "react";
import { Label } from "@kianax/ui/components/label";
import { Textarea } from "@kianax/ui/components/textarea";
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

interface StaticDataConfig {
  data?: any;
}

interface StaticDataConfigUIProps {
  value?: StaticDataConfig;
  onChange: (value: StaticDataConfig) => void;
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
}: StaticDataConfigUIProps) {
  // Helper to determine initial type
  const getInitialType = (data: any): DataType => {
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
      } catch (_e) {
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

  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (newType: DataType) => {
    setDataType(newType);
    setError(null);

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
    setError(null);

    try {
      if (newValue.trim() === "") {
        onChange({ data: {} });
        return;
      }
      const parsed = JSON.parse(newValue);
      onChange({ data: parsed });
    } catch (_e) {
      setError("Invalid JSON format");
    }
  };

  const handleStringChange = (val: string) => {
    setStringValue(val);
    onChange({ data: val });
  };

  const handleNumberChange = (val: string) => {
    setNumberValue(val);
    const num = Number(val); // Consider handling NaN or empty string
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
      setError(null);
    } catch (_e) {
      toast.error("Cannot format invalid JSON");
    }
  };

  return (
    <div className="space-y-6">
      {/* Type Selector */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Data Type</Label>
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
      </div>

      {/* Value Input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">Value</Label>
          {dataType === "json" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFormat}
              className="h-7 text-xs"
            >
              Prettify
            </Button>
          )}
        </div>

        {dataType === "json" && (
          <div className="relative">
            <Textarea
              value={jsonString}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder='{ "key": "value" }'
              className={`font-mono text-xs min-h-[300px] resize-y ${
                error ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            {error && (
              <div className="absolute bottom-2 right-2 text-xs text-destructive bg-background/90 px-2 py-1 rounded border border-destructive/30 shadow-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {dataType === "string" && (
          <Input
            value={stringValue}
            onChange={(e) => handleStringChange(e.target.value)}
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

        <p className="text-xs text-muted-foreground">
          This value will be passed downstream as the output of this node.
        </p>
      </div>

      <div className="p-4 bg-muted/50 border border-border rounded-xl text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1 flex items-center gap-2">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:text-blue-400">
            i
          </span>
          Usage Tip
        </p>
        <p className="text-xs leading-relaxed">
          Use this node to mock API responses or provide constant configuration
          values for your routine.
        </p>
      </div>
    </div>
  );
}
