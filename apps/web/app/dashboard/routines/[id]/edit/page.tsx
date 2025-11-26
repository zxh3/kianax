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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RoutineEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const routineId = id as Id<"routines">;
  const [isExecuting, setIsExecuting] = useState(false);

  // Fetch routine data
  const routine = useQuery(api.routines.get, { id: routineId });

  // Mutation to update routine
  const updateRoutine = useMutation(api.routines.update);

  const handleSave = async (nodes: any[], connections: any[]) => {
    try {
      await updateRoutine({
        id: routineId,
        nodes,
        connections,
      });
      toast.success("Routine saved successfully!");
    } catch (error) {
      toast.error("Failed to save routine");
      throw error;
    }
  };

  const handleTest = async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    try {
      toast.info("Starting workflow execution...");

      const response = await fetch(`/api/workflows/${routineId}/execute`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute workflow");
      }

      toast.success(`Workflow started! Workflow ID: ${data.workflowId}`);
    } catch (error: any) {
      toast.error(`Failed to execute workflow: ${error.message}`);
    } finally {
      setIsExecuting(false);
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
          initialConnections={(routine.connections || []) as any}
          onSave={handleSave}
          onTest={handleTest}
        />
      </div>
    </div>
  );
}
