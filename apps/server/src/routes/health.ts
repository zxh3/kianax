import type { FastifyInstance } from "fastify";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  fastify.get("/ready", async (request, reply) => {
    // Add any readiness checks here (database, external services, etc.)
    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  });
}
