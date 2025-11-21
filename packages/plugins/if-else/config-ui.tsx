"use client";

import { useState, useEffect } from "react";
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

  // Sync state with props when node selection changes
  useEffect(() => {
    if (value?.conditions && Array.isArray(value.conditions)) {
      setLocalConfig(value);
    } else {
      setLocalConfig(defaultConfig);
    }
  }, [value]);

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
    <div className="space-y-8">
      {/* Logical Operator */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-900">
          When multiple conditions match
        </Label>
        <Select
          value={localConfig.logicalOperator}
          onValueChange={(value: "AND" | "OR") =>
            handleChange({ ...localConfig, logicalOperator: value })
          }
        >
          <SelectTrigger className="w-full">
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-900">
            Conditions
          </Label>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddCondition}
            className="h-8"
          >
            <IconPlus className="mr-2 size-3.5" />
            Add Condition
          </Button>
        </div>

        <div className="space-y-4">
          {localConfig.conditions.map((condition, index) => (
            <div
              key={index}
              className="relative p-4 border rounded-xl bg-white shadow-sm transition-all hover:border-gray-300 group"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Condition {index + 1}
                </span>
                {localConfig.conditions.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50 -mr-1"
                    onClick={() => handleRemoveCondition(index)}
                    title="Remove condition"
                  >
                    <IconTrash className="size-3.5" />
                  </Button>
                )}
              </div>

              {/* Card Content */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Operator
                  </Label>
                  <Select
                    value={condition.operator}
                    onValueChange={(value) =>
                      handleConditionChange(index, "operator", value)
                    }
                  >
                    <SelectTrigger className="h-9">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      Compare Value
                    </Label>
                    <Input
                      value={condition.compareValue}
                      onChange={(e) =>
                        handleConditionChange(
                          index,
                          "compareValue",
                          (e.target as HTMLInputElement).value,
                        )
                      }
                      placeholder="Value to match..."
                      className="h-9"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Help Text */}
      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-600">
        <p className="font-medium text-slate-900 mb-1 flex items-center gap-2">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
            i
          </span>
          How logic works
        </p>
        <p className="text-xs leading-relaxed">
          The incoming data will be evaluated against these conditions. If the
          result is true, the execution flows to the{" "}
          <span className="font-medium text-emerald-600">True</span> output.
          Otherwise, it flows to the{" "}
          <span className="font-medium text-rose-600">False</span> output.
        </p>
      </div>
    </div>
  );
}
