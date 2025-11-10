# Kianax Roadmap

Long-term product vision for the AI-native routine platform.

> For current tasks, see [TODO.md](./TODO.md)

---

## Current Status: Phase 2 - Backend Complete

**What exists:**
- ✅ Next.js 16 frontend with shadcn/ui
- ✅ Convex backend (real-time database + serverless functions)
- ✅ Better Auth with Google OAuth
- ✅ Complete routine CRUD operations
- ✅ Workflow execution engine with conditional branching
- ✅ Execution tracking and observability
- ✅ Temporal Workers with dynamic workflow executor
- ✅ Mock plugins for local testing (static-data, mock-weather, if-else)
- ✅ E2E test infrastructure
- ✅ Protected dashboard with route-based navigation

**What's in progress:**
- 🚧 Frontend integration with Convex backend
- 🚧 Routines list UI with real-time updates

**Next:** Complete frontend integration, then move to plugin SDK development

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

### Phase 2: Workflow System & Plugin Foundation 🚧 **Backend Complete** - 2-3 weeks

**Goal:** Build workflow execution engine and plugin foundation

**Backend (✅ Complete):**
- ✅ Routine CRUD operations (create, read, update, delete, list)
- ✅ Execution tracking system (routine_executions table)
- ✅ Plugin interface definition
- ✅ Plugin registry implementation
- ✅ TypeScript Worker implementation
- ✅ Generic routine executor with BFS traversal
- ✅ Plugin execution as Temporal Activities
- ✅ Conditional branching support (if-else logic)
- ✅ Parallel execution support
- ✅ Mock plugins for local testing (static-data, mock-weather, if-else)
- ✅ E2E test infrastructure

**Frontend (🚧 In Progress):**
- 🚧 Routines list UI with real-time updates
- 🚧 Routine creation interface
- 🚧 Execution history display

**Done when:** Users can create, list, and execute routines via UI; execution status updates in real-time

### Phase 3: Plugin SDK & Marketplace - 2-3 weeks

**Goal:** Enable plugin development and distribution

- Plugin SDK package for developers
- Plugin marketplace schema
- Plugin submission and review process
- Plugin versioning support
- Plugin installation UI

**Done when:** Developers can build and publish plugins; users can install plugins from marketplace

### Phase 4: Core Plugins - 3-4 weeks

**Build essential plugins:**

1. Stock Price Input (Polygon.io)
2. AI Processor (GPT-3.5)
3. HTTP Output
4. Email Output (SendGrid)
5. Additional logic nodes (switch, loops)

**Note:** Triggers are routine-level config, not plugins

**Done when:** Can build "Stock alert" routine end-to-end with real API integrations

### Phase 5: AI Routine Creation - 3-4 weeks

**Goal:** Natural language → routines

- Chat interface (shadcn/ui)
- OpenAI integration (GPT-4)
- Routine parsing from text
- Interactive clarification questions
- Credential collection flow

**Done when:** "Alert me when TSLA drops 10%" creates working routine

### Phase 6: Visual Editor - 3-4 weeks

**Goal:** Complex routines via drag-and-drop

- React Flow integration
- Plugin palette
- Node configuration forms
- Testing with sample data
- Multi-branch routines

**Done when:** Can build complex routines visually

### Phase 7: Marketplace - 2-3 weeks

**Goal:** Browse and install community plugins and routine templates

**Plugin Marketplace:**
- Marketplace UI (browse, search, filter)
- One-click install
- Plugin submission flow
- Code review process
- Ratings and reviews

**Routine Marketplace:**
- Share routines as templates
- Browse routine templates
- Draft from template
- Validate plugin requirements and credentials
- Enable routine when ready

**Done when:** Users can discover plugins and routine templates, install plugins, and activate shared routines

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
