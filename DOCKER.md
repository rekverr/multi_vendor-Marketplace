# Docker and CI

## Local stack

Requirements: Docker Engine with Docker Compose v2.

Start the complete marketplace stack from the repository root:

```bash
docker compose up --build
```

Compose starts PostgreSQL, Redis and Meilisearch first. The one-shot `backend-migrate` service applies committed Prisma migrations after PostgreSQL is healthy. The backend starts only after migrations complete and the frontend starts only after `GET /health` confirms PostgreSQL connectivity.

Local endpoints:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Metrics: `http://localhost:3000/metrics`
- Meilisearch: `http://localhost:7700`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

Compose defaults are development-only placeholders. Override credentials and OAuth configuration through shell variables or a root `.env` file before using the stack outside disposable local development:

```bash
POSTGRES_PASSWORD=replace-me \
JWT_ACCESS_SECRET=replace-with-at-least-32-random-characters \
MEILI_MASTER_KEY=replace-meilisearch-key \
GOOGLE_OAUTH_CLIENT_ID=replace-client-id \
GOOGLE_OAUTH_CLIENT_SECRET=replace-client-secret \
docker compose up --build
```

Environment values are supplied at container runtime. Dockerfiles do not copy backend/frontend `.env` files or bake backend secrets into images. `VITE_API_URL` is intentionally a public frontend build argument, not a secret.

Stop containers without deleting persisted data:

```bash
docker compose down
```

Delete disposable local volumes explicitly:

```bash
docker compose down --volumes
```

## Images

The backend image uses separate dependency, Prisma/build, production-dependency and runtime stages. The runtime image contains compiled application output and production packages only. Prisma CLI remains in the build target used by the migration service, not the runtime image.

The frontend image builds the Vite application and serves static assets through unprivileged Nginx with SPA route fallback and immutable asset caching.

## Continuous integration

`.github/workflows/ci.yml` runs for every push and pull request:

- backend dependency install, non-mutating lint, typecheck, unit tests, isolated PostgreSQL E2E tests and build;
- frontend dependency install, lint, typecheck, application build and Storybook build;
- Compose validation and both runtime Docker image builds after quality jobs pass.

Backend E2E tests use PostgreSQL, Redis and Meilisearch service containers. CI values are non-production placeholders and no repository secrets are required for the test suite.
