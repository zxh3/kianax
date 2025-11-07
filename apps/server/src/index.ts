import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { healthRoutes } from "./routes/health.js";
import { exampleRoutes } from "./routes/example.js";

const fastify = Fastify({
  logger:
    process.env.NODE_ENV === "production"
      ? true
      : {
          level: process.env.LOG_LEVEL || "info",
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
        },
});

// Register plugins
await fastify.register(helmet, {
  contentSecurityPolicy: false,
});

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
});

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Register routes
await fastify.register(healthRoutes, { prefix: "/health" });
await fastify.register(exampleRoutes, { prefix: "/api" });

// Global error handler
fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);

  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  reply.status(statusCode).send({
    error: {
      message,
      statusCode,
    },
  });
});

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || "0.0.0.0";

    await fastify.listen({ port, host });

    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
