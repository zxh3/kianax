# Microservices Architecture Guide for Kianax

This guide outlines the microservices architecture for Kianax, including service boundaries, communication patterns, and migration strategy from monolith.

## Table of Contents

- [Why Microservices](#why-microservices)
- [Service Architecture](#service-architecture)
- [Service Descriptions](#service-descriptions)
- [Inter-Service Communication](#inter-service-communication)
- [Data Management](#data-management)
- [Migration Strategy](#migration-strategy)
- [API Gateway Pattern](#api-gateway-pattern)
- [Service Mesh](#service-mesh)
- [Best Practices](#best-practices)

## Why Microservices

### Benefits for Kianax

1. **Independent Scaling**
   - Scale AI agent execution separately from trading operations
   - Scale market data service based on user activity
   - Cost optimization (scale only what needs it)

2. **Technology Flexibility**
   - Use Python for ML/AI services (agents, information retrieval)
   - Use Rust for high-performance trading engine (future)
   - Use Node.js/Bun for API and WebSocket services

3. **Team Autonomy**
   - Teams can deploy services independently
   - Reduced coordination overhead
   - Faster iteration

4. **Fault Isolation**
   - If notification service crashes, trading still works
   - Agent failures don't affect portfolio viewing
   - Graceful degradation

5. **Specialized Infrastructure**
   - GPU nodes for AI agent execution
   - Memory-optimized nodes for market data caching
   - Spot instances for batch jobs

### Trade-offs

**Complexity:**
- More moving parts (monitoring, deployment, debugging)
- Distributed system challenges (network, latency, failures)
- Requires mature DevOps practices

**When to Use Microservices:**
- ✅ Team size > 5-10 engineers
- ✅ Need independent scaling
- ✅ Different tech stacks make sense
- ✅ Complex domain with clear boundaries

**When to Stay Monolith:**
- ❌ Team size < 5 engineers
- ❌ Early stage (pre-product-market fit)
- ❌ Unclear domain boundaries
- ❌ Simple CRUD application

**For Kianax:** Microservices make sense because:
- AI agents have different resource needs than API
- Market data caching benefits from specialized service
- Information retrieval (RAG) requires different tech stack
- Clear domain boundaries (trading, agents, notifications)

## Service Architecture

### Target Architecture (Post-Migration)

```
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (Fastify)     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Trading Svc   │ │  Agent Svc   │ │  Market Data │
    │ (Orders,      │ │  (AI Exec)   │ │  Service     │
    │  Portfolio)   │ │              │ │  (Polygon)   │
    └───────────────┘ └──────────────┘ └──────────────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Notification  │ │ Info Retrieval│ │  Scheduler   │
    │ Service       │ │ Service (RAG) │ │  Service     │
    │ (WebSocket)   │ │  (Embeddings) │ │  (Triggers)  │
    └───────────────┘ └──────────────┘ └──────────────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Shared Data   │
                    │  (PostgreSQL,   │
                    │     Redis)      │
                    └─────────────────┘
```

### Service Boundaries

Services are organized by **business capability** (DDD bounded contexts):

1. **API Gateway**: Entry point, routing, authentication
2. **Trading Service**: Orders, executions, portfolio management
3. **Agent Service**: AI agent execution, LLM calls
4. **Market Data Service**: Real-time and historical data from Polygon.io
5. **Information Retrieval Service**: RAG, embeddings, semantic search
6. **Notification Service**: WebSocket, email, push notifications
7. **Scheduler Service**: Cron jobs, time-based triggers, event triggers

## Service Descriptions

### 1. API Gateway

**Responsibility:** Main entry point for all client requests.

**Technology:** Fastify (Node.js/Bun)

**Key Functions:**
- Authentication and authorization (JWT validation)
- Request routing to appropriate services
- Rate limiting (per user)
- Response aggregation (if needed)
- CORS handling
- API versioning

**Endpoints:**
```
POST   /auth/register
POST   /auth/login
GET    /users/me

# Proxied to trading service
GET    /portfolio
POST   /orders
GET    /orders/:id

# Proxied to agent service
GET    /agents
POST   /agents
POST   /agents/:id/execute

# Proxied to market data service
GET    /market/quotes/:symbol
GET    /market/history/:symbol
```

**Communication:**
- Receives HTTP requests from clients
- Makes HTTP calls to downstream services
- Uses gRPC for high-performance internal communication (optional)

**Deployment:**
- Replicas: 3-5 (based on traffic)
- Resources: 0.5 CPU, 512MB RAM per pod
- Autoscaling: Based on CPU and request rate

---

### 2. Trading Service

**Responsibility:** Manage portfolios, orders, and trade execution.

**Technology:** Fastify (Node.js/Bun) or Go (for performance)

**Key Functions:**
- Portfolio management (holdings, cash balance, P&L)
- Order placement and management
- Integration with Alpaca broker API
- Trade execution and confirmation
- Position tracking
- Risk checks (balance, position limits)

**Endpoints:**
```
GET    /portfolio
GET    /positions
POST   /orders
GET    /orders
GET    /orders/:id
DELETE /orders/:id (cancel)
GET    /trades
```

**Database Tables (Owned):**
- `portfolios` (user_id, cash_balance, total_value)
- `positions` (user_id, symbol, quantity, avg_cost, current_price)
- `orders` (user_id, symbol, side, quantity, status, broker_order_id)
- `trades` (user_id, order_id, symbol, quantity, price, timestamp)

**External Integrations:**
- Alpaca API (order execution)
- Market Data Service (price updates)
- Notification Service (order confirmations)

**Events Published:**
- `order.created`
- `order.filled`
- `order.cancelled`
- `portfolio.updated`

**Deployment:**
- Replicas: 2-4
- Resources: 0.5 CPU, 512MB RAM
- Autoscaling: Based on CPU

---

### 3. Agent Service

**Responsibility:** Execute AI trading agents with LLM integration.

**Technology:** Python (for ML libraries) or Node.js (for simplicity)

**Key Functions:**
- Agent execution (on trigger)
- LLM integration (OpenAI GPT-4, Anthropic Claude)
- Strategy interpretation from natural language
- Decision making (buy/sell/hold)
- Risk limit enforcement
- Execution logging and reasoning

**Endpoints:**
```
POST   /agents/execute    # Execute agent (called by scheduler)
POST   /agents/preview    # Dry-run agent (for testing)
```

**Agent Execution Flow:**
1. Receive execution request (from scheduler or manual trigger)
2. Fetch user context (portfolio, positions, risk limits)
3. Fetch market context (prices, news, technical indicators)
4. Build prompt for LLM
5. Call LLM API (GPT-4 or Claude)
6. Parse LLM response (JSON structured output)
7. Validate decision against risk limits
8. Submit order to Trading Service
9. Log execution and reasoning

**Database Tables (Owned):**
- `agents` (user_id, name, strategy, risk_limits, status)
- `agent_executions` (user_id, agent_id, context, decision, reasoning, timestamp)

**External Integrations:**
- OpenAI API (GPT-4)
- Anthropic API (Claude)
- Market Data Service (context)
- Trading Service (order submission)

**Events Published:**
- `agent.executed`
- `agent.decision_made`

**Deployment:**
- Replicas: 1-3 (can scale to 0 if no executions)
- Resources: 1 CPU, 1GB RAM (higher for LLM processing)
- Job-based execution (Kubernetes Jobs or Lambda)
- Consider GPU nodes for future ML models

---

### 4. Market Data Service

**Responsibility:** Provide real-time and historical market data.

**Technology:** Fastify (Node.js/Bun) or Go

**Key Functions:**
- Integrate with Polygon.io API
- Cache market data in Redis (reduce API costs)
- WebSocket connection to Polygon.io for real-time quotes
- Historical data fetching (candles, bars)
- Technical indicators calculation (SMA, RSI, MACD)
- News fetching and caching

**Endpoints:**
```
GET    /quotes/:symbol           # Latest quote
GET    /quotes/batch             # Multiple symbols
GET    /history/:symbol          # Historical data
GET    /indicators/:symbol/sma   # Technical indicators
GET    /news/:symbol             # Recent news
WS     /stream                   # WebSocket for real-time quotes
```

**Caching Strategy:**
- Quotes: 1-second TTL (near real-time)
- Historical data: 1-hour TTL (immutable once day closes)
- News: 5-minute TTL

**External Integrations:**
- Polygon.io REST API
- Polygon.io WebSocket API

**Events Published:**
- `quote.updated` (via Redis pub/sub)
- `market.opened`
- `market.closed`

**Deployment:**
- Replicas: 2-3
- Resources: 0.5 CPU, 1GB RAM (memory for caching)
- Redis sidecar or ElastiCache
- Autoscaling: Based on request rate

---

### 5. Information Retrieval Service (RAG)

**Responsibility:** Semantic search, embeddings, RAG for agent context.

**Technology:** Python (for ML libraries) + FastAPI

**Key Functions:**
- Generate embeddings for text (news, filings, reports)
- Store embeddings in vector database (Pinecone, Weaviate, pgvector)
- Semantic search for relevant information
- RAG (Retrieval Augmented Generation) for agent context
- Summarization of long documents
- Entity extraction (companies, people, events)

**Endpoints:**
```
POST   /embeddings           # Generate embeddings
POST   /search              # Semantic search
POST   /rag                 # RAG query
POST   /summarize           # Summarize document
```

**Use Cases:**
- Agent asks: "What's the recent sentiment around TSLA?"
- Service fetches relevant news, generates summary
- Agent uses summary to make trading decision

**Database Tables (Owned):**
- `documents` (id, source, content, embedding, metadata)
- `embeddings_cache` (text_hash, embedding)

**External Integrations:**
- OpenAI Embeddings API
- Pinecone or pgvector
- News APIs (Finnhub, NewsAPI)

**Deployment:**
- Replicas: 1-2 (can scale to 0 if unused)
- Resources: 1 CPU, 2GB RAM
- Consider GPU nodes for embedding generation

---

### 6. Notification Service

**Responsibility:** Real-time notifications to users.

**Technology:** Fastify (Node.js/Bun) with Socket.io

**Key Functions:**
- WebSocket server for real-time updates
- Email notifications (via SendGrid, AWS SES)
- Push notifications (via Firebase Cloud Messaging)
- SMS notifications (via Twilio)
- Notification preferences management

**Endpoints:**
```
WS     /ws                   # WebSocket connection
POST   /notifications        # Send notification
GET    /notifications        # User's notifications
PUT    /preferences          # Update preferences
```

**WebSocket Events (to clients):**
- `quote` - Real-time price updates
- `order_filled` - Order execution confirmation
- `portfolio_update` - Balance/holdings change
- `agent_executed` - Agent activity notification
- `alert` - Price alerts, news alerts

**Event Subscriptions (from other services):**
- `order.filled` → Send notification
- `agent.executed` → Send notification
- `quote.updated` → Broadcast to subscribed users

**Deployment:**
- Replicas: 2-5 (based on concurrent connections)
- Resources: 0.5 CPU, 512MB RAM
- Sticky sessions required (ALB with sticky sessions)
- Redis for pub/sub across instances

---

### 7. Scheduler Service

**Responsibility:** Trigger time-based and event-based actions.

**Technology:** Fastify (Node.js/Bun) with cron library

**Key Functions:**
- Schedule agent executions (time-based triggers)
- Price-based triggers (execute agent when TSLA > $200)
- News-based triggers (execute on earnings reports)
- Market open/close triggers
- Periodic tasks (portfolio rebalancing, data sync)

**Database Tables (Owned):**
- `triggers` (user_id, agent_id, type, config, status)
- `schedules` (trigger_id, next_run, last_run)

**Trigger Types:**
1. **Time-based**: "Every day at 9:35 AM"
2. **Price-based**: "When AAPL > $150"
3. **News-based**: "On earnings report for TSLA"
4. **Market event**: "15 minutes after market open"

**Events Published:**
- `trigger.fired`

**Deployment:**
- Replicas: 1 (leader election for cron jobs)
- Resources: 0.25 CPU, 256MB RAM
- Kubernetes CronJob for periodic tasks

---

## Inter-Service Communication

### Synchronous Communication (HTTP/gRPC)

**Use when:**
- Request-response pattern needed
- Immediate response required
- Client needs result to continue

**Example:**
```
API Gateway → Trading Service (GET /portfolio)
Agent Service → Market Data Service (GET /quotes/AAPL)
```

**Implementation:**
```typescript
// API Gateway calls Trading Service
const response = await fetch('http://trading-service.kianax.svc.cluster.local:3002/portfolio', {
  headers: {
    'Authorization': req.headers.authorization,
    'X-User-ID': req.user.id,
  }
});
const portfolio = await response.json();
```

### Asynchronous Communication (Events)

**Use when:**
- Fire-and-forget
- Multiple consumers need the same event
- Temporal decoupling desired

**Example:**
```
Trading Service publishes "order.filled"
  → Notification Service sends notification
  → Agent Service logs result
  → Scheduler Service updates trigger
```

**Implementation Options:**

**Option 1: Redis Pub/Sub** (Simple, low latency)
```typescript
// Trading Service publishes event
await redis.publish('events:orders', JSON.stringify({
  type: 'order.filled',
  user_id: order.user_id,
  order_id: order.id,
  symbol: order.symbol,
  quantity: order.quantity,
}));

// Notification Service subscribes
await redis.subscribe('events:orders');
redis.on('message', async (channel, message) => {
  const event = JSON.parse(message);
  if (event.type === 'order.filled') {
    await sendNotification(event);
  }
});
```

**Option 2: AWS SNS/SQS** (Durable, scalable)
```typescript
// Trading Service publishes to SNS topic
await sns.publish({
  TopicArn: 'arn:aws:sns:us-east-1:ACCOUNT:order-events',
  Message: JSON.stringify(event),
});

// Notification Service polls SQS queue
const messages = await sqs.receiveMessage({
  QueueUrl: 'https://sqs.us-east-1.amazonaws.com/ACCOUNT/order-notifications',
});
```

**Option 3: Kafka** (High throughput, event sourcing)
- Overkill for Kianax initially
- Consider for future scale (10,000+ orders/day)

### Service Discovery

Services discover each other via **Kubernetes DNS**:

```
Trading Service: trading-service.kianax.svc.cluster.local:3002
Agent Service: agent-service.kianax.svc.cluster.local:3003
Market Data Service: market-data-service.kianax.svc.cluster.local:3004
```

No need for external service mesh initially (keep it simple).

## Data Management

### Database Per Service Pattern

Each service owns its data (loose coupling).

```
Trading Service → trading_db schema
  - portfolios
  - positions
  - orders
  - trades

Agent Service → agent_db schema
  - agents
  - agent_executions
  - triggers (if not separate scheduler)

Market Data Service → market_data_db schema (optional)
  - quotes_cache
  - historical_data
```

**Implementation:**

**Option 1: Schemas in single PostgreSQL database**
```sql
-- Trading Service tables
CREATE SCHEMA trading;
CREATE TABLE trading.portfolios (...);
CREATE TABLE trading.orders (...);

-- Agent Service tables
CREATE SCHEMA agents;
CREATE TABLE agents.agents (...);
CREATE TABLE agents.executions (...);
```

**Option 2: Separate databases**
- More isolation
- Independent scaling
- Higher complexity

**For Kianax:** Start with Option 1 (schemas), migrate to Option 2 if needed.

### Shared Data

Some data is read by multiple services:

- **Users**: Shared read-only (owned by Auth Service or API Gateway)
- **Market Data**: Cached in Redis (owned by Market Data Service)

### Transactions Across Services

**Problem:** User places order, agent execution must be logged atomically.

**Solutions:**

**Option 1: Saga Pattern** (choreography)
```
1. Trading Service creates order → publishes "order.created"
2. Agent Service listens → logs execution
3. If Agent Service fails → Trading Service compensates (cancels order)
```

**Option 2: Two-Phase Commit** (avoid if possible, complex)

**Option 3: Eventually Consistent** (accept temporary inconsistency)
- Order created immediately
- Agent execution logged asynchronously
- Retry on failure

**For Kianax:** Use Option 3 (eventually consistent) for most cases.

## Migration Strategy

### Phase 1: Monolith (Current)

```
apps/server (Fastify app)
  ├── routes/
  │   ├── auth.ts
  │   ├── portfolio.ts
  │   ├── orders.ts
  │   ├── agents.ts
  │   └── market.ts
  └── services/
      ├── tradingService.ts
      ├── agentService.ts
      └── marketDataService.ts
```

**Timeline:** Phase 0-4 (Weeks 1-6)

---

### Phase 2: Extract Market Data Service

**Why first?** Clear boundary, external dependency, no complex state.

**Steps:**
1. Create `services/market-data-service/` directory
2. Extract market data logic from `apps/server`
3. Create HTTP API for market data
4. Deploy as separate K8s deployment
5. Update API Gateway to call Market Data Service

**Timeline:** Week 7-8 (Phase 5)

**Rollback:** Keep old code, route traffic back to monolith

---

### Phase 3: Extract Agent Service

**Why second?** Independent execution, can scale separately.

**Steps:**
1. Create `services/agent-service/` directory
2. Extract agent execution logic
3. Create HTTP API for agent operations
4. Deploy as Kubernetes Jobs (triggered by API)
5. Update API Gateway to call Agent Service

**Timeline:** Week 9-10 (Phase 6)

---

### Phase 4: Extract Notification Service

**Why third?** WebSocket needs separate deployment anyway.

**Steps:**
1. Create `services/notification-service/` directory
2. Extract WebSocket server and notification logic
3. Deploy with sticky sessions
4. Update API Gateway to route WebSocket to Notification Service

**Timeline:** Week 11-12 (Phase 7)

---

### Phase 5: Extract Trading Service

**Why fourth?** Core business logic, more complex to extract.

**Steps:**
1. Create `services/trading-service/` directory
2. Extract order and portfolio logic
3. Migrate database tables (or use schema separation)
4. Deploy as separate service
5. Update API Gateway to route trading requests

**Timeline:** Week 13-14 (Phase 8)

---

### Phase 6: Extract Scheduler and Info Retrieval

**Why last?** New features, build as microservices from start.

**Timeline:** Week 15+ (Phase 9-10)

---

### Final Architecture (Post-Migration)

```
services/
├── api-gateway/           # Entry point
├── trading-service/       # Orders, portfolio
├── agent-service/         # AI execution
├── market-data-service/   # Polygon.io integration
├── notification-service/  # WebSocket, email
├── scheduler-service/     # Triggers, cron
└── info-retrieval-service/  # RAG, embeddings
```

## API Gateway Pattern

### Responsibilities

1. **Authentication:** Validate JWT tokens
2. **Authorization:** Check user permissions
3. **Routing:** Forward requests to appropriate services
4. **Rate Limiting:** Enforce per-user limits
5. **Response Aggregation:** Combine responses from multiple services (optional)

### Example Implementation

```typescript
// api-gateway/src/routes/orders.ts
import fastify from 'fastify';

fastify.get('/orders', {
  preHandler: authenticate, // JWT validation
}, async (request, reply) => {
  // Check rate limit
  const allowed = await rateLimiter.check(request.user.id);
  if (!allowed) {
    return reply.code(429).send({ error: 'Rate limit exceeded' });
  }

  // Forward to Trading Service
  const response = await fetch('http://trading-service.kianax.svc.cluster.local:3002/orders', {
    headers: {
      'X-User-ID': request.user.id,
      'Authorization': request.headers.authorization,
    }
  });

  return response.json();
});
```

### Response Aggregation Example

```typescript
// Get portfolio with enriched market data
fastify.get('/portfolio/enriched', async (request, reply) => {
  // Parallel requests
  const [portfolio, quotes] = await Promise.all([
    fetch('http://trading-service:3002/portfolio', {
      headers: { 'X-User-ID': request.user.id }
    }).then(r => r.json()),

    fetch('http://market-data-service:3004/quotes/batch', {
      method: 'POST',
      body: JSON.stringify({ symbols: ['AAPL', 'TSLA', 'MSFT'] }),
    }).then(r => r.json()),
  ]);

  // Combine responses
  return {
    ...portfolio,
    positions: portfolio.positions.map(pos => ({
      ...pos,
      current_price: quotes[pos.symbol]?.price,
      change_percent: quotes[pos.symbol]?.change_percent,
    })),
  };
});
```

## Service Mesh

### Do You Need a Service Mesh?

**Service Mesh** (like Istio, Linkerd) provides:
- Automatic mutual TLS
- Traffic management (retries, timeouts, circuit breakers)
- Observability (metrics, tracing)
- Load balancing

**For Kianax:**
- **Start without service mesh** (YAGNI - You Aren't Gonna Need It)
- Use native K8s features (Services, Ingress, NetworkPolicies)
- Add service mesh later if needed (1000+ req/sec, complex routing)

**When to add service mesh:**
- Traffic management complexity increases
- Need canary deployments (gradual rollouts)
- Security requirements increase (mTLS everywhere)
- Team size > 20 engineers

## Best Practices

### 1. Design for Failure

Services will fail. Design for resilience.

```typescript
// Circuit breaker pattern
const breaker = new CircuitBreaker(async () => {
  return await fetch('http://market-data-service:3004/quotes/AAPL');
}, {
  timeout: 5000,        // Timeout after 5s
  errorThreshold: 50,   // Open circuit after 50% errors
  resetTimeout: 30000,  // Try again after 30s
});

try {
  const quote = await breaker.fire();
} catch (err) {
  // Fallback: return cached quote or error
  return cachedQuote || { error: 'Service unavailable' };
}
```

### 2. Implement Health Checks

Every service must have `/health` endpoint.

```typescript
fastify.get('/health', async (request, reply) => {
  // Check dependencies
  const dbHealthy = await checkDatabase();
  const redisHealthy = await checkRedis();

  if (dbHealthy && redisHealthy) {
    return { status: 'ok', timestamp: new Date() };
  } else {
    reply.code(503);
    return { status: 'degraded', db: dbHealthy, redis: redisHealthy };
  }
});
```

### 3. Use Structured Logging

Include correlation IDs to trace requests across services.

```typescript
import pino from 'pino';

const logger = pino();

fastify.addHook('onRequest', (request, reply, done) => {
  request.log = logger.child({
    request_id: request.id,
    user_id: request.user?.id,
    service: 'trading-service',
  });
  done();
});

// In route handler
request.log.info({ order_id: order.id }, 'Order created');
```

Forward correlation ID to downstream services:

```typescript
await fetch('http://trading-service:3002/orders', {
  headers: {
    'X-Request-ID': request.id,
    'X-User-ID': request.user.id,
  }
});
```

### 4. Implement Retries with Backoff

```typescript
import pRetry from 'p-retry';

const quote = await pRetry(
  () => fetch('http://market-data-service:3004/quotes/AAPL'),
  {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 5000,
    onFailedAttempt: (error) => {
      console.log(`Attempt ${error.attemptNumber} failed. Retrying...`);
    },
  }
);
```

### 5. Version Your APIs

```typescript
// v1 API
fastify.register(
  (fastify, opts, done) => {
    fastify.get('/orders', handlerV1);
    done();
  },
  { prefix: '/v1' }
);

// v2 API (with breaking changes)
fastify.register(
  (fastify, opts, done) => {
    fastify.get('/orders', handlerV2);
    done();
  },
  { prefix: '/v2' }
);
```

### 6. Document Your APIs

Use OpenAPI/Swagger:

```typescript
import fastifySwagger from '@fastify/swagger';

fastify.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Kianax Trading Service API',
      version: '1.0.0',
    },
  },
});

// Document route
fastify.get('/orders', {
  schema: {
    description: 'Get user orders',
    tags: ['orders'],
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            symbol: { type: 'string' },
            quantity: { type: 'number' },
          },
        },
      },
    },
  },
}, handler);
```

### 7. Monitor Service Dependencies

Track upstream service health:

```typescript
// Prometheus metrics
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['service', 'endpoint', 'status'],
});

// Track dependency calls
const start = Date.now();
try {
  const response = await fetch('http://trading-service:3002/orders');
  httpRequestDuration.labels('trading-service', '/orders', '200').observe((Date.now() - start) / 1000);
} catch (err) {
  httpRequestDuration.labels('trading-service', '/orders', 'error').observe((Date.now() - start) / 1000);
}
```

### 8. Use Feature Flags

Gradual rollout of new features:

```typescript
import { LaunchDarkly } from 'launchdarkly-node-server-sdk';

const ldClient = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY);

// Check feature flag
const useNewAgentEngine = await ldClient.variation('new-agent-engine', {
  key: request.user.id,
}, false);

if (useNewAgentEngine) {
  return await newAgentService.execute(agent);
} else {
  return await legacyAgentService.execute(agent);
}
```

## Summary

**Microservices Architecture:**
- 7 services: API Gateway, Trading, Agent, Market Data, Info Retrieval, Notification, Scheduler
- Organized by business capability (DDD bounded contexts)
- Independent deployment and scaling
- Event-driven communication (Redis pub/sub)

**Migration Path:**
1. Start with monolith (Phase 1-4)
2. Extract Market Data Service (Phase 5)
3. Extract Agent Service (Phase 6)
4. Extract Notification Service (Phase 7)
5. Extract Trading Service (Phase 8)
6. Build new services as microservices (Phase 9-10)

**Key Principles:**
- Design for failure (circuit breakers, retries)
- Health checks everywhere
- Structured logging with correlation IDs
- API versioning
- Monitoring and observability

**Start Simple:**
- Don't add service mesh initially
- Use K8s Services for discovery
- Use Redis pub/sub for events
- Add complexity only when needed

---

For deployment procedures, see [DEPLOYMENT.md](./DEPLOYMENT.md).
For Kubernetes operations, see [KUBERNETES.md](./KUBERNETES.md).
For local development, see [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md).
