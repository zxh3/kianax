# Kianax Roadmap

Long-term product vision for the AI-native routine platform.

> For current tasks, see [TODO.md](./TODO.md)

---

## Current Status: Phase 2 Complete ✅

**What exists:**
- ✅ Next.js 16 + React 19 with shadcn/ui + Tailwind CSS v4
- ✅ Convex backend (real-time database + serverless functions)
- ✅ Better Auth with Google OAuth + email/password
- ✅ Complete routine CRUD with real-time updates
- ✅ Visual routine editor with ReactFlow (drag-and-drop DAG builder)
- ✅ Plugin system with builder pattern (7 working plugins)
- ✅ Plugin marketplace UI (install/uninstall/enable/disable)
- ✅ Temporal workflow execution engine (conditional branching + loops)
- ✅ Execution tracking and observability
- ✅ E2E test infrastructure
- ✅ Routes: `/dashboard/routines`, `/dashboard/plugins`, `/dashboard/marketplace`

**Next:** Phase 3 - Trigger system (cron, webhook) and production deployment

---

## Phases

### Phase 0: Foundation ✅ **Complete** - 1 week

**Goal:** Get Convex working with basic data flow

- ✅ Set up Convex project
- ✅ Define routines schema
- ✅ Create first mutations/queries
- ✅ Frontend integration with real-time updates

**Done when:** Can create routine and see it live

### Phase 1: Auth & Multi-Tenancy ✅ **Complete** - 1 week

**Goal:** Users can sign up and have isolated data

- ✅ Better Auth setup (Google OAuth + email/password)
- ✅ Auth UI components
- ✅ Automatic user isolation in queries
- ✅ Protected routes

**Done when:** Users can register, login, see only their routines

### Phase 2: Plugin System & Routine Foundation ✅ **Complete** - 2-3 weeks

**Goal:** Build execution engine, plugin system, and visual editor

**Completed:**
- ✅ Routine CRUD operations with real-time updates
- ✅ Plugin system with builder pattern (type-safe Zod schemas)
- ✅ 7 working plugins:
  - Data sources: static-data, mock-weather, stock-price
  - Processors: ai-transformer
  - Logic: if-else
  - Actions: email, http
- ✅ Visual routine editor with ReactFlow
  - Drag-and-drop nodes
  - Visual connection system
  - Node configuration UI
  - Save/test functionality
- ✅ Plugin marketplace UI (install/uninstall/enable/disable)
- ✅ Temporal workflow executor
  - BFS traversal algorithm
  - Conditional branching (if-else)
  - Loop support
  - Dead branch handling
  - Parallel execution
- ✅ Execution tracking and observability
- ✅ E2E test infrastructure

**Done:** Users can create routines visually, execute them, and see results in real-time

### Phase 3: Trigger System & Production - 2-3 weeks

**Goal:** Add automated triggers and prepare for production

**Tasks:**
- Cron trigger (schedule routines with cron expressions)
- Webhook trigger (HTTP endpoints for routine execution)
- Event-based triggers (platform events)
- Credential management UI (secure API key storage)
- Error handling and retry logic
- Rate limiting per user
- Monitoring and alerting
- Production deployment

**Done when:** Users can schedule routines with cron, trigger via webhooks, and system is alpha-ready

### Phase 4: Core Plugins (Real APIs) - 3-4 weeks

**Goal:** Replace mock plugins with real API integrations

**Build:**
- Stock Price data source (Polygon.io) - upgrade from mock
- Weather data source (OpenWeatherMap) - upgrade from mock
- Email action (SendGrid) - upgrade from mock
- HTTP action with auth (OAuth, API keys) - upgrade from mock
- SMS action (Twilio)
- Trading action (Alpaca)
- AI processor (OpenAI GPT-4) - upgrade from mock

**Done when:** Can build production routines with real APIs (e.g., "Stock alert" routine)

### Phase 5: AI Routine Creation - 3-4 weeks

**Goal:** Natural language → routines

- Chat interface (shadcn/ui)
- OpenAI integration (GPT-4)
- Routine parsing from text
- Interactive clarification questions
- Credential collection flow

**Done when:** "Alert me when TSLA drops 10%" creates working routine

### Phase 6: Plugin Marketplace V2 - 2-3 weeks

**Goal:** Enable community plugin development and distribution

- Plugin SDK documentation for developers
- Plugin submission flow
- Plugin versioning and updates
- Code review and approval process
- Plugin ratings and reviews
- Routine templates marketplace
- Fork/remix routines

**Done when:** Developers can publish plugins; users can discover and install community plugins

### Phase 7: Advanced Features - 2-3 weeks

**Goal:** Production-grade features for complex routines

- Sub-routines (call-sub-routine plugin)
- Advanced error handling (try/catch blocks)
- Retry policies per node
- Timeout configuration
- Data persistence between executions
- Routine versioning
- Execution replay/time-travel debugging

**Done when:** Can build production-grade complex routines with proper error handling

### Phase 8: Audio Interface - 1-2 weeks

**Goal:** Voice routine creation

- Whisper API integration
- Audio recording UI
- Transcription → routine parsing
- Voice feedback

**Done when:** Can speak routine and it's created

### Phase 9: More Input Plugins - 2-3 weeks

**Build:**
- Twitter/X API
- Reddit API
- RSS feeds
- News APIs
- Weather data

**Done when:** Users have 10+ input sources to choose from

### Phase 10: More Output Plugins - 2-3 weeks

**Build:**
- SMS (Twilio)
- Phone calls (Twilio)
- Trading (Alpaca)
- Slack notifications
- Discord webhooks

**Done when:** Users have 10+ actions

### Phase 11: Advanced Features - 2-3 weeks

- Parallel execution
- Error handling (try/catch)
- Sub-routines (call-sub-routine plugin)
- Multiple trigger types per routine
- Routine templates

**Done when:** Can build production-grade complex routines

### Phase 12: Mobile Apps - 4-6 weeks

**iOS + Android:**
- View routines and executions
- Enable/disable routines
- Push notifications
- Chat interface for routine creation

**Done when:** Full routine management from mobile

---

## Success Metrics

**User Success:**
- Create routine in < 2 minutes
- 90% routines succeed first try
- Users feel in control

**Platform Success:**
- 99.9% uptime
- < 100ms API response (p95)
- Zero security incidents

**Business Success:**
- 10K users year 1
- 50+ community plugins year 1
- 60% retention after 3 months

---

## Principles

1. **Ship Fast** - Small iterations, frequent releases
2. **AI-First** - Natural language as default interface
3. **Plugin-Driven** - Community builds the ecosystem
4. **Serverless-First** - Zero infrastructure management
5. **Real-Time Native** - Live updates everywhere
6. **User-Centric** - Simple beats powerful

---

For detailed current tasks, see [TODO.md](./TODO.md)
