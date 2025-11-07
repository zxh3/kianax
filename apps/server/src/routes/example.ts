import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function exampleRoutes(fastify: FastifyInstance) {
  // GET /api/items
  fastify.get("/items", async (_request, _reply) => {
    return {
      items: [
        { id: 1, name: "Item 1", description: "First item" },
        { id: 2, name: "Item 2", description: "Second item" },
      ],
    };
  });

  // GET /api/items/:id
  fastify.get<{ Params: { id: string } }>(
    "/items/:id",
    async (request, _reply) => {
      const { id } = request.params;

      // Simulate item lookup
      const item = {
        id: Number(id),
        name: `Item ${id}`,
        description: `Description for item ${id}`,
      };

      return item;
    },
  );

  // POST /api/items
  fastify.post<{ Body: z.infer<typeof createItemSchema> }>(
    "/items",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1 },
            description: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      // Validate with Zod
      const result = createItemSchema.safeParse(request.body);

      if (!result.success) {
        reply.status(400).send({
          error: "Validation failed",
          details: z.prettifyError(result.error),
        });
        return;
      }

      const newItem = {
        id: Math.floor(Math.random() * 1000),
        ...result.data,
        createdAt: new Date().toISOString(),
      };

      reply.status(201).send(newItem);
    },
  );
}
