# Local infrastructure

Start foundational dependencies:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

| Service | Port | Role at 100k users |
|---------|------|--------------------|
| PostgreSQL | 5432 | Source of truth (users, projects, orgs) |
| PgBouncer | 6432 | **Apps must connect here**, not directly to Postgres, once API replicas > 1 |
| Redis | 6379 | Sessions, rate limits, BullMQ queues, short caches |

Apps/API should use:

```
DATABASE_URL=postgresql://pseudopilot:pseudopilot@localhost:6432/pseudopilot
REDIS_URL=redis://localhost:6379
```

Stop:

```bash
docker compose -f infra/docker/docker-compose.yml down
```
