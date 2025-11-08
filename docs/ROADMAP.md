# Kianax Roadmap

Long-term product vision for the AI-native workflow platform.

> For current tasks, see [TODO.md](./TODO.md)

---

## Current Status: Phase 0

**What exists:**
- Next.js 16 frontend with shadcn/ui
- Project structure and documentation

**What doesn't:**
- No Convex integration yet
- No workflows or plugins
- No AI parsing

**Next:** Set up Convex and build first workflow

---

## Phases

### Phase 0: Foundation (Current) - 1 week

**Goal:** Get Convex working with basic data flow

- Set up Convex project
- Define workflows schema
- Create first mutations/queries
- Frontend integration with real-time updates

**Done when:** Can create workflow and see it live

### Phase 1: Auth & Multi-Tenancy - 1 week

**Goal:** Users can sign up and have isolated data

- Convex Auth setup (email/password)
- Auth UI components
- Automatic user isolation in queries
- Protected routes

**Done when:** Users can register, login, see only their workflows

### Phase 2: Plugin SDK - 2-3 weeks

**Goal:** Foundation for plugin system

- Plugin interface definition
- Plugin registry (Convex schema)
- Type system (JSON Schema validation)
- Plugin SDK package for developers
- Plugin marketplace schema

**Done when:** Developers can build plugins following SDK

### Phase 3: Workflow Engine - 2-3 weeks

**Goal:** Execute simple workflows via trigger.dev

- trigger.dev integration
- DAG compiler (Convex → trigger.dev jobs)
- Plugin execution in trigger.dev tasks
- Workflow types (root vs sub-workflow)
- Basic execution UI

**Done when:** Can run "Cron → Stock Price → Email" workflow

### Phase 4: Core Plugins - 3-4 weeks

**Build 6 essential plugins:**

1. Cron Trigger (time-based)
2. Stock Price Input (Polygon.io)
3. AI Processor (GPT-3.5)
4. HTTP Output
5. Email Output (SendGrid)
6. If/Else Logic

**Done when:** Can build "Stock alert" workflow end-to-end

### Phase 5: AI Workflow Creation - 3-4 weeks

**Goal:** Natural language → workflows

- Chat interface (shadcn/ui)
- OpenAI integration (GPT-4)
- Workflow parsing from text
- Interactive clarification questions
- Credential collection flow

**Done when:** "Alert me when TSLA drops 10%" creates working workflow

### Phase 6: Visual Editor - 3-4 weeks

**Goal:** Complex workflows via drag-and-drop

- React Flow integration
- Plugin palette
- Node configuration forms
- Testing with sample data
- Multi-branch workflows

**Done when:** Can build complex workflows visually

### Phase 7: Marketplace - 2-3 weeks

**Goal:** Browse and install community plugins and workflow templates

**Plugin Marketplace:**
- Marketplace UI (browse, search, filter)
- One-click install
- Plugin submission flow
- Code review process
- Ratings and reviews

**Workflow Marketplace:**
- Share workflows as templates
- Browse workflow templates
- Draft from template
- Validate plugin requirements and credentials
- Enable workflow when ready

**Done when:** Users can discover plugins and workflow templates, install plugins, and activate shared workflows

### Phase 8: Audio Interface - 1-2 weeks

**Goal:** Voice workflow creation

- Whisper API integration
- Audio recording UI
- Transcription → workflow parsing
- Voice feedback

**Done when:** Can speak workflow and it's created

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
- Sub-workflows (call-sub-workflow plugin)
- Scheduled triggers (multiple per workflow)
- Workflow templates

**Done when:** Can build production-grade complex workflows

### Phase 12: Mobile Apps - 4-6 weeks

**iOS + Android:**
- View workflows and executions
- Enable/disable workflows
- Push notifications
- Chat interface for workflow creation

**Done when:** Full workflow management from mobile

---

## Success Metrics

**User Success:**
- Create workflow in < 2 minutes
- 90% workflows succeed first try
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
