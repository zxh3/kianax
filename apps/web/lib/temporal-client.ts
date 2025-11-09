/**
 * Temporal Client Singleton
 *
 * Provides a singleton Temporal client for the Next.js app.
 * Used by API routes and Convex functions to start workflows.
 *
 * IMPORTANT: Only use this in server-side code (API routes, Server Components, Convex).
 * Never import this in client components.
 */

import { Client, Connection } from '@temporalio/client';

let client: Client | null = null;
let connection: Connection | null = null;

/**
 * Get or create the Temporal client singleton
 */
export async function getTemporalClient(): Promise<Client> {
  if (client) {
    return client;
  }

  // Create connection
  const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';

  // For Temporal Cloud (production)
  if (process.env.TEMPORAL_CLIENT_CERT && process.env.TEMPORAL_CLIENT_KEY) {
    connection = await Connection.connect({
      address,
      tls: {
        clientCertPair: {
          crt: Buffer.from(process.env.TEMPORAL_CLIENT_CERT, 'base64'),
          key: Buffer.from(process.env.TEMPORAL_CLIENT_KEY, 'base64'),
        },
      },
    });
  } else {
    // Local development
    connection = await Connection.connect({ address });
  }

  // Create client
  client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  console.log('✅ Temporal client initialized');
  console.log(`   Address: ${address}`);
  console.log(`   Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);

  return client;
}

/**
 * Start a workflow execution
 *
 * @example
 * const handle = await startWorkflow('userWorkflowExecutor', {
 *   workflowId: 'workflow-123',
 *   taskQueue: 'kianax-workflows',
 *   args: [workflowDefinition],
 * });
 */
export async function startWorkflow<T = any>(
  workflowType: string,
  options: {
    workflowId: string;
    taskQueue: string;
    args: any[];
    cronSchedule?: string;
  }
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
 * Get workflow execution handle
 */
export async function getWorkflowHandle(workflowId: string) {
  const client = await getTemporalClient();
  return client.workflow.getHandle(workflowId);
}

/**
 * Cancel a workflow execution
 */
export async function cancelWorkflow(workflowId: string) {
  const handle = await getWorkflowHandle(workflowId);
  await handle.cancel();
}

/**
 * Query workflow status
 */
export async function getWorkflowStatus(workflowId: string) {
  const handle = await getWorkflowHandle(workflowId);
  return await handle.describe();
}
