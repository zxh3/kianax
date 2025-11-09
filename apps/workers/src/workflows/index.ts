/**
 * Temporal Workflow Definitions
 *
 * Temporal Workflows must be deterministic and cannot perform side effects directly.
 * They orchestrate activities which do the actual work.
 *
 * NOTE: These are Temporal "Workflows" (execution engine).
 *       User-facing automation is called "Routines" to avoid confusion.
 */

export * from './user-workflow-executor';
