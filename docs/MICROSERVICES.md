# Microservices Architecture for Kianax

High-level microservices architecture, service boundaries, and migration strategy.

## Why Microservices

### Benefits for Kianax

1. **Independent Scaling**
   - Scale AI agent execution separately from trading operations
   - Scale market data service based on user activity
   - Cost optimization (scale only what needs it)

2. **Technology Flexibility**
   - Python for ML/AI services (agents, embeddings)
   - Rust for high-performance trading (future)
   - Node.js/Bun for API and WebSocket services

3. **Team Autonomy**
   - Teams deploy services independently
   - Reduced coordination overhead
   - Faster iteration cycles

4. **Fault Isolation**
   - Notification service crash doesn't affect trading
   - Agent failures don't impact portfolio viewing
   - Graceful degradation

5. **Specialized Infrastructure**
   - GPU nodes for AI execution
   - Memory-optimized for caching
   - Spot instances for batch jobs

### Trade-offs

**Complexity:**
- More moving parts (monitoring, deployment, debugging)
- Distributed system challenges (network, latency, failures)
- Requires mature DevOps practices

**When to Use Microservices:**
- ✅ Team size > 5-10 engineers
- ✅ Need independent scaling
- ✅ Different tech stacks beneficial
- ✅ Clear domain boundaries

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

### Target Architecture

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

Services organized by **business capability** (DDD bounded contexts):

1. **API Gateway** - Entry point, routing, authentication
2. **Trading Service** - Orders, executions, portfolio management
3. **Agent Service** - AI agent execution, LLM calls
4. **Market Data Service** - Real-time and historical data
5. **Information Retrieval Service** - RAG, embeddings, semantic search
6. **Notification Service** - WebSocket, email, push notifications
7. **Scheduler Service** - Cron jobs, triggers, events

## Service Descriptions

### 1. API Gateway

**Responsibility:** Main entry point for all client requests

**Technology:** Fastify (Node.js/Bun)

**Key Functions:**
- Authentication and authorization (JWT validation)
- Request routing to appropriate services
- Rate limiting (per user)
- Response aggregation (when needed)
- CORS handling, API versioning

**Deployment:**
- Replicas: 3-5 (based on traffic)
- Resources: 0.5 CPU, 512MB RAM per pod
- Autoscaling: CPU and request rate

---

### 2. Trading Service

**Responsibility:** Manage portfolios, orders, trade execution

**Technology:** Fastify (Node.js/Bun) or Go

**Key Functions:**
- Portfolio management (holdings, cash, P&L)
- Order placement and management
- Alpaca broker API integration
- Trade execution and confirmation
- Position tracking, risk checks

**Database Tables (Owned):**
- portfolios, positions, orders, trades

**External Integrations:**
- Alpaca API
- Market Data Service
- Notification Service

**Events Published:**
- `order.created`, `order.filled`, `order.cancelled`, `portfolio.updated`

**Deployment:**
- Replicas: 2-4
- Resources: 0.5 CPU, 512MB RAM

---

### 3. Agent Service

**Responsibility:** Execute AI trading agents

**Technology:** Python (for ML libraries) or Node.js

**Key Functions:**
- Agent execution (on trigger)
- LLM integration (OpenAI GPT-4, Anthropic Claude)
- Strategy interpretation
- Decision making (buy/sell/hold)
- Risk limit enforcement

**Agent Execution Flow:**
1. Receive execution request
2. Fetch user context (portfolio, positions)
3. Fetch market context (prices, news, indicators)
4. Build LLM prompt
5. Call LLM API
6. Parse decision
7. Validate against risk limits
8. Submit order to Trading Service
9. Log execution and reasoning

**Database Tables (Owned):**
- agents, agent_executions

**Events Published:**
- `agent.executed`, `agent.decision_made`

**Deployment:**
- Replicas: 1-3 (can scale to 0)
- Resources: 1 CPU, 1GB RAM
- Job-based execution (Kubernetes Jobs)
- Consider GPU nodes for future ML models

---

### 4. Market Data Service

**Responsibility:** Provide real-time and historical market data

**Technology:** Fastify (Node.js/Bun) or Go

**Key Functions:**
- Polygon.io API integration
- Redis caching (reduce API costs)
- WebSocket for real-time quotes
- Historical data fetching
- Technical indicators calculation
- News fetching

**Caching Strategy:**
- Quotes: 1-second TTL
- Historical data: 1-hour TTL
- News: 5-minute TTL

**Events Published:**
- `quote.updated`, `market.opened`, `market.closed`

**Deployment:**
- Replicas: 2-3
- Resources: 0.5 CPU, 1GB RAM (memory for caching)
- Redis sidecar or ElastiCache

---

### 5. Information Retrieval Service (RAG)

**Responsibility:** Semantic search, embeddings, RAG

**Technology:** Python + FastAPI

**Key Functions:**
- Generate embeddings for text
- Vector database storage (Pinecone, pgvector)
- Semantic search
- RAG (Retrieval Augmented Generation)
- Document summarization
- Entity extraction

**Use Case Example:**
- Agent asks: "Recent sentiment around TSLA?"
- Service fetches relevant news
- Generates summary for agent decision

**Database Tables (Owned):**
- documents, embeddings_cache

**External Integrations:**
- OpenAI Embeddings API
- Pinecone or pgvector
- News APIs

**Deployment:**
- Replicas: 1-2 (can scale to 0)
- Resources: 1 CPU, 2GB RAM
- Consider GPU for embeddings

---

### 6. Notification Service

**Responsibility:** Real-time notifications to users

**Technology:** Fastify with Socket.io

**Key Functions:**
- WebSocket server for real-time updates
- Email notifications (SendGrid, AWS SES)
- Push notifications (Firebase)
- SMS notifications (Twilio)
- Preference management

**WebSocket Events (to clients):**
- `quote` - Price updates
- `order_filled` - Execution confirmation
- `portfolio_update` - Balance changes
- `agent_executed` - Agent activity
- `alert` - Price/news alerts

**Deployment:**
- Replicas: 2-5 (based on connections)
- Resources: 0.5 CPU, 512MB RAM
- Sticky sessions required (ALB)
- Redis for pub/sub across instances

---

### 7. Scheduler Service

**Responsibility:** Trigger time-based and event-based actions

**Technology:** Fastify with cron library

**Key Functions:**
- Schedule agent executions (time-based)
- Price-based triggers
- News-based triggers
- Market open/close triggers
- Periodic tasks (rebalancing, sync)

**Database Tables (Owned):**
- triggers, schedules

**Trigger Types:**
1. Time-based: "Every day at 9:35 AM"
2. Price-based: "When AAPL > $150"
3. News-based: "On earnings report"
4. Market event: "15 min after market open"

**Deployment:**
- Replicas: 1 (leader election)
- Resources: 0.25 CPU, 256MB RAM
- Kubernetes CronJob for periodic tasks

## Inter-Service Communication

### Synchronous Communication (HTTP/gRPC)

**Use when:**
- Request-response pattern needed
- Immediate response required
- Client needs result to continue

**Examples:**
- API Gateway → Trading Service (GET /portfolio)
- Agent Service → Market Data Service (GET /quotes/AAPL)

**Implementation:**
- HTTP REST calls between services
- Service discovery via Kubernetes DNS
- Optional: gRPC for high-performance internal communication

### Asynchronous Communication (Events)

**Use when:**
- Fire-and-forget
- Multiple consumers need same event
- Temporal decoupling desired

**Examples:**
- Trading Service publishes "order.filled"
  → Notification Service sends notification
  → Agent Service logs result
  → Scheduler Service updates trigger

**Implementation Options:**

**Option 1: Redis Pub/Sub** (Simple, low latency)
- Good for real-time events
- No persistence (messages lost if no consumers)

**Option 2: AWS SNS/SQS** (Durable, scalable)
- Message persistence
- Retry logic built-in
- Higher latency than Redis

**Option 3: Kafka** (High throughput, event sourcing)
- Overkill initially
- Consider for future scale (10,000+ orders/day)

**Recommendation:** Start with Redis Pub/Sub, migrate to SNS/SQS if durability needed.

### Service Discovery

Services discover each other via **Kubernetes DNS**:

```
trading-service.kianax.svc.cluster.local:3002
agent-service.kianax.svc.cluster.local:3003
market-data-service.kianax.svc.cluster.local:3004
```

No external service mesh initially (keep it simple).

## Data Management

### Database Per Service Pattern

Each service owns its data (loose coupling).

**Option 1: Schemas in single PostgreSQL** (Recommended initially)
```
trading schema: portfolios, positions, orders, trades
agents schema: agents, agent_executions
market_data schema: quotes_cache, historical_data
```

**Option 2: Separate databases**
- More isolation
- Independent scaling
- Higher complexity

**For Kianax:** Start with Option 1, migrate to Option 2 if needed.

### Shared Data

Some data is read by multiple services:
- **Users**: Shared read-only (owned by Auth/API Gateway)
- **Market Data**: Cached in Redis (owned by Market Data Service)

### Transactions Across Services

**Problem:** Order placement + agent execution must be atomic.

**Solutions:**

**Option 1: Saga Pattern** (choreography)
- Trading Service creates order → publishes event
- Agent Service listens → logs execution
- Compensation if failure

**Option 2: Eventually Consistent** (Recommended)
- Order created immediately
- Agent execution logged asynchronously
- Retry on failure

**For Kianax:** Use eventually consistent for most cases.

## Migration Strategy

### Phase 1: Monolith (Current)

**Timeline:** Weeks 1-6 (Phase 0-4)

All code in `apps/server`:
- Routes: auth, portfolio, orders, agents, market
- Services: tradingService, agentService, marketDataService

---

### Phase 2: Extract Market Data Service

**Timeline:** Weeks 7-8 (Phase 5)

**Why first?** Clear boundary, external dependency, no complex state.

**Steps:**
1. Create `services/market-data-service/` directory
2. Extract market data logic
3. Create HTTP API
4. Deploy as separate K8s deployment
5. Update API Gateway routing

**Rollback:** Keep old code, route back to monolith if issues.

---

### Phase 3: Extract Agent Service

**Timeline:** Weeks 9-10 (Phase 6)

**Why second?** Independent execution, can scale separately.

**Steps:**
1. Create `services/agent-service/`
2. Extract agent execution logic
3. Create HTTP API
4. Deploy as Kubernetes Jobs
5. Update API Gateway routing

---

### Phase 4: Extract Notification Service

**Timeline:** Weeks 11-12 (Phase 7)

**Why third?** WebSocket needs separate deployment anyway.

**Steps:**
1. Create `services/notification-service/`
2. Extract WebSocket server
3. Deploy with sticky sessions
4. Update WebSocket routing

---

### Phase 5: Extract Trading Service

**Timeline:** Weeks 13-14 (Phase 8)

**Why fourth?** Core business logic, more complex.

**Steps:**
1. Create `services/trading-service/`
2. Extract order and portfolio logic
3. Migrate database tables (or use schemas)
4. Deploy as separate service
5. Update API Gateway routing

---

### Phase 6: Build New Services

**Timeline:** Weeks 15+ (Phase 9-10)

**Scheduler and Info Retrieval:**
- Build as microservices from start
- No extraction needed (new features)

---

### Final Architecture (Post-Migration)

```
services/
├── api-gateway/
├── trading-service/
├── agent-service/
├── market-data-service/
├── notification-service/
├── scheduler-service/
└── info-retrieval-service/
```

## API Gateway Pattern

### Responsibilities

1. **Authentication** - Validate JWT tokens
2. **Authorization** - Check user permissions
3. **Routing** - Forward requests to services
4. **Rate Limiting** - Enforce per-user limits
5. **Response Aggregation** - Combine responses (optional)

### Example: Response Aggregation

**Use case:** Get portfolio with enriched market data

**Implementation:**
1. Parallel requests to Trading Service and Market Data Service
2. Combine responses (add current prices to positions)
3. Return enriched response to client

**Benefits:**
- Fewer client requests
- Lower latency (parallel calls)
- Simpler client logic

## Service Mesh

### Do You Need a Service Mesh?

**Service Mesh** (Istio, Linkerd) provides:
- Automatic mutual TLS
- Traffic management (retries, timeouts, circuit breakers)
- Observability (metrics, tracing)
- Load balancing

**For Kianax:**
- **Start without service mesh** (YAGNI)
- Use native K8s features (Services, Ingress)
- Add service mesh later if needed (1000+ req/sec, complex routing)

**When to add service mesh:**
- Traffic management complexity increases
- Need canary deployments
- Security requirements increase (mTLS everywhere)
- Team size > 20 engineers

## Best Practices

### 1. Design for Failure

Services will fail. Design for resilience.

**Key patterns:**
- Circuit breakers (prevent cascade failures)
- Retries with exponential backoff
- Timeouts (don't wait forever)
- Fallbacks (cached data or degraded response)

### 2. Implement Health Checks

Every service must have `/health` endpoint.

**Check:**
- Database connectivity
- Redis connectivity
- Dependent service health
- Memory/CPU usage

**Kubernetes uses health checks for:**
- Readiness (is service ready for traffic?)
- Liveness (should service be restarted?)

### 3. Use Structured Logging

Include correlation IDs to trace requests across services.

**Key fields:**
- `request_id` - Unique per request
- `user_id` - Who made the request
- `service` - Which service logged
- `timestamp` - When
- `level` - INFO, WARN, ERROR

**Forward correlation ID to downstream services** for end-to-end tracing.

### 4. Implement Retries with Backoff

**Don't retry immediately:**
- Exponential backoff (1s, 2s, 4s, 8s)
- Max retries (3-5 attempts)
- Jitter (randomize slightly to prevent thundering herd)

### 5. Version Your APIs

**Breaking changes require new version:**
- `/v1/orders` - Current version
- `/v2/orders` - New version with breaking changes

**Non-breaking changes can use same version:**
- Add new optional fields (backward compatible)

### 6. Document Your APIs

Use OpenAPI/Swagger:
- Auto-generate from code
- Interactive documentation
- Client SDK generation
- API testing

### 7. Monitor Service Dependencies

Track upstream service health:
- Request duration histogram
- Error rate by service
- Dependency graph visualization
- Alert on high error rates

### 8. Use Feature Flags

Gradual rollout of new features:
- Enable for 10% of users first
- Monitor error rates
- Gradually increase to 50%, 100%
- Roll back instantly if issues

## Summary

**Microservices Architecture:**
- 7 services organized by business capability
- Independent deployment and scaling
- Event-driven communication (Redis pub/sub)
- Eventually consistent data

**Migration Path:**
1. Start with monolith (Phase 1-4)
2. Extract Market Data (Phase 5)
3. Extract Agent Service (Phase 6)
4. Extract Notification (Phase 7)
5. Extract Trading (Phase 8)
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

**For detailed guides:**
- [DEPLOYMENT.md](./DEPLOYMENT.md) - AWS EKS deployment procedures
- [KUBERNETES.md](./KUBERNETES.md) - Kubernetes operations
- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) - Local testing workflows
