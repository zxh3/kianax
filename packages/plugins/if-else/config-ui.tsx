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
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { BaseConfigUI, ConfigSection, ConfigCard, InfoCard } from "../ui";

type ComparisonOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "contains"
  | "startsWith"
  | "endsWith"
  | "matches"
  | "exists"
  | "empty";

interface Condition {
  operator: ComparisonOperator;
  compareValue: unknown;
}

interface ConditionGroup {
  conditions: Condition[];
}

export interface IfElseConfig {
  conditionGroups: ConditionGroup[];
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
  { value: "matches", label: "Matches Regex" },
  { value: "exists", label: "Exists" },
  { value: "empty", label: "Is Empty" },
];

/**
 * Configuration UI for If-Else Conditional Branch Plugin
 *
 * Supports "OR of AND groups" logic:
 * - Each group's conditions are ANDed together
 * - Groups are ORed together
 */
export function IfElseConfigUI({ value, onChange }: IfElseConfigUIProps) {
  const defaultConfig: IfElseConfig = {
    conditionGroups: [
      {
        conditions: [{ operator: "==", compareValue: "" }],
      },
    ],
  };

  const [localConfig, setLocalConfig] = useState<IfElseConfig>(() => {
    if (
      value?.conditionGroups &&
      Array.isArray(value.conditionGroups) &&
      value.conditionGroups.length > 0
    ) {
      return value;
    }
    return defaultConfig;
  });

  const handleChange = (newConfig: IfElseConfig) => {
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  // Group operations
  const addGroup = () => {
    handleChange({
      conditionGroups: [
        ...localConfig.conditionGroups,
        { conditions: [{ operator: "==", compareValue: "" }] },
      ],
    });
  };

  const removeGroup = (groupIndex: number) => {
    if (localConfig.conditionGroups.length === 1) return; // Keep at least one group
    handleChange({
      conditionGroups: localConfig.conditionGroups.filter(
        (_, i) => i !== groupIndex,
      ),
    });
  };

  // Condition operations
  const addCondition = (groupIndex: number) => {
    const newGroups = [...localConfig.conditionGroups];
    const group = newGroups[groupIndex];
    if (group) {
      newGroups[groupIndex] = {
        conditions: [...group.conditions, { operator: "==", compareValue: "" }],
      };
      handleChange({ conditionGroups: newGroups });
    }
  };

  const removeCondition = (groupIndex: number, conditionIndex: number) => {
    const newGroups = [...localConfig.conditionGroups];
    const group = newGroups[groupIndex];
    if (group && group.conditions.length > 1) {
      // Keep at least one condition per group
      newGroups[groupIndex] = {
        conditions: group.conditions.filter((_, i) => i !== conditionIndex),
      };
      handleChange({ conditionGroups: newGroups });
    }
  };

  const updateCondition = (
    groupIndex: number,
    conditionIndex: number,
    field: keyof Condition,
    value: string,
  ) => {
    const newGroups = [...localConfig.conditionGroups];
    const group = newGroups[groupIndex];
    if (group) {
      const newConditions = [...group.conditions];
      const condition = newConditions[conditionIndex];
      if (condition) {
        newConditions[conditionIndex] = { ...condition, [field]: value };
        newGroups[groupIndex] = { conditions: newConditions };
        handleChange({ conditionGroups: newGroups });
      }
    }
  };

  return (
    <BaseConfigUI>
      <ConfigSection
        label="Condition Groups"
        description="OR of AND groups: conditions within a group are ANDed, groups are ORed together"
        action={
          <Button size="sm" variant="outline" onClick={addGroup}>
            <IconPlus className="mr-2 size-3.5" />
            Add Group
          </Button>
        }
      >
        <div className="space-y-4">
          {localConfig.conditionGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className="p-4 border-2 border-dashed border-border rounded-xl bg-muted/30 space-y-3"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider px-2 py-1 bg-background border border-border rounded">
                    Group {groupIndex + 1}
                  </span>
                  {group.conditions.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      (All conditions must match)
                    </span>
                  )}
                </div>
                {localConfig.conditionGroups.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeGroup(groupIndex)}
                    title="Remove group"
                  >
                    <IconTrash className="size-3.5" />
                  </Button>
                )}
              </div>

              {/* Conditions in this group */}
              <div className="space-y-2">
                {group.conditions.map((condition, conditionIndex) => {
                  const operatorId = `operator-${groupIndex}-${conditionIndex}`;
                  const compareValueId = `compare-value-${groupIndex}-${conditionIndex}`;
                  return (
                    <ConfigCard
                      key={conditionIndex}
                      title={
                        group.conditions.length > 1
                          ? `Condition ${conditionIndex + 1}`
                          : undefined
                      }
                      removable={group.conditions.length > 1}
                      onRemove={() =>
                        removeCondition(groupIndex, conditionIndex)
                      }
                      className="bg-card"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <label
                            htmlFor={operatorId}
                            className="text-xs font-medium text-muted-foreground"
                          >
                            Operator
                          </label>
                          <Select
                            value={condition.operator}
                            onValueChange={(value) =>
                              updateCondition(
                                groupIndex,
                                conditionIndex,
                                "operator",
                                value,
                              )
                            }
                          >
                            <SelectTrigger
                              id={operatorId}
                              className="h-9 w-full"
                            >
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
                          <div className="space-y-1.5 min-w-0">
                            <label
                              htmlFor={compareValueId}
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Compare Value
                            </label>
                            <Input
                              id={compareValueId}
                              value={String(condition.compareValue || "")}
                              onChange={(e) =>
                                updateCondition(
                                  groupIndex,
                                  conditionIndex,
                                  "compareValue",
                                  e.target.value,
                                )
                              }
                              placeholder="Value to compare..."
                              className="h-9"
                            />
                          </div>
                        )}
                      </div>
                    </ConfigCard>
                  );
                })}
              </div>

              {/* Add condition button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => addCondition(groupIndex)}
                className="w-full border border-dashed"
              >
                <IconPlus className="mr-2 size-3.5" />
                Add Condition (AND)
              </Button>
            </div>
          ))}
        </div>
      </ConfigSection>

      <InfoCard title="How Boolean Logic Works">
        <div className="space-y-2">
          <p>
            <strong className="text-foreground">Within a group:</strong> All
            conditions must match (AND)
          </p>
          <p>
            <strong className="text-foreground">Between groups:</strong> At
            least one group must match (OR)
          </p>
          <div className="mt-3 p-2 bg-background border border-border rounded text-xs font-mono">
            (Group 1 Cond 1 AND Cond 2) OR (Group 2 Cond 1)
          </div>
        </div>
      </InfoCard>

      <InfoCard title="Output Behavior" variant="success">
        <p>
          If conditions pass, execution flows to the{" "}
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            True
          </span>{" "}
          output. Otherwise, it flows to the{" "}
          <span className="font-medium text-destructive">False</span> output.
        </p>
      </InfoCard>
    </BaseConfigUI>
  );
}
