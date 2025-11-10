/**
 * Test Routine Execution Script (E2E with Local-Only Plugins)
 *
 * Tests the routine executor workflow with mock plugins that run locally:
 * - Mock weather data (no external API calls)
 * - Local conditional logic
 * - Full E2E flow: Convex → Temporal → Execution tracking
 */

import "dotenv/config";
import { Client, Connection } from "@temporalio/client";
import { nanoid } from "nanoid";
import { routineExecutor } from "@kianax/workers";
import type { RoutineInput } from "@kianax/shared/temporal";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../server/convex/_generated/api";

/**
 * Simple Weather Routine (Local Mock Plugins)
 *
 * Flow:
 *   [Static Data] → [Mock Weather]
 *
 * This tests:
 * - Static data source (outputs constant values)
 * - Mock weather plugin (receives inputs like any other node)
 * - ALL nodes work identically (no special-casing)
 * - 100% local, no external APIs
 * - E2E data flow from Convex to Temporal
 */
function createSimpleWeatherRoutine(userId: string) {
  return {
    userId,
    name: "Simple Weather Check",
    description:
      "Fetch mock weather data via static data source (fully local, no external API calls)",
    status: "active" as const,
    triggerType: "manual" as const,
    nodes: [
      {
        id: "n1",
        pluginId: "static-data",
        type: "input" as const,
        label: "Weather Parameters",
        position: { x: 100, y: 100 },
        config: {
          data: {
            city: "San Francisco",
            units: "fahrenheit",
          },
        },
        enabled: true,
      },
      {
        id: "n2",
        pluginId: "mock-weather",
        type: "processor" as const,
        label: "Get Mock Weather",
        position: { x: 100, y: 250 },
        config: {},
        enabled: true,
      },
    ],
    connections: [
      {
        id: "c1",
        sourceNodeId: "n1",
        targetNodeId: "n2",
      },
    ],
    tags: ["weather", "mock", "testing", "local"],
  };
}

/**
 * Conditional Logic Routine (With Branching)
 *
 * Flow:
 *   [Static Data: condition input] → [If-Else]
 *                                        ↙        ↘
 *                          [Static: True Alert]  [Static: False Alert]
 *
 * This tests:
 * - Conditional branching (if-else logic)
 * - Data flow through conditional nodes
 * - Only one branch executes (dead branch handling)
 * - 100% local, no external APIs
 */
function createConditionalRoutine(userId: string) {
  return {
    userId,
    name: "Conditional Branching Test",
    description:
      "Test if-else conditional logic with static data (fully local)",
    status: "active" as const,
    triggerType: "manual" as const,
    nodes: [
      {
        id: "n1",
        pluginId: "static-data",
        type: "input" as const,
        label: "Condition Input",
        position: { x: 100, y: 100 },
        config: {
          data: {
            value: 10, // Test value (temperature)
            conditions: [
              {
                operator: ">",
                compareValue: 70,
              },
            ],
            logicalOperator: "AND",
          },
        },
        enabled: true,
      },
      {
        id: "n2",
        pluginId: "if-else",
        type: "logic" as const,
        label: "Check if > 70",
        position: { x: 100, y: 250 },
        config: {},
        enabled: true,
      },
      {
        id: "n3",
        pluginId: "static-data",
        type: "output" as const,
        label: "True Branch Output",
        position: { x: 50, y: 400 },
        config: {
          data: {
            message: "Condition was TRUE! (85 > 70)",
            branch: "true",
          },
        },
        enabled: true,
      },
      {
        id: "n4",
        pluginId: "static-data",
        type: "output" as const,
        label: "False Branch Output",
        position: { x: 250, y: 400 },
        config: {
          data: {
            message: "Condition was FALSE! (85 > 70)",
            branch: "false",
          },
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
        condition: {
          type: "branch" as const,
          value: "true",
        },
      },
      {
        id: "c3",
        sourceNodeId: "n2",
        targetNodeId: "n4",
        condition: {
          type: "branch" as const,
          value: "false",
        },
      },
    ],
    tags: ["conditional", "branching", "if-else", "testing", "local"],
  };
}

async function run() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const routineType = args[0] || "simple";

  console.log("🚀 Starting E2E routine execution test (LOCAL MOCK PLUGINS)\n");

  // Initialize Convex client
  console.log("📡 Connecting to Convex...");
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error(
      "CONVEX_URL environment variable is required. Make sure .env.local exists in apps/scripts/ with CONVEX_URL set.",
    );
  }
  const convex = new ConvexHttpClient(convexUrl);
  console.log(`✅ Connected to Convex: ${convexUrl}\n`);

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

  // Generate test user ID
  const userId = `test-user-${nanoid()}`;

  // Create routine based on type
  let routineData:
    | ReturnType<typeof createSimpleWeatherRoutine>
    | ReturnType<typeof createConditionalRoutine>;
  switch (routineType) {
    case "conditional":
      console.log("📋 Creating conditional logic routine (WITH BRANCHING)");
      routineData = createConditionalRoutine(userId);
      break;
    case "simple":
    default:
      console.log("📋 Creating simple weather routine (BASIC FLOW)");
      routineData = createSimpleWeatherRoutine(userId);
      break;
  }

  console.log(`   Name: ${routineData.name}`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Nodes: ${routineData.nodes.length}`);
  console.log(`   Connections: ${routineData.connections.length}\n`);

  // Step 1: Write routine to Convex
  console.log("💾 Writing routine to Convex database...");
  const routineId = await convex.mutation(api.routines.create, routineData);
  console.log(`✅ Routine saved to Convex: ${routineId}\n`);

  // Step 2: Fetch routine from Convex
  console.log("🔍 Fetching routine from Convex...");
  const savedRoutine = await convex.query(api.routines.get, { id: routineId });
  if (!savedRoutine) {
    throw new Error(`Failed to fetch routine ${routineId} from Convex`);
  }
  console.log(`✅ Routine fetched from database\n`);

  // Step 3: Convert Convex routine to RoutineInput for Temporal workflow
  console.log("🔄 Converting routine to workflow input...");
  const routineInput: RoutineInput = {
    routineId: savedRoutine._id,
    userId: savedRoutine.userId,
    nodes: savedRoutine.nodes.map((node) => ({
      id: node.id,
      pluginId: node.pluginId,
      type: node.type,
      config: node.config || {},
      enabled: node.enabled,
    })),
    connections: savedRoutine.connections,
    triggerData: {
      timestamp: Date.now(),
      source: "test-script-e2e",
      triggerType: savedRoutine.triggerType,
    },
  };
  console.log(`✅ Routine converted to workflow input\n`);

  // Step 4: Start Temporal workflow
  console.log("▶️  Starting Temporal workflow execution...");
  const workflowId = `test-${routineId}-${Date.now()}`;

  const handle = await client.workflow.start(routineExecutor, {
    taskQueue: "default",
    args: [routineInput],
    workflowId,
  });

  console.log(`✅ Workflow started: ${handle.workflowId}\n`);

  // Step 5: Monitor execution
  console.log("⏳ Waiting for workflow to complete...\n");

  try {
    const result = await handle.result();
    console.log("🎉 Workflow completed successfully!\n");
    console.log("📊 Result:", JSON.stringify(result, null, 2));
    console.log(
      "\n💡 Check Convex dashboard to see execution history and node results",
    );
    console.log(`   Routine ID in Convex: ${routineId}`);
    console.log(`   Workflow ID in Temporal: ${workflowId}`);
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
