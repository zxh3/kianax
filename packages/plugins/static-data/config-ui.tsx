"use client";

import { useState, useEffect } from "react";
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
  const [dataType, setDataType] = useState<DataType>("json");
  const [jsonString, setJsonString] = useState("");
  const [stringValue, setStringValue] = useState("");
  const [numberValue, setNumberValue] = useState<string>("");
  const [booleanValue, setBooleanValue] = useState<string>("true");
  const [error, setError] = useState<string | null>(null);

  // Initialize local state from props
  useEffect(() => {
    const data = value?.data;
    const type = typeof data;

    if (data === null || data === undefined) {
      setDataType("json");
      setJsonString("{\n  \n}");
    } else if (type === "number") {
      setDataType("number");
      setNumberValue(String(data));
    } else if (type === "boolean") {
      setDataType("boolean");
      setBooleanValue(String(data));
    } else if (type === "string") {
      // If it looks like a JSON object/array, keep it as JSON string?
      // No, if it's a string, it's a string.
      setDataType("string");
      setStringValue(data);
    } else {
      // Object or Array
      setDataType("json");
      try {
        setJsonString(JSON.stringify(data, null, 2));
      } catch (_e) {
        setJsonString("{}");
      }
    }
  }, [value]);

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
    if (!isNaN(num)) {
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
        <Label className="text-sm font-medium text-gray-900">Data Type</Label>
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
          <Label className="text-sm font-medium text-gray-900">Value</Label>
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
                error ? "border-red-500 focus-visible:ring-red-500" : ""
              }`}
            />
            {error && (
              <div className="absolute bottom-2 right-2 text-xs text-red-500 bg-white/90 px-2 py-1 rounded border border-red-200 shadow-sm">
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

      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-600">
        <p className="font-medium text-slate-900 mb-1 flex items-center gap-2">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
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
