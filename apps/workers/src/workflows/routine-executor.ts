/**
 * Routine Executor Workflow
 *
 * Uses the execution-engine package for graph traversal
 * with Temporal activities for plugin execution.
 */

import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import type * as activities from "../activities";
import type { RoutineInput } from "@kianax/shared/temporal";
import {
  BFSIterationStrategy,
  ExecutionState,
  type ExecutionGraph,
  type Node,
  type Edge,
  validateGraph,
} from "@kianax/execution-engine";
import { adaptRoutineInput } from "../lib/routine-adapter";

// Proxy activities with timeout and retry configuration
const {
  executePlugin,
  createRoutineExecution,
  updateRoutineStatus,
  storeNodeResult,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "1s",
    backoffCoefficient: 2,
    maximumInterval: "1m",
    maximumAttempts: 3,
  },
});

/**
 * Routine Executor using execution-engine
 */
export async function routineExecutor(input: RoutineInput): Promise<void> {
  const { routineId, userId, triggerData } = input;

  // Get workflow execution info
  const { workflowId: executionId, runId } = workflowInfo();

  // Convert Temporal format to execution-engine format
  const routine = adaptRoutineInput(input);

  // Validate graph structure
  const validation = validateGraph(routine);
  if (!validation.valid) {
    throw new Error(
      `Invalid routine graph:\n${validation.errors.map((e) => `- ${e.message}`).join("\n")}`,
    );
  }

  // Create execution record in Convex
  await createRoutineExecution({
    routineId,
    userId,
    workflowId: executionId,
    runId,
    triggerType: (triggerData as any)?.triggerType || "manual",
    triggerData,
  });

  // Update routine status to running
  await updateRoutineStatus({
    workflowId: executionId,
    routineId,
    status: "running",
    startedAt: Date.now(),
  });

  try {
    // Build execution graph
    const graph = buildExecutionGraph(routine, routineId, triggerData);
    const state = new ExecutionState();

    // Use BFS iteration strategy from execution-engine
    const iterationStrategy = new BFSIterationStrategy();

    // Execute using the strategy with our custom node executor
    await iterationStrategy.execute(
      graph,
      state,
      async (nodeId: string) => {
        await executeNodeWithActivity(nodeId, graph, state, executionId);
      },
      {
        maxExecutionTime: 30 * 60 * 1000, // 30 minutes
        maxExecutions: 10000, // Prevent infinite loops
      },
    );

    // All nodes completed successfully
    await updateRoutineStatus({
      workflowId: executionId,
      routineId,
      status: "completed",
      completedAt: Date.now(),
      executionPath: state.executionPath.map((item) => item.nodeId),
    });
  } catch (error: any) {
    // Workflow failed
    await updateRoutineStatus({
      workflowId: executionId,
      routineId,
      status: "failed",
      error: {
        message: error.message,
        stack: error.stack,
      },
      completedAt: Date.now(),
    });

    // Re-throw for Temporal to record
    throw error;
  }
}

/**
 * Build execution graph (adapted from execution-engine)
 */
function buildExecutionGraph(
  routine: { id?: string; nodes: Node[]; connections: Edge[] },
  routineId: string,
  triggerData?: unknown,
): ExecutionGraph {
  const nodes = new Map<string, Node>();
  const edgesByTarget = new Map<string, Edge[]>();
  const edgesBySource = new Map<string, Edge[]>();

  // Index nodes by ID
  for (const node of routine.nodes) {
    nodes.set(node.id, node);
  }

  // Index edges by source and target
  for (const edge of routine.connections) {
    // By target
    if (!edgesByTarget.has(edge.targetNodeId)) {
      edgesByTarget.set(edge.targetNodeId, []);
    }
    edgesByTarget.get(edge.targetNodeId)!.push(edge);

    // By source
    if (!edgesBySource.has(edge.sourceNodeId)) {
      edgesBySource.set(edge.sourceNodeId, []);
    }
    edgesBySource.get(edge.sourceNodeId)!.push(edge);
  }

  return {
    routineId,
    triggerData,
    nodes,
    edges: routine.connections,
    edgesByTarget,
    edgesBySource,
  };
}

/**
 * Execute a single node using Temporal activity
 */
async function executeNodeWithActivity(
  nodeId: string,
  graph: ExecutionGraph,
  state: ExecutionState,
  executionId: string,
): Promise<void> {
  const node = graph.nodes.get(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // Gather inputs from upstream nodes (using execution-engine logic)
  const inputs = gatherNodeInputs(nodeId, graph, state);

  // Get or initialize nodeState for stateful plugins
  const nodeState = state.getNodeState(nodeId);

  try {
    // Mark node as running before execution
    await storeNodeResult({
      workflowId: executionId,
      routineId: graph.routineId,
      nodeId,
      status: "running",
      startedAt: Date.now(),
    });

    const startTime = Date.now();

    // Execute plugin as Temporal Activity
    const result = await executePlugin({
      pluginId: node.pluginId,
      config: node.parameters, // parameters = config in execution-engine
      inputs,
      context: {
        userId: graph.routineId, // TODO: Pass userId from graph metadata
        routineId: graph.routineId,
        executionId,
        nodeId,
        triggerData: graph.triggerData,
      },
      nodeState,
      credentialMappings: node.credentialMappings,
    });

    // Store updated nodeState
    if (result.nodeState) {
      state.setNodeState(nodeId, result.nodeState);
    }

    // Convert plugin output to PortData[] format
    const portDataArray = convertToPortData(result.output);

    // Store result in state
    state.addNodeResult(nodeId, {
      outputs: portDataArray,
      executionTime: Date.now() - startTime,
      status: "success",
    });

    // Persist to Convex for observability
    await storeNodeResult({
      workflowId: executionId,
      routineId: graph.routineId,
      nodeId,
      status: "completed",
      output: result.output,
      completedAt: Date.now(),
    });
  } catch (error: any) {
    // Unwrap Temporal ActivityFailure to get the real error message
    const rootCause = error.cause || error;
    const errorMessage = rootCause.message || error.message || "Unknown error";
    const errorStack = rootCause.stack || error.stack;

    // Mark node as failed
    state.addNodeResult(nodeId, {
      outputs: [],
      executionTime: 0,
      status: "error",
      error: {
        message: errorMessage,
        stack: errorStack,
      },
    });

    // Node execution failed
    await storeNodeResult({
      workflowId: executionId,
      routineId: graph.routineId,
      nodeId,
      status: "failed",
      error: {
        message: errorMessage,
        stack: errorStack,
      },
      completedAt: Date.now(),
    });

    // Re-throw to stop execution
    throw new Error(
      `Node ${nodeId} (${node.pluginId}) failed: ${errorMessage}`,
    );
  }
}

/**
 * Gather inputs for a node from upstream nodes
 * Converts from PortData[] back to Record<string, unknown>
 */
function gatherNodeInputs(
  nodeId: string,
  graph: ExecutionGraph,
  state: ExecutionState,
): Record<string, unknown> {
  const incomingEdges = graph.edgesByTarget.get(nodeId) || [];
  const inputs: Record<string, unknown> = {};

  for (const edge of incomingEdges) {
    // Get the latest output from the source node
    const portDataArray = state.nodeOutputs.get(edge.sourceNodeId);

    if (portDataArray) {
      // Find the specific port
      const portData = portDataArray.find(
        (p) => p.portName === edge.sourcePort,
      );

      if (portData?.items && portData.items.length > 0 && portData.items[0]) {
        // For now, take the first item's data
        // TODO: Handle multiple items (n8n-style batch processing)
        inputs[edge.targetPort] = portData.items[0].data;
      }
    }
  }

  return inputs;
}

/**
 * Convert plugin output (Record<string, unknown>) to PortData[]
 */
function convertToPortData(
  output: unknown,
): import("@kianax/execution-engine").PortData[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const portDataArray: import("@kianax/execution-engine").PortData[] = [];

  for (const [portName, data] of Object.entries(output)) {
    portDataArray.push({
      portName,
      items: [
        {
          data,
          metadata: {},
        },
      ],
    });
  }

  return portDataArray;
}
