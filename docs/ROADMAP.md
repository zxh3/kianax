# Kianax Roadmap

Long-term product vision for the AI-native routine platform.

> For current tasks, see [TODO.md](./TODO.md)

---

## Current Status: Phase 0

**What exists:**
- Next.js 16 frontend with shadcn/ui
- Project structure and documentation

**What doesn't:**
- No Convex integration yet
- No routines or plugins
- No AI parsing

**Next:** Set up Convex and build first routine

---

## Phases

### Phase 0: Foundation (Current) - 1 week

**Goal:** Get Convex working with basic data flow

- Set up Convex project
- Define routines schema
- Create first mutations/queries
- Frontend integration with real-time updates

**Done when:** Can create routine and see it live

### Phase 1: Auth & Multi-Tenancy - 1 week

**Goal:** Users can sign up and have isolated data

- Convex Auth setup (email/password)
- Auth UI components
- Automatic user isolation in queries
- Protected routes

**Done when:** Users can register, login, see only their routines

### Phase 2: Plugin SDK - 2-3 weeks

**Goal:** Foundation for plugin system

- Plugin interface definition
- Plugin registry (Convex schema)
- Type system (JSON Schema validation)
- Plugin SDK package for developers
- Plugin marketplace schema

**Done when:** Developers can build plugins following SDK

### Phase 3: Routine Engine - 2-3 weeks

**Goal:** Execute simple routines via Temporal Cloud

- Temporal Cloud setup (account, namespace)
- TypeScript Worker implementation
- Generic routine executor (interprets DAG at runtime using Temporal workflows)
- Plugin execution as Temporal Activities
- Routine types (root vs sub-routine)
- Trigger configuration (cron, webhook, manual, event)
- Basic execution UI with real-time status

**Done when:** Can run "Cron-triggered Stock Price → Email" routine with live execution tracking

### Phase 4: Core Plugins - 3-4 weeks

**Build 5 essential plugins:**

1. Stock Price Input (Polygon.io)
2. AI Processor (GPT-3.5)
3. HTTP Output
4. Email Output (SendGrid)
5. If/Else Logic

**Note:** Triggers are routine-level config, not plugins

**Done when:** Can build "Stock alert" routine end-to-end

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
