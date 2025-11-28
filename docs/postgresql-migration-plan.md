# PostgreSQL Migration Plan

> Migrating Kianax from Convex to self-deployed PostgreSQL

**Status:** Draft
**Created:** 2024-01-XX
**Estimated Effort:** 4-6 weeks (1 developer)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Schema Design](#3-database-schema-design)
4. [Backend Migration](#4-backend-migration)
5. [Real-Time Strategy](#5-real-time-strategy)
6. [Authentication Migration](#6-authentication-migration)
7. [Worker Migration](#7-worker-migration)
8. [Frontend Migration](#8-frontend-migration)
9. [Data Migration](#9-data-migration)
10. [Infrastructure Setup](#10-infrastructure-setup)
11. [Testing Strategy](#11-testing-strategy)
12. [Rollback Plan](#12-rollback-plan)
13. [Migration Phases](#13-migration-phases)

---

## 1. Executive Summary

### Why Migrate?

| Motivation | Benefit |
|------------|---------|
| Cost predictability | Fixed hosting vs. usage-based pricing |
| Query flexibility | Full SQL, CTEs, window functions, complex joins |
| Ecosystem access | Prisma/Drizzle, pgvector, extensions |
| Portability | No vendor lock-in, self-host anywhere |
| Future-proofing | Vector search for AI features (pgvector) |

### What Changes

| Component | Current (Convex) | Target (PostgreSQL) |
|-----------|------------------|---------------------|
| Database | Convex Cloud | Self-hosted PostgreSQL |
| Backend | Convex Functions | Next.js API Routes + tRPC |
| Real-time | Convex Subscriptions | Server-Sent Events (SSE) |
| ORM | Convex SDK | Drizzle ORM |
| Auth | Better Auth + Convex Adapter | Better Auth + Drizzle Adapter |
| Workers | ConvexHttpClient | Direct PostgreSQL via Drizzle |

### What Stays the Same

- Next.js frontend architecture
- Temporal workflow engine
- Plugin system
- UI components
- Better Auth (different adapter)

---

## 2. Architecture Overview

### Current Architecture

```
┌─────────────┐     ┌─────────────────────────────┐
│   Next.js   │────▶│         Convex Cloud        │
│   Frontend  │◀────│  (DB + Functions + Realtime)│
└─────────────┘     └─────────────────────────────┘
                                  ▲
                                  │
                    ┌─────────────┴─────────────┐
                    │    Temporal Workers       │
                    │   (ConvexHttpClient)      │
                    └───────────────────────────┘
```

### Target Architecture

```
┌─────────────┐     ┌─────────────────────────────┐
│   Next.js   │────▶│      Next.js API Routes     │
│   Frontend  │◀────│         (tRPC + SSE)        │
└─────────────┘     └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │        PostgreSQL           │
                    │    (Drizzle ORM + RLS)      │
                    └──────────────▲──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      Temporal Workers       │
                    │    (Direct Drizzle calls)   │
                    └─────────────────────────────┘
```

---

## 3. Database Schema Design

### 3.1 Schema Philosophy

**Design Decisions:**
1. Use **JSONB** for nested arrays (nodes, connections, nodeStates) - minimizes migration complexity
2. Use **UUID** primary keys for consistency
3. Implement **Row-Level Security (RLS)** for multi-tenancy
4. Add **timestamps** (created_at, updated_at) to all tables
5. Keep credential `data` as encrypted text (existing encryption)

### 3.2 Complete Schema (Drizzle)

Create `packages/database/src/schema.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

// ============================================================================
// ENUMS
// ============================================================================

export const routineStatusEnum = pgEnum("routine_status", [
  "draft",
  "active",
  "paused",
  "archived",
]);

export const triggerTypeEnum = pgEnum("trigger_type", [
  "manual",
  "cron",
  "webhook",
  "event",
]);

export const executionStatusEnum = pgEnum("execution_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "timeout",
]);

export const executionTriggerTypeEnum = pgEnum("execution_trigger_type", [
  "manual",
  "scheduled",
  "webhook",
  "event",
]);

export const themeEnum = pgEnum("theme", ["light", "dark", "system"]);

// ============================================================================
// ROUTINES
// ============================================================================

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),

    // Metadata
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: routineStatusEnum("status").notNull().default("draft"),
    tags: jsonb("tags").$type<string[]>().default([]),
    version: integer("version").notNull().default(1),

    // Trigger
    triggerType: triggerTypeEnum("trigger_type").notNull().default("manual"),
    triggerConfig: jsonb("trigger_config").$type<Record<string, unknown>>(),

    // DAG Structure (JSONB for flexibility)
    nodes: jsonb("nodes")
      .$type<
        Array<{
          id: string;
          pluginId: string;
          label: string;
          position: { x: number; y: number };
          config?: Record<string, unknown>;
          credentialMappings?: Record<string, string>;
        }>
      >()
      .notNull()
      .default([]),

    connections: jsonb("connections")
      .$type<
        Array<{
          id: string;
          sourceNodeId: string;
          targetNodeId: string;
          sourceHandle?: string;
          targetHandle?: string;
        }>
      >()
      .notNull()
      .default([]),

    // Variables
    variables: jsonb("variables")
      .$type<
        Array<{
          id: string;
          name: string;
          type: "string" | "number" | "boolean" | "json";
          value: unknown;
          description?: string;
        }>
      >()
      .default([]),

    // Execution tracking
    lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("routines_user_idx").on(table.userId),
    statusIdx: index("routines_status_idx").on(table.status),
    userStatusIdx: index("routines_user_status_idx").on(
      table.userId,
      table.status
    ),
    triggerTypeIdx: index("routines_trigger_type_idx").on(
      table.triggerType,
      table.status
    ),
  })
);

// ============================================================================
// ROUTINE EXECUTIONS
// ============================================================================

export const routineExecutions = pgTable(
  "routine_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),

    // Temporal identifiers
    workflowId: text("workflow_id").notNull(),
    runId: text("run_id").notNull(),

    // Status
    status: executionStatusEnum("status").notNull().default("pending"),
    triggerType: executionTriggerTypeEnum("trigger_type")
      .notNull()
      .default("manual"),
    triggerData: jsonb("trigger_data").$type<Record<string, unknown>>(),

    // Execution path (ordered node IDs for conditional branching)
    executionPath: jsonb("execution_path").$type<string[]>().default([]),

    // Node-level execution states (JSONB array)
    nodeStates: jsonb("node_states")
      .$type<
        Array<{
          nodeId: string;
          status: string;
          input?: unknown;
          output?: unknown;
          error?: { message: string; stack?: string };
          startedAt?: number;
          completedAt?: number;
          duration?: number;
        }>
      >()
      .notNull()
      .default([]),

    // Workflow-level error
    error: jsonb("error").$type<{ message: string; stack?: string }>(),

    // Timing
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    duration: integer("duration"), // milliseconds

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    routineIdx: index("executions_routine_idx").on(table.routineId),
    userIdx: index("executions_user_idx").on(table.userId),
    statusIdx: index("executions_status_idx").on(table.status),
    workflowIdIdx: index("executions_workflow_id_idx").on(table.workflowId),
    createdAtIdx: index("executions_created_at_idx").on(table.createdAt),
  })
);

// ============================================================================
// USER CREDENTIALS
// ============================================================================

export const userCredentials = pgTable(
  "user_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    typeId: varchar("type_id", { length: 100 }).notNull(), // e.g., "openai-api"
    name: varchar("name", { length: 255 }).notNull(),
    data: text("data").notNull(), // Encrypted JSON
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("credentials_user_idx").on(table.userId),
    userTypeIdx: index("credentials_user_type_idx").on(
      table.userId,
      table.typeId
    ),
  })
);

// ============================================================================
// USER SETTINGS
// ============================================================================

export const userSettings = pgTable(
  "user_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().unique(),
    theme: themeEnum("theme").default("system"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("settings_user_idx").on(table.userId),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;

export type RoutineExecution = typeof routineExecutions.$inferSelect;
export type NewRoutineExecution = typeof routineExecutions.$inferInsert;

export type UserCredential = typeof userCredentials.$inferSelect;
export type NewUserCredential = typeof userCredentials.$inferInsert;

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
```

### 3.3 Row-Level Security Policies

Create migration for RLS:

```sql
-- Enable RLS on all user-scoped tables
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Routines: Users can only access their own
CREATE POLICY routines_user_isolation ON routines
  USING (user_id = current_setting('app.current_user_id', true));

-- Executions: Users can only access their own
CREATE POLICY executions_user_isolation ON routine_executions
  USING (user_id = current_setting('app.current_user_id', true));

-- Credentials: Users can only access their own
CREATE POLICY credentials_user_isolation ON user_credentials
  USING (user_id = current_setting('app.current_user_id', true));

-- Settings: Users can only access their own
CREATE POLICY settings_user_isolation ON user_settings
  USING (user_id = current_setting('app.current_user_id', true));
```

---

## 4. Backend Migration

### 4.1 New Package Structure

```
packages/
├── database/                    # NEW: Shared database layer
│   ├── src/
│   │   ├── schema.ts           # Drizzle schema definitions
│   │   ├── client.ts           # Database client factory
│   │   ├── migrate.ts          # Migration runner
│   │   └── repositories/       # Data access layer
│   │       ├── routines.ts
│   │       ├── executions.ts
│   │       ├── credentials.ts
│   │       └── settings.ts
│   ├── drizzle/
│   │   └── migrations/         # SQL migration files
│   └── drizzle.config.ts
```

### 4.2 Database Client

Create `packages/database/src/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export type Database = ReturnType<typeof getDb>;

// For setting RLS context
export async function withUserContext<T>(
  db: Database,
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  await db.execute(`SET LOCAL app.current_user_id = '${userId}'`);
  return fn();
}
```

### 4.3 Repository Pattern

Create `packages/database/src/repositories/routines.ts`:

```typescript
import { eq, and, desc } from "drizzle-orm";
import { routines, type Routine, type NewRoutine } from "../schema";
import type { Database } from "../client";

export class RoutinesRepository {
  constructor(private db: Database) {}

  async create(data: NewRoutine): Promise<Routine> {
    const [routine] = await this.db.insert(routines).values(data).returning();
    return routine;
  }

  async getById(id: string): Promise<Routine | undefined> {
    const [routine] = await this.db
      .select()
      .from(routines)
      .where(eq(routines.id, id))
      .limit(1);
    return routine;
  }

  async listByUser(
    userId: string,
    status?: Routine["status"]
  ): Promise<Routine[]> {
    const conditions = status
      ? and(eq(routines.userId, userId), eq(routines.status, status))
      : eq(routines.userId, userId);

    return this.db
      .select()
      .from(routines)
      .where(conditions)
      .orderBy(desc(routines.updatedAt));
  }

  async update(
    id: string,
    data: Partial<Omit<Routine, "id" | "createdAt">>
  ): Promise<Routine> {
    const [routine] = await this.db
      .update(routines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(routines.id, id))
      .returning();
    return routine;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(routines).where(eq(routines.id, id));
  }

  async incrementVersion(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE routines SET version = version + 1, updated_at = NOW() WHERE id = '${id}'`
    );
  }
}
```

### 4.4 tRPC Router Setup

Create `apps/web/server/trpc/routers/routines.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { RoutinesRepository } from "@kianax/database/repositories/routines";
import { getDb } from "@kianax/database/client";

const routineNodeSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  label: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.unknown()).optional(),
  credentialMappings: z.record(z.string()).optional(),
});

const routineConnectionSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

export const routinesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum(["draft", "active", "paused", "archived"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const repo = new RoutinesRepository(getDb());
      return repo.listByUser(ctx.userId, input?.status);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const repo = new RoutinesRepository(getDb());
      const routine = await repo.getById(input.id);

      if (!routine || routine.userId !== ctx.userId) {
        throw new Error("Routine not found");
      }

      return routine;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        status: z.enum(["draft", "active", "paused", "archived"]),
        triggerType: z.enum(["manual", "cron", "webhook", "event"]),
        triggerConfig: z.record(z.unknown()).optional(),
        nodes: z.array(routineNodeSchema),
        connections: z.array(routineConnectionSchema),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repo = new RoutinesRepository(getDb());
      return repo.create({
        ...input,
        userId: ctx.userId,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        status: z.enum(["draft", "active", "paused", "archived"]).optional(),
        nodes: z.array(routineNodeSchema).optional(),
        connections: z.array(routineConnectionSchema).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repo = new RoutinesRepository(getDb());
      const existing = await repo.getById(input.id);

      if (!existing || existing.userId !== ctx.userId) {
        throw new Error("Routine not found");
      }

      const { id, ...updates } = input;

      // Increment version if structure changed
      const structureChanged =
        updates.nodes !== undefined || updates.connections !== undefined;

      if (structureChanged) {
        await repo.incrementVersion(id);
      }

      return repo.update(id, updates);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const repo = new RoutinesRepository(getDb());
      const existing = await repo.getById(input.id);

      if (!existing || existing.userId !== ctx.userId) {
        throw new Error("Routine not found");
      }

      await repo.delete(input.id);
      return { success: true };
    }),
});
```

### 4.5 Migration Mapping: Convex → tRPC

| Convex Function | tRPC Procedure | Notes |
|-----------------|----------------|-------|
| `routines.get` | `routines.get` | Same signature |
| `routines.listByUser` | `routines.list` | Add filtering |
| `routines.create` | `routines.create` | Same signature |
| `routines.update` | `routines.update` | Auto-version increment |
| `routines.deleteRoutine` | `routines.delete` | Renamed |
| `routines.addVariable` | `routines.addVariable` | New procedure |
| `executions.create` | `executions.create` | Workers call directly |
| `executions.getByWorkflowId` | `executions.getByWorkflowId` | For polling |
| `credentials.list` | `credentials.list` | Exclude `data` field |
| `credentials.getForExecution` | Direct call | Workers bypass tRPC |
| `oauth.exchangeCode` | API route | `/api/oauth/callback` |
| `settings.get` | `settings.get` | Same pattern |

---

## 5. Real-Time Strategy

### 5.1 Options Comparison

| Approach | Complexity | Latency | Scalability | Cost |
|----------|------------|---------|-------------|------|
| **Polling** | Low | High (1-5s) | Good | Low |
| **Server-Sent Events (SSE)** | Medium | Low (100ms) | Good | Low |
| **WebSocket (custom)** | High | Very low | Moderate | Medium |
| **Supabase Realtime** | Low | Low | Good | Medium |
| **Ably/Pusher** | Low | Very low | Excellent | High |

### 5.2 Recommended: Server-Sent Events (SSE)

SSE is ideal because:
- Your real-time needs are **unidirectional** (server → client)
- Lower complexity than WebSockets
- Native browser support, no client library needed
- Works with Next.js API routes

### 5.3 SSE Implementation

Create `apps/web/app/api/executions/[workflowId]/stream/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { getDb } from "@kianax/database/client";
import { routineExecutions } from "@kianax/database/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { workflowId } = params;
  const db = getDb();

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Poll database and emit changes
      let lastStatus = "";
      let lastNodeStatesHash = "";

      const poll = async () => {
        try {
          const [execution] = await db
            .select()
            .from(routineExecutions)
            .where(eq(routineExecutions.workflowId, workflowId))
            .limit(1);

          if (!execution) {
            sendEvent({ type: "not_found" });
            controller.close();
            return;
          }

          // Check for changes
          const nodeStatesHash = JSON.stringify(execution.nodeStates);
          if (
            execution.status !== lastStatus ||
            nodeStatesHash !== lastNodeStatesHash
          ) {
            lastStatus = execution.status;
            lastNodeStatesHash = nodeStatesHash;
            sendEvent({ type: "update", execution });
          }

          // Stop polling on terminal states
          if (["completed", "failed", "cancelled", "timeout"].includes(execution.status)) {
            sendEvent({ type: "complete" });
            controller.close();
            return;
          }

          // Continue polling
          setTimeout(poll, 500); // 500ms interval
        } catch (error) {
          sendEvent({ type: "error", message: String(error) });
          controller.close();
        }
      };

      poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 5.4 Frontend Hook

Create `apps/web/hooks/use-execution-stream.ts`:

```typescript
import { useEffect, useState, useCallback } from "react";
import type { RoutineExecution } from "@kianax/database/schema";

export function useExecutionStream(workflowId: string | null) {
  const [execution, setExecution] = useState<RoutineExecution | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");

  useEffect(() => {
    if (!workflowId) {
      setExecution(null);
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    const eventSource = new EventSource(
      `/api/executions/${workflowId}/stream`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "update") {
        setExecution(data.execution);
        setStatus("connected");
      } else if (data.type === "complete" || data.type === "not_found") {
        eventSource.close();
        setStatus("idle");
      } else if (data.type === "error") {
        setStatus("error");
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setStatus("error");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [workflowId]);

  return { execution, status };
}
```

### 5.5 Alternative: PostgreSQL LISTEN/NOTIFY

For lower latency, use pg_notify triggered by database changes:

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION notify_execution_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'execution_updates',
    json_build_object(
      'workflow_id', NEW.workflow_id,
      'status', NEW.status
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER execution_change_trigger
AFTER INSERT OR UPDATE ON routine_executions
FOR EACH ROW EXECUTE FUNCTION notify_execution_change();
```

Then use a WebSocket server (or SSE with pg LISTEN) to forward notifications.

---

## 6. Authentication Migration

### 6.1 Better Auth with Drizzle Adapter

Better Auth supports PostgreSQL via Drizzle adapter natively.

Update `apps/web/lib/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@kianax/database/client";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
```

### 6.2 Better Auth Schema

Better Auth will auto-create tables. Ensure these exist:

```sql
-- Created automatically by Better Auth
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  image TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  scope TEXT,
  id_token TEXT,
  password TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ... additional tables for verifications, etc.
```

### 6.3 Migration Steps

1. Export users from Convex
2. Import into PostgreSQL `users` table
3. Re-hash passwords if format differs (unlikely with Better Auth)
4. OAuth accounts will require re-linking (users sign in again)

---

## 7. Worker Migration

### 7.1 Current Worker Flow

```
Temporal Workflow
    │
    ▼
Activity: createRoutineExecution()
    │
    └─▶ ConvexHttpClient.mutation(api.executions.create)
    │
Activity: executeNode()
    │
    └─▶ ConvexHttpClient.mutation(api.executions.storeNodeResult)
    │
Activity: updateRoutineStatus()
    │
    └─▶ ConvexHttpClient.mutation(api.executions.updateStatus)
```

### 7.2 Target Worker Flow

```
Temporal Workflow
    │
    ▼
Activity: createRoutineExecution()
    │
    └─▶ ExecutionsRepository.create()  (direct Drizzle)
    │
Activity: executeNode()
    │
    └─▶ ExecutionsRepository.storeNodeResult()
    │
Activity: updateRoutineStatus()
    │
    └─▶ ExecutionsRepository.updateStatus()
```

### 7.3 Updated Activity

Modify `apps/workers/src/activities/database.ts`:

```typescript
import { getDb } from "@kianax/database/client";
import { ExecutionsRepository } from "@kianax/database/repositories/executions";

const db = getDb();
const executionsRepo = new ExecutionsRepository(db);

export async function createRoutineExecution(input: {
  routineId: string;
  userId: string;
  workflowId: string;
  runId: string;
  triggerType: "manual" | "scheduled" | "webhook" | "event";
}): Promise<string> {
  const execution = await executionsRepo.create({
    routineId: input.routineId,
    userId: input.userId,
    workflowId: input.workflowId,
    runId: input.runId,
    triggerType: input.triggerType,
    status: "running",
    startedAt: new Date(),
    nodeStates: [],
  });

  return execution.id;
}

export async function storeNodeResult(input: {
  workflowId: string;
  nodeId: string;
  status: "running" | "completed" | "failed";
  input?: unknown;
  output?: unknown;
  error?: { message: string; stack?: string };
}): Promise<void> {
  await executionsRepo.storeNodeResult(
    input.workflowId,
    input.nodeId,
    input.status,
    {
      input: input.input,
      output: input.output,
      error: input.error,
    }
  );
}

export async function updateRoutineStatus(input: {
  workflowId: string;
  status: "completed" | "failed" | "cancelled" | "timeout";
  error?: { message: string; stack?: string };
  executionPath?: string[];
}): Promise<void> {
  await executionsRepo.updateStatus(input.workflowId, {
    status: input.status,
    error: input.error,
    executionPath: input.executionPath,
    completedAt: new Date(),
  });
}
```

### 7.4 Credential Fetching

Update credential resolution to use direct database access:

```typescript
import { CredentialsRepository } from "@kianax/database/repositories/credentials";
import { refreshOAuth2Token } from "../lib/oauth";

export async function getCredentialForExecution(
  credentialId: string
): Promise<Record<string, unknown>> {
  const repo = new CredentialsRepository(getDb());
  const credential = await repo.getById(credentialId);

  if (!credential) {
    throw new Error(`Credential ${credentialId} not found`);
  }

  const data = JSON.parse(credential.data);

  // Handle OAuth2 token refresh
  if (data.access_token && data.refresh_token) {
    const expiresAt = data.expires_at || 0;
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (Date.now() > expiresAt - bufferMs) {
      const refreshed = await refreshOAuth2Token(credential.typeId, data.refresh_token);
      await repo.updateData(credentialId, JSON.stringify({
        ...data,
        ...refreshed,
        expires_at: Date.now() + refreshed.expires_in * 1000,
      }));
      return refreshed;
    }
  }

  return data;
}
```

---

## 8. Frontend Migration

### 8.1 Replace Convex Hooks with tRPC

**Before (Convex):**

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function RoutinesList() {
  const routines = useQuery(api.routines.listByUser);
  const deleteRoutine = useMutation(api.routines.deleteRoutine);

  // ...
}
```

**After (tRPC):**

```typescript
import { trpc } from "@/lib/trpc";

function RoutinesList() {
  const { data: routines } = trpc.routines.list.useQuery();
  const deleteRoutine = trpc.routines.delete.useMutation();

  // ...
}
```

### 8.2 File-by-File Migration

| File | Convex Usage | Migration Action |
|------|--------------|------------------|
| `dashboard/routines/page.tsx` | `useQuery(api.routines.listByUser)` | → `trpc.routines.list.useQuery()` |
| `dashboard/routines/[id]/edit/page.tsx` | `useQuery(api.routines.get)`, `useMutation(api.routines.update)` | → tRPC equivalents |
| `routines/execution-history-drawer.tsx` | `useQuery(api.executions.getByRoutine)` | → `trpc.executions.listByRoutine.useQuery()` |
| `routines/routine-editor/hooks/use-routine-execution.ts` | `useQuery(api.executions.getByWorkflowId)` | → `useExecutionStream()` hook |
| `settings/credentials/page.tsx` | `useQuery(api.credentials.list)`, mutations | → tRPC equivalents |
| `providers/dashboard-theme-provider.tsx` | `useQuery(api.settings.get)` | → `trpc.settings.get.useQuery()` |

### 8.3 tRPC Provider Setup

Create `apps/web/lib/trpc.ts`:

```typescript
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/trpc/router";

export const trpc = createTRPCReact<AppRouter>();
```

Update `apps/web/app/layout.tsx`:

```typescript
import { TRPCProvider } from "@/components/providers/trpc-provider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
```

---

## 9. Data Migration

### 9.1 Export from Convex

Create a Convex action to export all data:

```typescript
// apps/server/convex/migrations/export.ts
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const exportAllData = action({
  handler: async (ctx) => {
    const routines = await ctx.runQuery(api.routines.listAll);
    const executions = await ctx.runQuery(api.executions.listAll);
    const credentials = await ctx.runQuery(api.credentials.listAll);
    const settings = await ctx.runQuery(api.settings.listAll);

    return {
      exportedAt: new Date().toISOString(),
      routines,
      executions,
      credentials,
      settings,
    };
  },
});
```

### 9.2 Import to PostgreSQL

Create migration script:

```typescript
// scripts/migrate-from-convex.ts
import { getDb } from "@kianax/database/client";
import {
  routines,
  routineExecutions,
  userCredentials,
  userSettings,
} from "@kianax/database/schema";
import exportedData from "./convex-export.json";

async function migrate() {
  const db = getDb();

  console.log("Migrating routines...");
  for (const routine of exportedData.routines) {
    await db.insert(routines).values({
      id: routine._id, // Map Convex ID → UUID (may need conversion)
      userId: routine.userId,
      name: routine.name,
      description: routine.description,
      status: routine.status,
      triggerType: routine.triggerType,
      triggerConfig: routine.triggerConfig,
      nodes: routine.nodes,
      connections: routine.connections,
      variables: routine.variables,
      tags: routine.tags,
      version: routine.version,
      lastExecutedAt: routine.lastExecutedAt
        ? new Date(routine.lastExecutedAt)
        : null,
      createdAt: new Date(routine._creationTime),
      updatedAt: new Date(routine._creationTime),
    });
  }

  console.log("Migrating executions...");
  // Similar for executions...

  console.log("Migrating credentials...");
  // Similar for credentials...

  console.log("Migrating settings...");
  // Similar for settings...

  console.log("Migration complete!");
}

migrate().catch(console.error);
```

### 9.3 ID Mapping

Convex uses string IDs like `"routines:abc123"`. PostgreSQL uses UUIDs.

**Options:**

1. **Generate new UUIDs** - Simpler, but breaks existing references
2. **Store Convex ID as secondary column** - Add `legacy_id TEXT` for reference
3. **Hash Convex ID to UUID** - Deterministic mapping

**Recommendation:** Option 2 - Add `legacy_id` column during migration, remove after verification.

---

## 10. Infrastructure Setup

### 10.1 PostgreSQL Hosting Options

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Supabase** | Free tier, realtime built-in, auth | Vendor-specific features | Free → $25/mo |
| **Neon** | Serverless, branching, free tier | Newer, less ecosystem | Free → $19/mo |
| **Railway** | Simple deployment, git integration | Limited free tier | $5/mo |
| **Render** | Free tier, managed | US regions only | Free → $7/mo |
| **AWS RDS** | Enterprise-grade, full control | Complex setup | $15+/mo |
| **Self-hosted (VPS)** | Full control, cheapest | Maintenance burden | $5/mo |

**Recommendation for MVP:** Neon or Supabase (free tier, easy setup)

**Recommendation for Production:** Railway or Render (predictable pricing)

### 10.2 Neon Setup

```bash
# Install Neon CLI
npm install -g neonctl

# Create project
neonctl projects create --name kianax

# Get connection string
neonctl connection-string

# Set in environment
export DATABASE_URL="postgresql://..."
```

### 10.3 Environment Variables

Update `.env.local` files:

```bash
# apps/web/.env.local
DATABASE_URL=postgresql://user:pass@host:5432/kianax
DIRECT_URL=postgresql://user:pass@host:5432/kianax  # For migrations

# apps/workers/.env.local
DATABASE_URL=postgresql://user:pass@host:5432/kianax
```

### 10.4 Drizzle Configuration

Create `packages/database/drizzle.config.ts`:

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### 10.5 Migration Commands

```bash
# Generate migration
bunx drizzle-kit generate:pg

# Apply migration
bunx drizzle-kit push:pg

# Open Drizzle Studio
bunx drizzle-kit studio
```

---

## 11. Testing Strategy

### 11.1 Test Phases

```
Phase 1: Unit Tests (Repository Layer)
    │
    ▼
Phase 2: Integration Tests (API Routes)
    │
    ▼
Phase 3: E2E Tests (Full Flow)
    │
    ▼
Phase 4: Shadow Testing (Parallel Writes)
    │
    ▼
Phase 5: Production Validation
```

### 11.2 Repository Tests

```typescript
// packages/database/src/repositories/__tests__/routines.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../client";
import { RoutinesRepository } from "../routines";
import { routines } from "../schema";

describe("RoutinesRepository", () => {
  const db = getDb();
  const repo = new RoutinesRepository(db);

  beforeEach(async () => {
    await db.delete(routines);
  });

  it("should create a routine", async () => {
    const routine = await repo.create({
      userId: "user-1",
      name: "Test Routine",
      status: "draft",
      triggerType: "manual",
      nodes: [],
      connections: [],
    });

    expect(routine.id).toBeDefined();
    expect(routine.name).toBe("Test Routine");
  });

  it("should list routines by user", async () => {
    await repo.create({ userId: "user-1", name: "R1", status: "draft", triggerType: "manual", nodes: [], connections: [] });
    await repo.create({ userId: "user-1", name: "R2", status: "active", triggerType: "manual", nodes: [], connections: [] });
    await repo.create({ userId: "user-2", name: "R3", status: "draft", triggerType: "manual", nodes: [], connections: [] });

    const user1Routines = await repo.listByUser("user-1");
    expect(user1Routines).toHaveLength(2);
  });
});
```

### 11.3 Shadow Testing

During migration, write to both Convex and PostgreSQL:

```typescript
// Temporary dual-write middleware
async function createRoutineWithShadow(input: CreateRoutineInput) {
  // Primary: PostgreSQL
  const pgResult = await postgresRepo.create(input);

  // Shadow: Convex (async, non-blocking)
  convexClient.mutation(api.routines.create, input).catch((err) => {
    console.error("Shadow write to Convex failed:", err);
  });

  return pgResult;
}
```

### 11.4 Validation Queries

After migration, verify data integrity:

```sql
-- Compare counts
SELECT 'routines' as table_name, COUNT(*) FROM routines
UNION ALL
SELECT 'executions', COUNT(*) FROM routine_executions
UNION ALL
SELECT 'credentials', COUNT(*) FROM user_credentials;

-- Check for orphaned executions
SELECT e.id FROM routine_executions e
LEFT JOIN routines r ON e.routine_id = r.id
WHERE r.id IS NULL;

-- Verify JSON structure
SELECT id, jsonb_typeof(nodes) as nodes_type
FROM routines
WHERE jsonb_typeof(nodes) != 'array';
```

---

## 12. Rollback Plan

### 12.1 Rollback Triggers

| Trigger | Action |
|---------|--------|
| Data loss detected | Immediate rollback |
| >5% error rate | Investigate, consider rollback |
| Real-time latency >5s | Investigate SSE implementation |
| Auth failures | Rollback auth, keep data migration |

### 12.2 Rollback Steps

1. **Revert DNS/routing** to point to Convex-backed frontend
2. **Sync PostgreSQL → Convex** for any new data created during migration window
3. **Redeploy** previous frontend build
4. **Notify users** if downtime occurred

### 12.3 Data Sync Script

```typescript
// scripts/sync-back-to-convex.ts
async function syncToConvex(since: Date) {
  const db = getDb();

  // Get new/modified routines
  const newRoutines = await db
    .select()
    .from(routines)
    .where(gt(routines.createdAt, since));

  for (const routine of newRoutines) {
    await convexClient.mutation(api.routines.create, {
      // Map PostgreSQL → Convex format
    });
  }
}
```

---

## 13. Migration Phases

### Phase 1: Foundation (Week 1)

- [ ] Create `packages/database` package
- [ ] Define Drizzle schema
- [ ] Set up PostgreSQL instance (Neon/Supabase)
- [ ] Run initial migration
- [ ] Implement repository layer
- [ ] Write repository unit tests

### Phase 2: Backend Migration (Week 2)

- [ ] Set up tRPC router structure
- [ ] Migrate `routines` endpoints
- [ ] Migrate `executions` endpoints
- [ ] Migrate `credentials` endpoints
- [ ] Migrate `settings` endpoints
- [ ] Implement OAuth token exchange route
- [ ] Integration tests for all endpoints

### Phase 3: Real-Time & Workers (Week 3)

- [ ] Implement SSE endpoint for executions
- [ ] Create `useExecutionStream` hook
- [ ] Update Temporal workers to use Drizzle
- [ ] Test full execution flow
- [ ] Verify node state updates in real-time

### Phase 4: Frontend Migration (Week 4)

- [ ] Set up tRPC provider
- [ ] Migrate routines pages
- [ ] Migrate credentials page
- [ ] Migrate settings
- [ ] Migrate execution history drawer
- [ ] E2E tests for critical flows

### Phase 5: Auth & Data Migration (Week 5)

- [ ] Configure Better Auth with Drizzle adapter
- [ ] Test login/signup flows
- [ ] Export data from Convex
- [ ] Import data to PostgreSQL
- [ ] Verify data integrity
- [ ] Shadow testing (dual writes)

### Phase 6: Launch (Week 6)

- [ ] Final integration testing
- [ ] Performance benchmarks
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Production deployment
- [ ] Monitor error rates
- [ ] Sunset Convex (after 2-week buffer)

---

## Appendix A: Dependency Updates

### New Dependencies

```json
{
  "dependencies": {
    "drizzle-orm": "^0.29.0",
    "pg": "^8.11.0",
    "@trpc/server": "^10.45.0",
    "@trpc/client": "^10.45.0",
    "@trpc/react-query": "^10.45.0",
    "@tanstack/react-query": "^5.0.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0",
    "@types/pg": "^8.10.0"
  }
}
```

### Removed Dependencies

```json
{
  "dependencies": {
    "convex": "remove",
    "@convex-dev/better-auth": "remove"
  }
}
```

---

## Appendix B: Quick Reference

### Convex → Drizzle Query Mapping

| Convex | Drizzle |
|--------|---------|
| `ctx.db.query("routines").filter(...)` | `db.select().from(routines).where(...)` |
| `ctx.db.get(id)` | `db.select().from(table).where(eq(table.id, id))` |
| `ctx.db.insert("routines", data)` | `db.insert(routines).values(data)` |
| `ctx.db.patch(id, data)` | `db.update(table).set(data).where(eq(table.id, id))` |
| `ctx.db.delete(id)` | `db.delete(table).where(eq(table.id, id))` |

### Convex → tRPC Hook Mapping

| Convex | tRPC |
|--------|------|
| `useQuery(api.routines.list)` | `trpc.routines.list.useQuery()` |
| `useMutation(api.routines.create)` | `trpc.routines.create.useMutation()` |
| `useAction(api.oauth.exchange)` | `trpc.oauth.exchange.useMutation()` |
| `"skip"` conditional | `{ enabled: false }` option |

---

## Appendix C: Checklist

### Pre-Migration

- [ ] Backup Convex data
- [ ] Document current API contracts
- [ ] Set up PostgreSQL instance
- [ ] Configure connection pooling
- [ ] Set up monitoring (error tracking, latency)

### During Migration

- [ ] Feature freeze on Convex functions
- [ ] Dual-write enabled
- [ ] Monitor error rates
- [ ] Verify real-time functionality

### Post-Migration

- [ ] Remove Convex dependencies
- [ ] Delete `apps/server/convex/` directory
- [ ] Update documentation
- [ ] Archive Convex project
- [ ] Update CI/CD pipelines
