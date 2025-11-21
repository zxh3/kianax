"use client";

import { useState, useEffect } from "react";
import { Label } from "@kianax/ui/components/label";
import { Textarea } from "@kianax/ui/components/textarea";
import { Button } from "@kianax/ui/components/button";
import { toast } from "sonner";

interface StaticDataConfig {
  data?: any;
}

interface StaticDataConfigUIProps {
  value?: StaticDataConfig;
  onChange: (value: StaticDataConfig) => void;
}

/**
 * Configuration UI for Static Data Plugin
 *
 * Allows users to enter JSON data that will be output by the node.
 */
export function StaticDataConfigUI({
  value,
  onChange,
}: StaticDataConfigUIProps) {
  const [jsonString, setJsonString] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Initialize local state from props
  useEffect(() => {
    if (value?.data !== undefined) {
      try {
        setJsonString(JSON.stringify(value.data, null, 2));
      } catch (_e) {
        setJsonString("");
      }
    } else {
      // Default to empty object if no data
      setJsonString("{\n  \n}");
    }
  }, [value]);

  const handleJsonChange = (newValue: string) => {
    setJsonString(newValue);
    setError(null);

    try {
      // Try to parse JSON
      if (newValue.trim() === "") {
        // Treat empty string as undefined/null or empty object?
        // Let's assume empty object for safety
        onChange({ data: {} });
        return;
      }

      const parsed = JSON.parse(newValue);
      onChange({ data: parsed });
    } catch (_e) {
      // Don't propagate invalid JSON to the config, but show error in UI
      // We only update the local string so user can keep typing
      setError("Invalid JSON format");
    }
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-900">
            JSON Payload
          </Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFormat}
            className="h-7 text-xs"
          >
            Prettify
          </Button>
        </div>

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

        <p className="text-xs text-muted-foreground">
          Enter valid JSON data. This object will be passed downstream as the
          output of this node.
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
          values for your routine. For example:{" "}
          <code>{`{ "threshold": 0.5, "mode": "test" }`}</code>
        </p>
      </div>
    </div>
  );
}
