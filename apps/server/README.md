# @kianax/server

Fastify server for the Kianax platform.

## Features

- **Fastify** - Fast and low overhead web framework
- **TypeScript** - Full type safety
- **CORS** - Configured for cross-origin requests
- **Helmet** - Security headers
- **Rate Limiting** - Request throttling
- **Zod** - Runtime validation
- **Pino** - High-performance logging

## Getting Started

### Install Dependencies

```bash
bun install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Development

```bash
bun run dev
```

Server runs on `http://localhost:3001`

### Build

```bash
bun run build
```

### Production

```bash
bun run start
```

## API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check

### Example Routes

- `GET /api/items` - List all items
- `GET /api/items/:id` - Get item by ID
- `POST /api/items` - Create new item

## Project Structure

```
apps/server/
├── src/
│   ├── routes/          # API route handlers
│   │   ├── health.ts    # Health check endpoints
│   │   └── example.ts   # Example CRUD endpoints
│   ├── plugins/         # Fastify plugins
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── index.ts         # Application entry point
├── .env.example         # Environment variables template
├── package.json
└── tsconfig.json
```

## Adding New Routes

Create a new route file in `src/routes/`:

```typescript
import type { FastifyInstance } from "fastify";

export async function myRoutes(fastify: FastifyInstance) {
  fastify.get("/my-route", async (request, reply) => {
    return { message: "Hello World" };
  });
}
```

Register it in `src/index.ts`:

```typescript
import { myRoutes } from "./routes/my-routes.js";

await fastify.register(myRoutes, { prefix: "/api" });
```

## Type Safety

The API uses TypeScript for full type safety. Define request/response types:

```typescript
interface CreateUserBody {
  name: string;
  email: string;
}

fastify.post<{ Body: CreateUserBody }>("/users", async (request, reply) => {
  const { name, email } = request.body; // Fully typed
  // ...
});
```

## Validation

Use Zod for runtime validation:

```typescript
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const result = schema.safeParse(request.body);
if (!result.success) {
  reply.status(400).send({ error: result.error });
  return;
}
```
