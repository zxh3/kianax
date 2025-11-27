/**
 * Temporal Client Singleton
 *
 * Provides a singleton Temporal client for the Next.js app.
 * Used by API routes and Convex functions to start routine executions.
 *
 * IMPORTANT: Only use this in server-side code (API routes, Server Components, Convex).
 * Never import this in client components.
 *
 * TERMINOLOGY NOTE:
 * - "Routine" = user-facing automation (product concept)
 * - "Workflow" = Temporal's execution engine (infrastructure concept)
 * - We start Temporal Workflows to execute user Routines
 */

import { Client, Connection } from "@temporalio/client";
import { parseWebEnv } from "@kianax/config";

let client: Client | null = null;
let connection: Connection | null = null;

/**
 * Get or create the Temporal client singleton
 */
export async function getTemporalClient(): Promise<Client> {
  if (client) {
    return client;
  }

  const env = parseWebEnv();
  const { temporal } = env;

  // For Temporal Cloud (production)
  if (temporal.clientCert && temporal.clientKey) {
    connection = await Connection.connect({
      address: temporal.address,
      tls: {
        clientCertPair: {
          crt: Buffer.from(temporal.clientCert, "base64"),
          key: Buffer.from(temporal.clientKey, "base64"),
        },
      },
    });
  } else {
    // Local development
    connection = await Connection.connect({ address: temporal.address });
  }

  // Create client
  client = new Client({
    connection,
    namespace: temporal.namespace,
  });

  console.log("✅ Temporal client initialized");
  console.log(`   Address: ${temporal.address}`);
  console.log(`   Namespace: ${temporal.namespace}`);

  return client;
}

/**
 * Start a routine execution (via Temporal Workflow)
 *
 * @example
 * const handle = await startRoutine('routineExecutor', {
 *   workflowId: 'routine-123',
 *   taskQueue: 'kianax-workflows',
 *   args: [routineDefinition],
 * });
 */
export async function startRoutine<_T = any>(
  workflowType: string,
  options: {
    workflowId: string; // Still called workflowId for Temporal compatibility
    taskQueue: string;
    args: any[];
    cronSchedule?: string;
  },
) {
  const client = await getTemporalClient();

  const handle = await client.workflow.start(workflowType, {
    workflowId: options.workflowId,
    taskQueue: options.taskQueue,
    args: options.args,
    cronSchedule: options.cronSchedule,
  });

  return handle;
}

/**
 * Get routine execution handle
 */
export async function getRoutineHandle(routineId: string) {
  const client = await getTemporalClient();
  return client.workflow.getHandle(routineId);
}

/**
 * Cancel a routine execution
 */
export async function cancelRoutine(routineId: string) {
  const handle = await getRoutineHandle(routineId);
  await handle.cancel();
}

/**
 * Query routine execution status
 */
export async function getRoutineStatus(routineId: string) {
  const handle = await getRoutineHandle(routineId);
  return await handle.describe();
}
