/**
 * Test Routine Execution Script
 *
 * Tests the routine executor workflow with an example routine that demonstrates:
 * - Data input node (stock-price)
 * - Logic node (if-else conditional branching)
 * - Multiple output branches
 */

import { Client, Connection } from "@temporalio/client";
import { nanoid } from "nanoid";
import { routineExecutor } from "@kianax/workers";
import type { RoutineInput } from "@kianax/shared/temporal";

/**
 * Example Routine: Stock Price Monitor with Conditional Alert
 *
 * Flow:
 *   [Stock Price Input]
 *          ↓
 *   [If-Else: Price < $150?]
 *      ↙         ↘
 *   [True]      [False]
 *   Alert       Log
 *
 * This tests:
 * - Basic linear flow
 * - Conditional branching
 * - Dead branch handling (only one path executes)
 */
function createExampleRoutine(): RoutineInput {
  return {
    routineId: `routine-${nanoid()}`,
    userId: `user-${nanoid()}`,
    nodes: [
      {
        id: "n1",
        pluginId: "stock-price",
        type: "input",
        config: {
          symbol: "AAPL",
        },
        enabled: true,
      },
      {
        id: "n2",
        pluginId: "if-else",
        type: "logic",
        config: {
          condition: "input.price < 150",
        },
        enabled: true,
      },
      {
        id: "n3",
        pluginId: "email",
        type: "output",
        config: {
          subject: "Stock Alert: Price Drop",
          body: "AAPL price is below $150!",
        },
        enabled: true,
      },
      {
        id: "n4",
        pluginId: "http-request",
        type: "output",
        config: {
          url: "https://example.com/log",
          method: "POST",
        },
        enabled: true,
      },
    ],
    connections: [
      {
        id: "c1",
        sourceNodeId: "n1",
        targetNodeId: "n2",
        sourceHandle: "price",
        targetHandle: "input",
      },
      {
        id: "c2",
        sourceNodeId: "n2",
        targetNodeId: "n3",
        condition: {
          type: "branch",
          value: "true",
        },
      },
      {
        id: "c3",
        sourceNodeId: "n2",
        targetNodeId: "n4",
        condition: {
          type: "branch",
          value: "false",
        },
      },
    ],
    triggerData: {
      timestamp: Date.now(),
      source: "test-script",
    },
  };
}

/**
 * Example Routine 2: Parallel Execution
 *
 * Flow:
 *   [Stock Price Input]
 *      ↙         ↘
 *   [Email]    [HTTP]
 *      ↘         ↙
 *       [Merge]
 *
 * This tests:
 * - Parallel node execution
 * - Merge node waiting for multiple inputs
 */
function createParallelRoutine(): RoutineInput {
  return {
    routineId: `routine-${nanoid()}`,
    userId: `user-${nanoid()}`,
    nodes: [
      {
        id: "n1",
        pluginId: "stock-price",
        type: "input",
        config: {
          symbol: "TSLA",
        },
        enabled: true,
      },
      {
        id: "n2",
        pluginId: "email",
        type: "output",
        config: {
          subject: "TSLA Price Update",
        },
        enabled: true,
      },
      {
        id: "n3",
        pluginId: "http-request",
        type: "output",
        config: {
          url: "https://example.com/tsla",
          method: "POST",
        },
        enabled: true,
      },
      {
        id: "n4",
        pluginId: "ai-transform",
        type: "processor",
        config: {
          instruction: "Summarize the results",
        },
        enabled: true,
      },
    ],
    connections: [
      {
        id: "c1",
        sourceNodeId: "n1",
        targetNodeId: "n2",
      },
      {
        id: "c2",
        sourceNodeId: "n1",
        targetNodeId: "n3",
      },
      {
        id: "c3",
        sourceNodeId: "n2",
        targetNodeId: "n4",
      },
      {
        id: "c4",
        sourceNodeId: "n3",
        targetNodeId: "n4",
      },
    ],
    triggerData: {
      timestamp: Date.now(),
      source: "test-script",
    },
  };
}

/**
 * Example Routine 3: Linear Flow (Simple)
 *
 * Flow:
 *   [Stock Price] → [AI Transform] → [Email]
 *
 * This tests:
 * - Simple linear execution
 * - Data flow between nodes
 */
function createLinearRoutine(): RoutineInput {
  return {
    routineId: `routine-${nanoid()}`,
    userId: `user-${nanoid()}`,
    nodes: [
      {
        id: "n1",
        pluginId: "stock-price",
        type: "input",
        config: {
          symbol: "GOOGL",
        },
        enabled: true,
      },
      {
        id: "n2",
        pluginId: "ai-transform",
        type: "processor",
        config: {
          instruction: "Format price data for email",
        },
        enabled: true,
      },
      {
        id: "n3",
        pluginId: "email",
        type: "output",
        config: {
          subject: "GOOGL Price Report",
        },
        enabled: true,
      },
    ],
    connections: [
      {
        id: "c1",
        sourceNodeId: "n1",
        targetNodeId: "n2",
      },
      {
        id: "c2",
        sourceNodeId: "n2",
        targetNodeId: "n3",
      },
    ],
    triggerData: {
      timestamp: Date.now(),
      source: "test-script",
    },
  };
}

async function run() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const routineType = args[0] || "conditional";

  console.log("🚀 Starting Temporal routine execution test\n");

  // Connect to Temporal server
  console.log("📡 Connecting to Temporal server...");
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
  });

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || "default",
  });

  console.log("✅ Connected to Temporal\n");

  // Create example routine based on type
  let routine: RoutineInput;
  switch (routineType) {
    case "parallel":
      console.log("📋 Creating parallel execution routine (TSLA monitoring)");
      routine = createParallelRoutine();
      break;
    case "linear":
      console.log("📋 Creating linear flow routine (GOOGL report)");
      routine = createLinearRoutine();
      break;
    case "conditional":
    default:
      console.log("📋 Creating conditional branching routine (AAPL alert)");
      routine = createExampleRoutine();
      break;
  }

  console.log(`   Routine ID: ${routine.routineId}`);
  console.log(`   Nodes: ${routine.nodes.length}`);
  console.log(`   Connections: ${routine.connections.length}\n`);

  // Start workflow
  console.log("▶️  Starting workflow execution...");
  const workflowId = `test-${routine.routineId}`;

  const handle = await client.workflow.start(routineExecutor, {
    taskQueue: "kianax-routines",
    args: [routine],
    workflowId,
  });

  console.log(`✅ Workflow started: ${handle.workflowId}\n`);

  // Monitor execution
  console.log("⏳ Waiting for workflow to complete...\n");

  try {
    const result = await handle.result();
    console.log("🎉 Workflow completed successfully!\n");
    console.log("📊 Result:", result);
    console.log(
      "\n💡 Check Convex dashboard to see execution history and node results"
    );
  } catch (error: any) {
    console.error("❌ Workflow failed:");
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

// Run the script
run().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
