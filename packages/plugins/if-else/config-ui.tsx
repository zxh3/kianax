"use client";

import { useState } from "react";
import { Button } from "@kianax/ui/components/button";
import { Input } from "@kianax/ui/components/input";
import { Label } from "@kianax/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { IconPlus, IconTrash } from "@tabler/icons-react";

interface Condition {
  operator: string;
  compareValue: string;
}

export interface IfElseConfig {
  conditions: Condition[];
  logicalOperator: "AND" | "OR";
}

interface IfElseConfigUIProps {
  value?: IfElseConfig;
  onChange: (value: IfElseConfig) => void;
}

const OPERATORS = [
  { value: "==", label: "Equals (==)" },
  { value: "!=", label: "Not Equals (!=)" },
  { value: ">", label: "Greater Than (>)" },
  { value: "<", label: "Less Than (<)" },
  { value: ">=", label: "Greater or Equal (>=)" },
  { value: "<=", label: "Less or Equal (<=)" },
  { value: "contains", label: "Contains" },
  { value: "startsWith", label: "Starts With" },
  { value: "endsWith", label: "Ends With" },
  { value: "exists", label: "Exists" },
  { value: "empty", label: "Is Empty" },
];

/**
 * Configuration UI for If-Else Logic Plugin
 *
 * This component is exported by the plugin and rendered by the workflow editor
 * when users need to configure the plugin.
 */
export function IfElseConfigUI({ value, onChange }: IfElseConfigUIProps) {
  const defaultConfig: IfElseConfig = {
    conditions: [{ operator: "==", compareValue: "" }],
    logicalOperator: "AND" as const,
  };

  const [localConfig, setLocalConfig] = useState<IfElseConfig>(() => {
    // Validate that value has the required structure
    if (value?.conditions && Array.isArray(value.conditions)) {
      return value;
    }
    return defaultConfig;
  });

  const handleChange = (newConfig: IfElseConfig) => {
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const handleAddCondition = () => {
    handleChange({
      ...localConfig,
      conditions: [
        ...localConfig.conditions,
        { operator: "==", compareValue: "" },
      ],
    });
  };

  const handleRemoveCondition = (index: number) => {
    handleChange({
      ...localConfig,
      conditions: localConfig.conditions.filter((_, i) => i !== index),
    });
  };

  const handleConditionChange = (
    index: number,
    field: keyof Condition,
    value: string,
  ) => {
    const newConditions = [...localConfig.conditions];
    const existingCondition = newConditions[index] || {
      operator: "",
      compareValue: "",
    };
    newConditions[index] = {
      ...existingCondition,
      [field]: value,
    };
    handleChange({
      ...localConfig,
      conditions: newConditions,
    });
  };

  return (
    <div className="space-y-6">
      {/* Logical Operator */}
      <div className="space-y-2">
        <Label>When multiple conditions</Label>
        <Select
          value={localConfig.logicalOperator}
          onValueChange={(value: "AND" | "OR") =>
            handleChange({ ...localConfig, logicalOperator: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">
              All conditions must be true (AND)
            </SelectItem>
            <SelectItem value="OR">
              At least one condition must be true (OR)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Conditions</Label>
          <Button size="sm" variant="outline" onClick={handleAddCondition}>
            <IconPlus className="mr-2 size-4" />
            Add Condition
          </Button>
        </div>

        {localConfig.conditions.map((condition, index) => (
          <div
            key={index}
            className="flex items-end gap-2 p-4 border rounded-lg bg-gray-50"
          >
            <div className="flex-1 space-y-2">
              <Label className="text-xs text-gray-600">
                Condition {index + 1}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select
                    value={condition.operator}
                    onValueChange={(value) =>
                      handleConditionChange(index, "operator", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!["exists", "empty"].includes(condition.operator) && (
                  <div>
                    <Label className="text-xs">Compare Value</Label>
                    <Input
                      value={condition.compareValue}
                      onChange={(e) =>
                        handleConditionChange(
                          index,
                          "compareValue",
                          (e.target as HTMLInputElement).value,
                        )
                      }
                      placeholder="Enter value..."
                    />
                  </div>
                )}
              </div>
            </div>

            {localConfig.conditions.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveCondition(index)}
              >
                <IconTrash className="size-4 text-red-600" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Help Text */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
        <p className="font-semibold mb-1">How it works:</p>
        <p>
          The incoming data will be evaluated against these conditions. If the
          result is true, the workflow follows the TRUE branch; otherwise, it
          follows the FALSE branch.
        </p>
      </div>
    </div>
  );
}
