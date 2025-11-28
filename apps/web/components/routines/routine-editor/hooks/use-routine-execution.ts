import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import { toast } from "sonner";
import type { RoutineNode, RoutineConnection, RoutineVariable } from "../types";
import type { Id } from "@kianax/server/convex/_generated/dataModel";

interface UseRoutineExecutionProps {
  routineId: Id<"routines">;
  getRoutineData: () => {
    nodes: RoutineNode[];
    connections: RoutineConnection[];
  };
  variables: RoutineVariable[];
  onSave: (
    nodes: RoutineNode[],
    connections: RoutineConnection[],
    variables: RoutineVariable[],
  ) => Promise<void>;
  onTest?: () => void;
}

export function useRoutineExecution({
  routineId,
  getRoutineData,
  variables,
  onSave,
  onTest,
}: UseRoutineExecutionProps) {
  const [testWorkflowId, setTestWorkflowId] = useState<string | null>(null);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [isStartingTest, setIsStartingTest] = useState(false);
  const [resultDrawerOpen, setResultDrawerOpen] = useState(false);
  const [selectedResultNodeId, setSelectedResultNodeId] = useState<
    string | null
  >(null);

  // State to track which execution we are viewing.
  // If null, we are in "edit mode" (or not viewing any specific execution).
  // If set, we show status for this execution.
  const [viewingExecutionId, setViewingExecutionId] = useState<string | null>(
    null,
  );

  // Fetch execution status if a test is running/open
  const testExecutionByWorkflow = useQuery(
    api.executions.getByWorkflowId,
    testWorkflowId ? { workflowId: testWorkflowId } : "skip",
  );

  // Fetch history (recent executions)
  const recentExecutions = useQuery(api.executions.getByRoutine, {
    routineId,
    limit: 10,
  });

  // When a new test is started, we want to view it immediately
  useEffect(() => {
    if (testWorkflowId) {
      setViewingExecutionId(testWorkflowId);
    }
  }, [testWorkflowId]);

  // Determine which execution to display
  // If viewingExecutionId is set, try to find it in loaded executions or fetch it (if we had a direct fetch by ID)
  // Currently we have `testExecutionByWorkflow` (single) and `recentExecutions` (list).

  // If viewingExecutionId matches testWorkflowId, use that.
  // Else look in recentExecutions.
  // TODO: If it's an old execution not in recent list, we might need a separate query or just rely on recent list for now.

  const activeExecution = useMemo(() => {
    if (viewingExecutionId === testWorkflowId) {
      return testExecutionByWorkflow;
    }
    return (
      recentExecutions?.find((e) => e.workflowId === viewingExecutionId) || null
    );
  }, [
    viewingExecutionId,
    testWorkflowId,
    testExecutionByWorkflow,
    recentExecutions,
  ]);

  const handleRunTest = async () => {
    setIsStartingTest(true);
    try {
      const { nodes, connections } = getRoutineData();
      await onSave(nodes, connections, variables);

      const response = await fetch(`/api/workflows/${routineId}/execute`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start workflow");
      }

      const data = await response.json();
      setTestWorkflowId(data.workflowId);
      setTestPanelOpen(true);
      toast.success("Test run started");

      if (onTest) onTest();
    } catch (error: any) {
      toast.error(error.message || "Failed to start test run");
      console.error(error);
    } finally {
      setIsStartingTest(false);
    }
  };

  // Compute node status map for the active execution
  const nodeStatusMap = useMemo(() => {
    const map = new Map<
      string,
      "running" | "completed" | "failed" | "pending"
    >();
    if (!activeExecution || !activeExecution.nodeStates) return map;

    activeExecution.nodeStates.forEach((state: any) => {
      map.set(state.nodeId, state.status);
    });
    return map;
  }, [activeExecution]);

  return {
    testWorkflowId,
    testPanelOpen,
    setTestPanelOpen,
    isStartingTest,
    resultDrawerOpen,
    setResultDrawerOpen,
    selectedResultNodeId,
    setSelectedResultNodeId,
    handleRunTest,
    activeExecution,
    recentExecutions,
    nodeStatusMap,
    viewingExecutionId,
    setViewingExecutionId,
  };
}
