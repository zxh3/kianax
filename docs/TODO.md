# TODO - Current Sprint Tasks

**Last Updated:** 2025-01-07
**Current Phase:** Phase 0 - Foundation

> For long-term roadmap, see [ROADMAP.md](./ROADMAP.md)

---

## 🎯 Current Sprint (This Week)

### Phase 0: Foundation - Get Basic Infrastructure Working

**Goal:** Connect database to server and verify end-to-end flow works

- [ ] **Database Connection**
  - [ ] Add postgres connection string to server `.env`
  - [ ] Create database client in `apps/server/src/lib/db.ts`
  - [ ] Test connection on server startup
  - [ ] Add error handling for connection failures

- [ ] **User CRUD API**
  - [ ] Create `GET /api/users` endpoint (list all users)
  - [ ] Create `POST /api/users` endpoint (create user)
  - [ ] Create `GET /api/users/:id` endpoint (get single user)
  - [ ] Add Zod validation for user input
  - [ ] Test all endpoints with curl or Postman

- [ ] **Frontend Integration**
  - [ ] Create `app/users/page.tsx` to display users
  - [ ] Add form to create new user
  - [ ] Call backend API from frontend
  - [ ] Display list of users from API
  - [ ] Add loading states and error handling

- [ ] **Documentation**
  - [ ] Document environment variable setup
  - [ ] Update README with database connection steps
  - [ ] Document API endpoints in comments

**Deliverable:** Can create a user via API call and see it displayed on a webpage

---

## 📋 Next Sprint (Week 2-3)

### Better Auth Integration

- [ ] Install Better Auth dependencies
  - [ ] `npm install better-auth`
  - [ ] Add required environment variables

- [ ] Configure Better Auth
  - [ ] Create `apps/server/src/lib/auth.ts`
  - [ ] Set up database tables for sessions
  - [ ] Configure JWT secret and session duration

- [ ] Create Auth Endpoints
  - [ ] POST `/api/auth/register` - User registration
  - [ ] POST `/api/auth/login` - User login
  - [ ] POST `/api/auth/logout` - User logout
  - [ ] GET `/api/auth/me` - Get current user

- [ ] Add Auth Middleware
  - [ ] Create `requireAuth` middleware
  - [ ] Protect existing user endpoints
  - [ ] Add user context to requests

- [ ] Build Auth UI
  - [ ] `app/login/page.tsx` - Login form
  - [ ] `app/register/page.tsx` - Registration form
  - [ ] Add client-side auth state management
  - [ ] Redirect logic (logged in/out states)

**Deliverable:** Users can register, log in, and access protected routes

---

## 🔮 Upcoming (Week 4+)

### Database Schema Expansion

- [ ] Create `portfolios` table with user_id foreign key
- [ ] Create `positions` table (user_id, symbol, quantity, avg_cost)
- [ ] Create `orders` table (user_id, symbol, side, quantity, status)
- [ ] Create `trades` table (user_id, order_id, price, timestamp)
- [ ] Generate and run Drizzle migrations
- [ ] Add seed data for development

### Paper Trading Backend

- [ ] Portfolio service (CRUD operations)
- [ ] Order service (create, cancel, list orders)
- [ ] Order execution simulator (fake fills)
- [ ] Balance validation before orders
- [ ] P&L calculation logic

### Paper Trading Frontend

- [ ] Portfolio dashboard page
- [ ] Order entry form
- [ ] Positions list
- [ ] Order history

---

## 🐛 Known Issues

*None yet - add issues as they come up*

---

## 💡 Ideas / Future Considerations

- Consider using tRPC instead of REST API
- Explore React Query for data fetching
- Look into Prisma vs Drizzle ORM comparison
- Research WebSocket libraries (Socket.io vs native ws)

---

## 📝 Notes

### Development Workflow
```bash
# Start databases
docker-compose up -d

# Start backend (terminal 1)
cd apps/server && bun run dev

# Start frontend (terminal 2)
cd apps/web && bun run dev

# Run migrations
cd packages/db && bun run db:migrate
```

### Useful Commands
```bash
# Check database
docker-compose exec postgres psql -U postgres -d kianax

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Reset database
docker-compose down -v
docker-compose up -d
cd packages/db && bun run db:migrate
```

---

**Priority:** Focus on Phase 0 first. Get database connected and basic CRUD working before moving to auth.
