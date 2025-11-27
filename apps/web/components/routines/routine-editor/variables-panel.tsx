"use client";

import { useState, useCallback } from "react";
import { Button } from "@kianax/ui/components/button";
import { Input } from "@kianax/ui/components/input";
import { Label } from "@kianax/ui/components/label";
import { Textarea } from "@kianax/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { ScrollArea } from "@kianax/ui/components/scroll-area";
import {
  IconX,
  IconPlus,
  IconTrash,
  IconVariable,
  IconEdit,
  IconCheck,
} from "@tabler/icons-react";
import { cn } from "@kianax/ui/lib/utils";
import { nanoid } from "nanoid";

export interface RoutineVariable {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "json";
  value: unknown;
  description?: string;
}

interface VariablesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  variables: RoutineVariable[];
  onVariablesChange: (variables: RoutineVariable[]) => void;
}

const VARIABLE_TYPES = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "json", label: "JSON" },
] as const;

/**
 * Variables Panel
 *
 * Allows users to manage routine-level variables that can be
 * referenced in node configurations using {{ vars.name }} syntax.
 */
export function VariablesPanel({
  isOpen,
  onClose,
  variables,
  onVariablesChange,
}: VariablesPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state for new/editing variable
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<RoutineVariable["type"]>("string");
  const [formValue, setFormValue] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const resetForm = useCallback(() => {
    setFormName("");
    setFormType("string");
    setFormValue("");
    setFormDescription("");
    setEditingId(null);
    setIsAdding(false);
  }, []);

  const handleStartAdd = useCallback(() => {
    resetForm();
    setIsAdding(true);
  }, [resetForm]);

  const handleStartEdit = useCallback((variable: RoutineVariable) => {
    setFormName(variable.name);
    setFormType(variable.type);
    setFormValue(formatValueForEdit(variable.type, variable.value));
    setFormDescription(variable.description || "");
    setEditingId(variable.id);
    setIsAdding(false);
  }, []);

  const parseValue = useCallback(
    (type: RoutineVariable["type"], rawValue: string): unknown => {
      switch (type) {
        case "number":
          return Number(rawValue) || 0;
        case "boolean":
          return rawValue.toLowerCase() === "true";
        case "json":
          try {
            return JSON.parse(rawValue);
          } catch {
            return {};
          }
        default:
          return rawValue;
      }
    },
    [],
  );

  const handleSaveVariable = useCallback(() => {
    if (!formName.trim()) return;

    // Check for duplicate names (excluding current editing variable)
    const isDuplicate = variables.some(
      (v) =>
        v.name.toLowerCase() === formName.toLowerCase().trim() &&
        v.id !== editingId,
    );
    if (isDuplicate) {
      return; // Could show a toast here
    }

    const parsedValue = parseValue(formType, formValue);

    if (editingId) {
      // Update existing variable
      onVariablesChange(
        variables.map((v) =>
          v.id === editingId
            ? {
                ...v,
                name: formName.trim(),
                type: formType,
                value: parsedValue,
                description: formDescription.trim() || undefined,
              }
            : v,
        ),
      );
    } else {
      // Add new variable
      onVariablesChange([
        ...variables,
        {
          id: nanoid(),
          name: formName.trim(),
          type: formType,
          value: parsedValue,
          description: formDescription.trim() || undefined,
        },
      ]);
    }

    resetForm();
  }, [
    formName,
    formType,
    formValue,
    formDescription,
    editingId,
    variables,
    onVariablesChange,
    parseValue,
    resetForm,
  ]);

  const handleDeleteVariable = useCallback(
    (id: string) => {
      onVariablesChange(variables.filter((v) => v.id !== id));
      if (editingId === id) {
        resetForm();
      }
    },
    [variables, onVariablesChange, editingId, resetForm],
  );

  if (!isOpen) return null;

  const isFormOpen = isAdding || editingId !== null;

  return (
    <div className="absolute top-2 left-16 bottom-2 w-80 bg-background border border-border shadow-2xl rounded-xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <IconVariable className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Variables</h3>
          <span className="text-xs text-muted-foreground">
            ({variables.length})
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
        >
          <IconX className="size-4" />
        </Button>
      </div>

      {/* Help text */}
      <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b">
        Use <code className="bg-muted px-1 rounded">{"{{ vars.name }}"}</code>{" "}
        in node configs to reference variables.
      </div>

      {/* Variables List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {variables.length === 0 && !isFormOpen ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No variables defined.
              <br />
              Click the + button to add one.
            </div>
          ) : (
            variables.map((variable) =>
              editingId === variable.id ? (
                <VariableForm
                  key={variable.id}
                  name={formName}
                  type={formType}
                  value={formValue}
                  description={formDescription}
                  onNameChange={setFormName}
                  onTypeChange={setFormType}
                  onValueChange={setFormValue}
                  onDescriptionChange={setFormDescription}
                  onSave={handleSaveVariable}
                  onCancel={resetForm}
                  isEditing
                />
              ) : (
                <VariableItem
                  key={variable.id}
                  variable={variable}
                  onEdit={() => handleStartEdit(variable)}
                  onDelete={() => handleDeleteVariable(variable.id)}
                />
              ),
            )
          )}

          {/* Add form */}
          {isAdding && (
            <VariableForm
              name={formName}
              type={formType}
              value={formValue}
              description={formDescription}
              onNameChange={setFormName}
              onTypeChange={setFormType}
              onValueChange={setFormValue}
              onDescriptionChange={setFormDescription}
              onSave={handleSaveVariable}
              onCancel={resetForm}
            />
          )}
        </div>
      </ScrollArea>

      {/* Add Button */}
      {!isFormOpen && (
        <div className="border-t p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleStartAdd}
          >
            <IconPlus className="size-3.5 mr-1.5" />
            Add Variable
          </Button>
        </div>
      )}
    </div>
  );
}

interface VariableItemProps {
  variable: RoutineVariable;
  onEdit: () => void;
  onDelete: () => void;
}

function VariableItem({ variable, onEdit, onDelete }: VariableItemProps) {
  return (
    <div className="group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium truncate">
            {variable.name}
          </span>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase",
              variable.type === "string" && "bg-blue-100 text-blue-700",
              variable.type === "number" && "bg-green-100 text-green-700",
              variable.type === "boolean" && "bg-purple-100 text-purple-700",
              variable.type === "json" && "bg-orange-100 text-orange-700",
            )}
          >
            {variable.type}
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {formatValueForDisplay(variable.type, variable.value)}
        </div>
        {variable.description && (
          <div className="text-xs text-muted-foreground/70 truncate mt-0.5">
            {variable.description}
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onEdit}
          title="Edit variable"
        >
          <IconEdit className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Delete variable"
        >
          <IconTrash className="size-3" />
        </Button>
      </div>
    </div>
  );
}

interface VariableFormProps {
  name: string;
  type: RoutineVariable["type"];
  value: string;
  description: string;
  onNameChange: (name: string) => void;
  onTypeChange: (type: RoutineVariable["type"]) => void;
  onValueChange: (value: string) => void;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function VariableForm({
  name,
  type,
  value,
  description,
  onNameChange,
  onTypeChange,
  onValueChange,
  onDescriptionChange,
  onSave,
  onCancel,
  isEditing,
}: VariableFormProps) {
  return (
    <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="variable_name"
          className="h-8 text-sm font-mono"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Type</Label>
        <Select
          value={type}
          onValueChange={(v) => onTypeChange(v as RoutineVariable["type"])}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VARIABLE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Value</Label>
        {type === "json" ? (
          <Textarea
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="{}"
            className="text-sm font-mono min-h-[60px]"
          />
        ) : type === "boolean" ? (
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={type === "number" ? "0" : ""}
            type={type === "number" ? "number" : "text"}
            className="h-8 text-sm"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description (optional)</Label>
        <Input
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="What this variable is for..."
          className="h-8 text-sm"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1"
          onClick={onSave}
          disabled={!name.trim()}
        >
          <IconCheck className="size-3.5 mr-1" />
          {isEditing ? "Update" : "Add"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function formatValueForDisplay(
  type: RoutineVariable["type"],
  value: unknown,
): string {
  switch (type) {
    case "json":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    default:
      return String(value ?? "");
  }
}

function formatValueForEdit(
  type: RoutineVariable["type"],
  value: unknown,
): string {
  switch (type) {
    case "json":
      return JSON.stringify(value, null, 2);
    case "boolean":
      return value ? "true" : "false";
    default:
      return String(value ?? "");
  }
}
