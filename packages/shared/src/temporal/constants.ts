/**
 * Temporal Constants
 * Configuration constants for Temporal workflows and activities
 */

export const TASK_QUEUE_PREFIX = 'user-';
export const DEFAULT_TASK_QUEUE = 'kianax-default';

export const TIMEOUTS = {
  ACTIVITY_START_TO_CLOSE: '5 minutes',
  ACTIVITY_SCHEDULE_TO_CLOSE: '10 minutes',
  ACTIVITY_HEARTBEAT: '30 seconds',
} as const;

export const RETRY_POLICY = {
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '1m',
  maximumAttempts: 3,
} as const;
