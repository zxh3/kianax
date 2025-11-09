/**
 * Convex Update Activities
 *
 * Activities that update Convex database with execution status.
 * These activities call Convex mutations to store real-time status.
 */

import { ConvexHttpClient } from 'convex/browser';
import type {
  UpdateRoutineStatusInput,
  StoreNodeResultInput,
} from '@kianax/shared/temporal';

// Initialize Convex client
// In production, CONVEX_URL should be set in environment variables
const convex = new ConvexHttpClient(
  process.env.CONVEX_URL || 'http://localhost:3000'
);

export async function updateRoutineStatus(
  input: UpdateRoutineStatusInput
): Promise<void> {
  // TODO: Implement Convex mutation to update execution status
  // This should call a Convex mutation like:
  // await convex.mutation('executions:updateStatus', input);

  console.log('Updating routine status:', input);

  // For development, just log
  // In production, this will write to Convex and trigger real-time UI updates
}

export async function storeNodeResult(
  input: StoreNodeResultInput
): Promise<void> {
  // TODO: Implement Convex mutation to store node execution result
  // This should call a Convex mutation like:
  // await convex.mutation('executions:updateNodeStatus', input);

  console.log('Storing node result:', input);

  // For development, just log
  // In production, this will write to Convex for execution history and debugging
}
