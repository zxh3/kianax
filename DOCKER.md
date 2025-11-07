# Docker Setup Guide

## Prerequisites

1. **Install Docker Desktop**
   - Download: https://www.docker.com/products/docker-desktop/
   - Install and launch Docker Desktop
   - Wait for "Docker is running" indicator

2. **Verify installation**:
   ```bash
   docker --version
   docker-compose --version
   ```

## Quick Start

### 1. Start all services
```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port `5432`
- **Redis** on port `6379`
- **pgAdmin** on port `5050` (optional GUI)

The `-d` flag runs containers in the background (detached mode).

### 2. Check status
```bash
docker-compose ps
```

You should see:
```
kianax-postgres   running   0.0.0.0:5432->5432/tcp
kianax-redis      running   0.0.0.0:6379->6379/tcp
kianax-pgadmin    running   0.0.0.0:5050->80/tcp
```

### 3. View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

### 4. Stop services
```bash
# Stop but keep data
docker-compose stop

# Stop and remove containers (keeps data volumes)
docker-compose down

# Stop and DELETE all data (careful!)
docker-compose down -v
```

## Database Access

### From your application:
```bash
# Database URL (already in .env)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kianax
```

### Using pgAdmin (GUI):
1. Open: http://localhost:5050
2. Login:
   - Email: `admin@kianax.local`
   - Password: `admin`
3. Add server:
   - Host: `host.docker.internal` (Mac/Windows) or `172.17.0.1` (Linux)
   - Port: `5432`
   - Username: `postgres`
   - Password: `postgres`

### Using psql (command line):
```bash
# Connect to database
docker exec -it kianax-postgres psql -U postgres -d kianax

# Common commands inside psql:
\l              # List databases
\c kianax       # Connect to kianax database
\dt             # List tables
\q              # Quit
```

## Redis Access

### Using redis-cli:
```bash
# Connect to Redis
docker exec -it kianax-redis redis-cli

# Inside redis-cli:
PING            # Test connection (returns PONG)
KEYS *          # List all keys
GET key_name    # Get value
exit            # Exit redis-cli
```

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# View logs (follow mode)
docker-compose logs -f

# Remove everything (including volumes/data)
docker-compose down -v

# Rebuild containers (after docker-compose.yml changes)
docker-compose up -d --build

# Check container status
docker-compose ps

# Execute command in container
docker exec -it kianax-postgres psql -U postgres
docker exec -it kianax-redis redis-cli
```

## Database Migrations

Once PostgreSQL is running, initialize your database:

```bash
# Navigate to db package
cd packages/db

# Generate migration from schema
bun run db:generate

# Apply migration
bun run db:migrate

# Or push schema directly (dev only)
bun run db:push

# Open Drizzle Studio (database GUI)
bun run db:studio
```

## Troubleshooting

### Port already in use
If you see "port is already allocated":

```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :5050  # pgAdmin

# Kill the process using the port
kill -9 <PID>
```

### Reset everything
If you want to start fresh:

```bash
# Stop and remove everything
docker-compose down -v

# Start fresh
docker-compose up -d
```

### View container details
```bash
# Inspect container
docker inspect kianax-postgres

# Check container logs
docker logs kianax-postgres

# Enter container shell
docker exec -it kianax-postgres sh
```

## Data Persistence

Data is stored in Docker volumes (persists even when containers stop):
- `postgres_data`: PostgreSQL database files
- `redis_data`: Redis data
- `pgadmin_data`: pgAdmin configuration

To view volumes:
```bash
docker volume ls
docker volume inspect kianax_postgres_data
```

To backup PostgreSQL data:
```bash
docker exec kianax-postgres pg_dump -U postgres kianax > backup.sql
```

To restore:
```bash
docker exec -i kianax-postgres psql -U postgres kianax < backup.sql
```

## Production Notes

This setup is for **local development only**. For production:
- Use strong passwords (not `postgres`)
- Don't expose ports publicly
- Use managed database services (AWS RDS, Railway, etc.)
- Enable SSL/TLS
- Regular backups
- Monitor resource usage

## What's Next?

1. Start services: `docker-compose up -d`
2. Run migrations: `cd packages/db && bun run db:migrate`
3. Start your server: `bun run dev`
4. Build your app! 🚀
