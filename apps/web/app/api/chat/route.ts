// @ts-nocheck
import { streamText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@kianax/server/convex/_generated/api";
import { getToken } from "@kianax/web/lib/auth-server";
import type { Id } from "@kianax/server/convex/_generated/dataModel";

// Initialize Convex client
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convex = new ConvexHttpClient(convexUrl);
const siteUrl = process.env.SITE_URL || "http://localhost:3000";

export async function POST(req: Request) {
  // 1. Authenticate user
  const token = await getToken();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  convex.setAuth(token);

  const { messages } = await req.json();

  const result = await streamText({
    model: openai("gpt-4o"),
    messages,
    tools: {
      searchRoutines: tool({
        description: "Search for existing routines by name or description.",
        parameters: z.object({
          query: z.string().describe("The search query text"),
        }),
        execute: async ({ query }) => {
          try {
            const routines = await convex.query(api.routines.search, {
              query,
            });
            return {
              routines: routines.map((r) => ({
                id: r._id,
                name: r.name,
                description: r.description,
              })),
            };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      }),

      createRoutine: tool({
        description: "Create a new empty routine.",
        parameters: z.object({
          name: z.string().describe("Name of the routine"),
          description: z.string().optional().describe("Description"),
        }),
        execute: async ({ name, description }) => {
          try {
            const routineId = await convex.mutation(api.routines.create, {
              name,
              description,
              status: "draft",
              triggerType: "manual",
              nodes: [],
              connections: [],
            });
            return { routineId, message: `Routine '${name}' created.` };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      }),

      addNode: tool({
        description: "Add a processing node to a routine.",
        parameters: z.object({
          routineId: z.string().describe("The ID of the routine"),
          pluginId: z
            .enum([
              "static-data",
              "mock-weather",
              "if-else",
              "ai-transformer",
              "loop-control",
              "http-request",
              "email",
              "stock-price",
            ])
            .describe("The type of plugin to add"),
          label: z.string().describe("Label for the node"),
          x: z.number().default(100).describe("X position"),
          y: z.number().default(100).describe("Y position"),
          config: z
            .record(z.unknown())
            .optional()
            .describe("Configuration object"),
        }),
        execute: async ({ routineId, pluginId, label, x, y, config }) => {
          try {
            const nodeId = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await convex.mutation(api.routines.addNode, {
              routineId: routineId as Id<"routines">,
              node: {
                id: nodeId,
                pluginId,
                label,
                position: { x, y },
                config: config || {},
                enabled: true,
              },
            });
            return { nodeId, message: `Added ${label} node.` };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      }),

      addConnection: tool({
        description: "Connect two nodes in a routine.",
        parameters: z.object({
          routineId: z.string().describe("The ID of the routine"),
          sourceNodeId: z.string(),
          targetNodeId: z.string(),
          sourceHandle: z.string().optional(),
          targetHandle: z.string().optional(),
        }),
        execute: async ({
          routineId,
          sourceNodeId,
          targetNodeId,
          sourceHandle,
          targetHandle,
        }) => {
          try {
            const connectionId = `edge-${Date.now()}`;
            await convex.mutation(api.routines.addConnection, {
              routineId: routineId as Id<"routines">,
              connection: {
                id: connectionId,
                sourceNodeId,
                targetNodeId,
                sourceHandle,
                targetHandle,
              },
            });
            return { connectionId, message: "Nodes connected." };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      }),

      runRoutine: tool({
        description: "Execute/Test run a routine.",
        parameters: z.object({
          routineId: z.string().describe("The ID of the routine to run"),
        }),
        execute: async ({ routineId }) => {
          try {
            // Call the Next.js API endpoint for execution
            // Use internal fetch to localhost
            const _response = await fetch(
              `${siteUrl}/api/workflows/${routineId}/execute`,
              {
                method: "POST",
                headers: {
                  // Forward the auth token if possible?
                  // But I don't have the raw cookie here easily to forward.
                  // Wait, `getToken` reads from cookies.
                  // If `api/chat` is called from browser, it has cookies.
                  // But `fetch` inside `api/chat` does NOT forward cookies automatically.
                  // I need to manually forward the cookie header from `req` to the fetch.
                  // `headers: req.headers`?
                  // Yes, `headers: req.headers` is the best way to forward auth.
                },
              },
            );
            // Actually, let's just try without forwarding first. `getToken` on the *called* API route might fail if no cookies.
            // I must forward headers.
            const _headers = new Headers(req.headers);
            // Remove host/content-length to avoid issues? Or just copy `cookie`.
            const cookie = req.headers.get("cookie");
            const fetchHeaders: HeadersInit = {};
            if (cookie) fetchHeaders.cookie = cookie;

            const executeResponse = await fetch(
              `${siteUrl}/api/workflows/${routineId}/execute`,
              {
                method: "POST",
                headers: fetchHeaders,
              },
            );

            const data = await executeResponse.json();
            if (!executeResponse.ok)
              throw new Error(data.error || "Execution failed");
            return {
              executionId: data.workflowId,
              message: "Routine execution started.",
            };
          } catch (error: any) {
            return { error: error.message };
          }
        },
      }),
    },
  });

  return result.toTextStreamResponse();
}
