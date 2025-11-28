"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import type { Id } from "@kianax/server/convex/_generated/dataModel";
import { RoutineEditor } from "@kianax/web/components/routines/routine-editor";
import { Button } from "@kianax/ui/components/button";
import { IconArrowLeft, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import {
  validateExpressions,
  PortType,
  type ExpressionValidationError,
} from "@kianax/execution-engine";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RoutineEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const routineId = id as Id<"routines">;

  // Fetch routine data
  const routine = useQuery(api.routines.get, { id: routineId });

  // Mutations to update routine
  const updateRoutine = useMutation(api.routines.update);
  const setVariables = useMutation(api.routines.setVariables);

  // State for validation errors
  const [validationErrors, setValidationErrors] = useState<
    ExpressionValidationError[]
  >([]);

  // Validate routine expressions
  const validateRoutine = (
    nodes: any[],
    connections: any[],
    variables: any[] = [],
  ): ExpressionValidationError[] => {
    // Convert to execution-engine format
    const routineDefinition = {
      name: routine?.name || "Routine",
      nodes: nodes.map((n) => ({
        id: n.id,
        pluginId: n.pluginId,
        label: n.label || n.pluginId,
        parameters: n.config || {},
        credentialMappings: n.credentialMappings,
      })),
      connections: connections.map((c) => ({
        id: c.id,
        sourceNodeId: c.sourceNodeId,
        targetNodeId: c.targetNodeId,
        sourcePort: c.sourceHandle || "output",
        targetPort: c.targetHandle || "input",
        type: PortType.Main,
      })),
      variables: variables.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        value: v.value,
      })),
    };

    const result = validateExpressions(routineDefinition);
    return result.errors;
  };

  const handleSave = async (
    nodes: any[],
    connections: any[],
    variables?: any[],
  ) => {
    try {
      // Run validation (non-blocking - just update state)
      const errors = validateRoutine(nodes, connections, variables || []);
      setValidationErrors(errors);

      // Save regardless of validation errors (allow drafts)
      await updateRoutine({
        id: routineId,
        nodes,
        connections,
      });
      // If variables are provided, also update them
      if (variables !== undefined) {
        await setVariables({
          routineId,
          variables,
        });
      }

      // Show appropriate message
      if (errors.length > 0) {
        toast.warning(
          `Saved with ${errors.length} expression warning${errors.length > 1 ? "s" : ""}`,
        );
      } else {
        toast.success("Routine saved successfully!");
      }
    } catch (error) {
      toast.error("Failed to save routine");
      throw error;
    }
  };

  const handleBack = () => {
    router.push("/dashboard/routines");
  };

  // Loading state
  if (routine === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (routine === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Routine not found</h1>
        <Button onClick={handleBack}>
          <IconArrowLeft className="mr-2 size-4" />
          Back to Routines
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-background px-6 py-2">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <IconArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="font-bold">Routine: {routine.name}</h1>
          <p className="text-xs text-muted-foreground">{routine.description}</p>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <RoutineEditor
          routineId={routineId}
          initialNodes={routine.nodes || []}
          initialConnections={routine.connections || []}
          initialVariables={routine.variables || []}
          validationErrors={validationErrors}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
