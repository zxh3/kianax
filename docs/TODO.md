# TODO - Current Tasks

**Last Updated:** 2025-01-08
**Current Phase:** Phase 0-1 - Foundation & Auth (Partially Complete)

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

---

## 🎯 Current Sprint - Workflow Foundation

**Goal:** Build actual workflow CRUD functionality with Convex

### Tasks

- [ ] **Workflow Schema**
  - [ ] Add `workflows` table to `convex/schema.ts`
  - [ ] Add `plugins` table (for installed plugins)
  - [ ] Add `plugin_credentials` table (encrypted)
  - [ ] Define workflow structure (nodes, connections, config)
  - [ ] Test schema compiles

- [ ] **Workflow Functions**
  - [ ] Create `convex/workflows.ts`
  - [ ] Add `list` query (get user's workflows with auth check)
  - [ ] Add `create` mutation (create workflow)
  - [ ] Add `update` mutation (update workflow)
  - [ ] Add `delete` mutation (delete workflow)
  - [ ] Add `get` query (get single workflow by ID)
  - [ ] Test with CLI: `npx convex run workflows:create`

- [ ] **Workflows Page Implementation**
  - [ ] Update `app/dashboard/workflows/page.tsx` with real functionality
  - [ ] Use `useQuery(api.workflows.list)` to fetch workflows
  - [ ] Use `useMutation(api.workflows.create)` for creating
  - [ ] Add workflow list UI (card grid or table)
  - [ ] Add "Create Workflow" button/modal
  - [ ] Verify real-time updates (open 2 tabs)

- [ ] **Route Protection**
  - [ ] Ensure all queries filter by authenticated user ID
  - [ ] Test user isolation (two users can't see each other's workflows)
  - [ ] Add loading states for auth checks

**Done when:**
- Users can create, view, update, and delete workflows
- Changes sync in real-time across tabs
- Each user only sees their own workflows

---

## 📋 Next Up - Plugin System

**Goal:** Define plugin architecture and build first plugins

### Tasks

- [ ] **Plugin Schema & Types**
  - [ ] Define plugin interface in `packages/plugin-sdk`
  - [ ] Add plugin marketplace schema to Convex
  - [ ] Define input/output type system
  - [ ] Add plugin versioning support

- [ ] **Marketplace Page**
  - [ ] Update `app/dashboard/marketplace/page.tsx` with real data
  - [ ] Browse available plugins
  - [ ] Install/uninstall plugins
  - [ ] View plugin details

- [ ] **My Plugins Page**
  - [ ] Update `app/dashboard/plugins/page.tsx`
  - [ ] List installed plugins
  - [ ] Configure plugin credentials
  - [ ] Manage plugin settings

---

## 🔮 Coming Soon

### Phase 3: Workflow Builder UI
- Visual workflow editor (React Flow)
- Drag-and-drop plugin nodes
- Connect plugins with type-safe edges
- Save workflow as JSON

### Phase 4: Workflow Execution (Temporal)
- Set up Temporal Cloud connection
- Build TypeScript Workers
- Implement generic workflow executor
- Execute first end-to-end workflow

### Phase 5: Core Plugins
- **Triggers:** Cron, Webhook, Manual
- **Data Sources:** Stock Price, Twitter, Reddit
- **Processors:** AI (GPT-4), Data Transform
- **Actions:** Email, HTTP, Trading (Alpaca)
- **Logic:** If/Else, Switch

### Phase 6: AI Workflow Generation
- Enhance chat interface for workflow creation
- GPT-4 integration for parsing natural language
- Generate workflow JSON from description
- Preview and edit AI-generated workflows

---

## 🐛 Known Issues

- Chat demo uses placeholder messages schema (not integrated with workflow system yet)
- Workflow, Plugin, and Marketplace pages are placeholders (no real data/functionality)

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

**2025-01-08:**
- ✅ Built complete dashboard UI with sidebar navigation
- ✅ Implemented route highlighting and dynamic headers
- ✅ Added Google OAuth authentication with better-auth
- ✅ Set up Convex backend with real-time data
- ✅ Created Chat demo with shadcn/ui components

---

**Focus:** Build workflow CRUD next, then move to plugin system and visual builder.
