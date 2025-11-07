// Reference schema for Drizzle ORM patterns
// This shows common patterns used in this project

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// Example: Define enums for type safety
export const todoStatusEnum = pgEnum("todo_status", [
  "pending",
  "in_progress",
  "completed",
]);

export const todoPriorityEnum = pgEnum("todo_priority", [
  "low",
  "medium",
  "high",
]);

// Example: Table definition with common patterns
export const todos = pgTable("todos", {
  // Primary key - UUID with auto-generation
  id: uuid("id").primaryKey().defaultRandom(),

  // Foreign key reference (would reference users table)
  // user_id: uuid("user_id")
  //   .notNull()
  //   .references(() => users.id, { onDelete: "cascade" }),

  // String fields with length constraints
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),

  // Enum fields
  status: todoStatusEnum("status").notNull().default("pending"),
  priority: todoPriorityEnum("priority").notNull().default("medium"),

  // Boolean fields
  is_archived: boolean("is_archived").default(false).notNull(),

  // Numeric fields for counts/scores
  score: integer("score").default(0).notNull(),

  // Decimal fields for money/precise numbers
  estimated_hours: numeric("estimated_hours", {
    precision: 10,
    scale: 2,
  }),

  // JSONB for complex/flexible data
  metadata: jsonb("metadata").$type<{
    tags?: string[];
    attachments?: { name: string; url: string }[];
    custom_fields?: Record<string, unknown>;
  }>(),

  // Timestamps - always include these for audit trail
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  completed_at: timestamp("completed_at"),
});

// Type inference - Drizzle automatically generates types
export type Todo = typeof todos.$inferSelect; // For SELECT queries
export type NewTodo = typeof todos.$inferInsert; // For INSERT operations

// Example usage in application code:
/*
import { db } from '@kianax/db/client';
import { todos } from '@kianax/db/schema';
import { eq } from 'drizzle-orm';

// Insert
const newTodo: NewTodo = {
  title: "Build feature",
  description: "...",
  status: "pending"
};
await db.insert(todos).values(newTodo);

// Select
const allTodos = await db.select().from(todos);

// Select with filter
const userTodos = await db
  .select()
  .from(todos)
  .where(eq(todos.user_id, userId));

// Update
await db
  .update(todos)
  .set({ status: "completed", completed_at: new Date() })
  .where(eq(todos.id, todoId));

// Delete
await db
  .delete(todos)
  .where(eq(todos.id, todoId));
*/
