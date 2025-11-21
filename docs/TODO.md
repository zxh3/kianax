# TODO - Current Tasks

**Last Updated:** 2025-01-11
**Current Phase:** Phase 2 Complete, Phase 3 Next (Trigger System & Production)

> For long-term vision, see [ROADMAP.md](./ROADMAP.md)

---

## ✅ Completed

### Phase 0: Foundation
- [x] **Convex Setup**
  - [x] Run `npx convex dev`
  - [x] Create Convex account
  - [x] Install dependencies
  - [x] Wrap app with `ConvexProvider`
  - [x] Create `convex/schema.ts` (messages schema for demo)
  - [x] Test real-time data flow with chat demo

### Phase 1: Auth
- [x] **Better-Auth Integration**
  - [x] Install `@convex-dev/better-auth`
  - [x] Configure Google OAuth provider
  - [x] Create auth client and provider
  - [x] Test auth in dashboard

- [x] **Auth UI**
  - [x] Add authentication flow
  - [x] Add sign out functionality
  - [x] Protected dashboard routes

- [x] **Dashboard UI**
  - [x] Create layout-based navigation with sidebar
  - [x] Add route highlighting for active pages
  - [x] Create placeholder pages (Chat, Workflows, Plugins, Marketplace, Settings)
  - [x] Dynamic header titles based on route
  - [x] User menu with settings navigation

### Phase 2: Plugin System & Routine Foundation ✅ **Complete**

- [x] **Routine Schema**
  - [x] `routines` table with nodes, connections, triggers
  - [x] `routine_executions` table for tracking
  - [x] `installed_plugins` and `plugin_credentials` tables
  - [x] Execution path tracking for conditional branching

- [x] **Routine CRUD**
  - [x] Complete CRUD operations (create, read, update, delete, list)
  - [x] Real-time updates with Convex subscriptions
  - [x] User isolation and row-level security

- [x] **Plugin System**
  - [x] Builder pattern plugin SDK with type safety
  - [x] 7 working plugins (data sources, processors, logic, actions)
  - [x] Plugin registry and installation system
  - [x] Plugin marketplace UI with install/uninstall/enable/disable

- [x] **Visual Routine Editor**
  - [x] ReactFlow-based DAG editor
  - [x] Drag-and-drop plugin nodes
  - [x] Visual connection system
  - [x] Node configuration UI
  - [x] Save/test functionality

- [x] **Execution Engine**
  - [x] Temporal workflow executor with BFS traversal
  - [x] Conditional branching (if-else) support
  - [x] Loop support
  - [x] Dead branch handling
  - [x] Parallel execution
  - [x] Result tracking and observability

- [x] **Frontend UI**
  - [x] Routines page with table view
  - [x] Plugin marketplace with grid view
  - [x] My Plugins management page
  - [x] Routine editor at `/dashboard/routines/[id]/edit`
  - [x] Real-time updates across all pages

- [x] **E2E Testing**
  - [x] Test scripts for simple and conditional routines
  - [x] Full Convex + Temporal integration tests

---

## 🎯 Current Sprint - Trigger System & Production

**Goal:** Add cron/webhook triggers and prepare for production deployment

### Phase 3 Tasks

- [ ] **Trigger System**
  - [ ] Add cron trigger support (schedule routines)
  - [ ] Add webhook trigger support (HTTP endpoints)
  - [ ] Add event-based triggers (platform events)
  - [ ] UI for trigger configuration in routine editor
  - [ ] Temporal cron workflow integration

- [ ] **Credential Management UI**
  - [ ] Plugin credential configuration page
  - [ ] Secure credential storage (encrypted in Convex)
  - [ ] Credential validation before routine execution
  - [ ] UI for adding API keys, tokens, secrets

- [ ] **Production Readiness**
  - [ ] Error handling and retry logic
  - [ ] Rate limiting per user
  - [ ] Execution timeout configuration
  - [ ] Cost estimation for plugin executions
  - [ ] Monitoring and alerting setup

**Done when:**
- Users can schedule routines with cron expressions
- Routines can be triggered via webhooks
- Plugins can securely use API credentials
- System is ready for alpha users

---

## 🎨 UX & Architecture Refinements

**Goal:** Improve the visual programming experience based on initial feedback

- [ ] **Iterator Node**
  - Create a high-level "For Each" node to simplify loop visualization
  - Replace low-level "Loop Control" (goto-style) with scope-based or iterator-based approach

- [ ] **Data Flow Improvements**
  - Investigate "variable picker" or global context to reduce "wiring hell"
  - Visually differentiate "Control Flow" connections (sequencing) from "Data Flow" connections (variables)

---

## 🔮 Coming Soon

### Phase 4: Core Plugins (Real APIs)
- Stock Price data source (Polygon.io)
- Weather data source (OpenWeatherMap)
- Email action (SendGrid)
- SMS action (Twilio)
- Trading action (Alpaca)
- AI processor (OpenAI GPT-4)

### Phase 5: AI Routine Creation
- Natural language → routine DAG parsing
- AI-powered node configuration
- Interactive clarification for ambiguous requests
- Preview and edit before saving

### Phase 6: Plugin Marketplace V2
- Community plugin submission
- Plugin versioning and updates
- Plugin reviews and ratings
- Routine templates marketplace

---

## 🐛 Known Issues

- Chat page is placeholder (not integrated with routine system yet)

---

## 💡 Ideas Backlog

- Workflow versioning
- Execution replay
- Workflow marketplace (templates + sharing) - See Phase 7 in ROADMAP.md
- Team workspaces
- Fork/remix workflows from marketplace
- Workflow analytics (execution stats, popular workflows)

---

## 📝 Notes

### Development Commands

```bash
# Start Convex backend
npx convex dev

# Start Next.js frontend
bun run dev

# Run Convex function
npx convex run workflows:list

# Deploy to production
npx convex deploy && vercel --prod
```

### Useful Links

- [Convex Docs](https://docs.convex.dev)
- [Temporal Docs](https://docs.temporal.io)
- [Convex Dashboard](https://dashboard.convex.dev)

---

## 🎉 Recent Accomplishments

**2025-01-11:**
- ✅ Rebranded "workflows" → "routines" throughout UI and docs
- ✅ Completed Phase 2 (Plugin System & Routine Foundation)
- ✅ Visual routine editor with ReactFlow fully functional
- ✅ Plugin marketplace with 7 working plugins
- ✅ Temporal execution engine with conditional branching + loops
- ✅ Updated all documentation to reflect current status

**2025-01-08:**
- ✅ Dashboard UI with sidebar navigation
- ✅ Google OAuth authentication
- ✅ Convex backend with real-time updates

---

**Focus:** Phase 3 - Trigger system (cron, webhook) and production readiness.
