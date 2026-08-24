# Multi-Vendor Marketplace with Real-Time Inventory

A production-minded full-stack marketplace demonstrating multi-vendor ordering, authoritative inventory and money handling, race-safe auctions, reliable asynchronous projections, role/ownership isolation, real-time recovery, observability and deterministic tests.

The project is a modular monolith. PostgreSQL is the source of truth; Redis, Meilisearch, BullMQ and Socket.IO are supporting infrastructure and never override committed business state.

## Capabilities

- Email/password authentication, JWT access/refresh rotation, logout and Google OAuth2 linking.
- Customer, Seller and Admin RBAC enforced by the backend.
- Seller application and Admin approval/rejection.
- Admin Category management and Seller-owned Product lifecycle.
- Public catalog search, filters, facets, Product detail and verified reviews.
- Customer cart and idempotent multi-vendor checkout.
- Parent Order with one independent SellerOrder per Seller.
- Cancellation, item-level partial refunds, commission and auditable ledger adjustments.
- Auction configuration, race-safe bidding, finalization and winner purchase window.
- Customer/Seller disputes and Admin resolution workflow.
- Seller and Admin analytics plus CSV sales export.
- Transactional Outbox, BullMQ workers, Meilisearch projection, Redis cache and Socket.IO updates.
- Swagger, structured logs, correlation IDs, health checks, Prometheus metrics, Storybook, E2E concurrency tests and k6 load testing.

## Architecture

```text
React/Vite frontend
        |
        | HTTP + Socket.IO
        v
NestJS modular monolith
        |
        +--> PostgreSQL / Prisma 7 (authoritative state)
        |
        +--> Transactional Outbox --> BullMQ / Redis
                                      |--> Meilisearch projection
                                      |--> Socket.IO fan-out
        |
        +--> Redis read cache (best-effort projection)
```

Primary modules include auth, sellers, categories, products, cart, orders, auctions, reviews, disputes, analytics, outbox, queues, search, cache, realtime and observability. Controllers validate transport input and delegate to services; inventory, money and lifecycle rules remain in transactional application/domain services.

## Stack

- Backend: NestJS 11, TypeScript, ESM/NodeNext, Node.js 22.
- Frontend: React 19, React Router, TypeScript, Vite, Socket.IO client.
- Persistence: PostgreSQL 16, Prisma 7 with PostgreSQL adapter.
- Async/cache: Redis 7 and BullMQ.
- Search: Meilisearch.
- API: REST, Swagger/OpenAPI and Socket.IO.
- Validation/testing: Joi, class-validator, Jest, Supertest, Storybook and k6.
- Operations: Docker Compose and GitHub Actions.

## Prerequisites

Docker development requires Docker Engine/Desktop and Docker Compose v2. Native development requires Node.js 22 with npm, PostgreSQL 16, Redis 7 and Meilisearch 1.x. k6 is needed only for the load test.

## Environment

Copy the checked-in examples; never commit populated `.env` files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

| Variable | Purpose | Safe local example |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API port | `3000` |
| `CORS_ORIGIN` | Allowed browser origin | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL URL and Prisma schema | `postgresql://admin:change-me@localhost:5433/marketplace?schema=public` |
| `JWT_ACCESS_SECRET` | JWT signing secret, minimum 32 characters | `replace-with-at-least-32-random-characters` |
| `JWT_ACCESS_TTL_SECONDS` | Access-token lifetime | `900` |
| `JWT_REFRESH_TTL_SECONDS` | Refresh-session lifetime | `2592000` |
| `JWT_ISSUER` / `JWT_AUDIENCE` | JWT validation scope | `marketplace-api` / `marketplace-client` |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID | `replace-with-google-client-id` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth secret | `replace-with-google-client-secret` |
| `GOOGLE_OAUTH_REDIRECT_URI` | Registered OAuth callback | `http://localhost:5173/auth/google/callback` |
| `REDIS_URL` | BullMQ/cache connection | `redis://localhost:6379` |
| `MEILI_HOST` | Meilisearch endpoint | `http://localhost:7700` |
| `MEILI_MASTER_KEY` | Meilisearch key | `replace-meilisearch-key` |
| `OUTBOX_PUBLISHER_ENABLED` | Async publisher toggle | `true` |
| `PLATFORM_COMMISSION_RATE` | Decimal commission rate | `0.100000` |
| `ORDER_CURRENCY` | Three-letter currency | `USD` |
| `AUCTION_MAINTENANCE_ENABLED` | Auction maintenance polling | `true` |

The example files contain all optional timing/batch variables. Frontend uses only public `VITE_API_URL`; secrets must never use the `VITE_` prefix.

## Docker Startup

```bash
docker compose up --build
```

The migration service waits for PostgreSQL and applies committed Prisma migrations. The backend then waits for Redis and Meilisearch; the frontend waits for backend `/health`.

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health`
- Prometheus metrics: `http://localhost:3000/metrics`

See [DOCKER.md](./DOCKER.md) for overrides, image design and cleanup.

## Native Startup and Migrations

```bash
docker compose up -d postgres redis meilisearch

cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

After intentionally changing `prisma/schema.prisma`, create a development migration with:

```bash
cd backend
npx prisma migrate dev --name describe_the_change
npx prisma generate
```

Production/CI applies committed migrations with `migrate deploy`, never `migrate dev`.

## Authentication and Swagger

Swagger at `http://localhost:3000/docs` groups authentication, Seller onboarding, Categories, Products, Cart, checkout/Orders, Auctions/bids, reviews, disputes, Seller dashboards and Admin operations.

1. Register or log in through `auth`.
2. Copy the returned access token, not the refresh token.
3. Select **Authorize** and enter the token for the HTTP bearer JWT scheme.

Roles come from persisted backend identity. Frontend route guards and Swagger visibility are not authorization. Google OAuth trusts provider-verified email, safely links unique provider identity to normalized existing accounts, and never escalates role.

Errors use a consistent envelope containing `statusCode`, `code`, `message`, `path`, `timestamp` and `correlationId`. OpenAPI documents important `400` validation, `401` authentication, `403` role, privacy-preserving `404` ownership/not-found, and `409` lifecycle/stock/idempotency conflicts.

## Consistency and Concurrency

### PostgreSQL authority

PostgreSQL owns users, ownership, Product lifecycle, stock, bids, Orders, money, refunds, reviews and disputes. Meilisearch, Redis and WebSocket state never authorize or validate checkout, refunds or bids.

### Transactional checkout and stock

Checkout re-reads authoritative Products, prices, Sellers and cart state. One transaction locks/decrements inventory, creates one parent Order and one SellerOrder per Seller, stores immutable OrderItem snapshots, calculates Decimal commission/ledger rows, clears the cart and writes Outbox events. Any unavailable line rolls back the complete checkout. Conditional updates/row locks prevent negative stock under concurrency.

### Auction locking

Bid acceptance uses a PostgreSQL transaction and row-level Auction lock. Deadline, highest bid and minimum increment are checked after lock acquisition. Bid history, Auction highest bid/version and Outbox event commit atomically. Finalization and winner-window expiry are idempotent.

### Idempotency

Checkout, bid and refund commands persist idempotency identity. Exact retries reuse the original result without repeating stock or financial effects; conflicting reuse is rejected.

### Outbox, search and cache

Business mutation and `OutboxEvent` commit together. A retrying publisher sends events to BullMQ after commit. Idempotent consumers update the Meilisearch Product projection; PostgreSQL remains authoritative. After building the backend, `npm run search:reindex` rebuilds search from PostgreSQL.

Redis caches Category lists and selected Product reads. Cache failure falls back to authoritative reads where practical, and mutations invalidate affected keys. Search/cache never decide stock, money or ownership.

### Realtime recovery

Socket.IO authenticates connections and authorizes private Order/SellerOrder rooms. Push events improve freshness but are not authoritative. After reconnect the frontend resubscribes, fetches current HTTP state and reconciles using entity version/timestamp to reject stale or duplicate updates.

## Cancellation and Refund Rules

SellerOrders move independently through validated states such as `NEW -> PROCESSING -> SHIPPED -> COMPLETED`; parent status is derived centrally.

- A Customer may cancel an owned parent Order only before any child is shipped/completed.
- Eligible cancellation affects only targeted SellerOrders, restores only their inventory, records ledger reversals and recomputes parent status transactionally.
- Cancellation retries are idempotent and sibling SellerOrders remain independent.
- Item refunds are allowed only for completed SellerOrders.
- Refund quantity cannot exceed purchased quantity remaining after cancellation/prior refunds.
- Refund amount uses immutable purchase-time unit price, never current Product price.
- Commission and Seller-net reversals are deterministic and auditable.
- Refund idempotency prevents duplicate effects and rejects conflicting key reuse.

## Analytics Revenue Rules

Analytics use persisted Order, SellerOrder, OrderItem and ledger snapshots:

- Net marketplace sales: `Order.totalAmount - Order.refundedAmount`, grouped by Order creation time.
- Platform revenue: Platform ledger credits minus debits by ledger occurrence time.
- Seller recognized revenue: Seller ledger credits minus debits by ledger occurrence time.
- Product performance excludes cancelled/refunded quantities and amounts.
- Top Products rank by net gross then net units; top Sellers use recognized Seller ledger revenue.
- Daily sales use UTC Order creation day; later refunds reduce that day's net sales.
- Cart-to-order conversion is successful unique checkout attempts divided by all unique checkout attempts created in the selected period; retries with the same Customer/idempotency key count once.

## Tests and Builds

Backend:

```bash
cd backend
npm run lint:check
npm run typecheck
npm run test -- --runInBand
npm run test:e2e
npm run build
```

E2E creates and removes a temporary PostgreSQL schema. Critical suites cover multi-vendor checkout, scarce-stock and bid races, idempotency, ownership, refunds, review eligibility and duplicate delivery.

Frontend:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run build-storybook
```

GitHub Actions runs all available gates on push and pull requests, using PostgreSQL, Redis and Meilisearch service containers, then validates Docker builds.

## Storybook

```bash
cd frontend
npm run storybook
```

Open `http://localhost:6006`.

## Load Testing

After installing k6 and preparing a fresh active Auction without bids:

```bash
BASE_URL=http://localhost:3000 \
AUCTION_ID=00000000-0000-4000-8000-000000000001 \
BID_AMOUNT=100.00 \
BIDDERS=20 \
RUN_ID=local-001 \
k6 run load-tests/auction-bidding.js
```

See [load-tests/README.md](./load-tests/README.md) for setup, correctness verification and the detailed report.

Measured locally on 2026-08-24 with 20 concurrent bidders submitting the same `1000.00` bid:

- bid RPS: `5.77`;
- bid-request p95 latency: `109.41 ms`;
- accepted bids: `1`;
- expected business rejections: `19`;
- unexpected errors: `0`;
- final authoritative correctness checks passed: `1`.

The final Auction contained exactly one bid, version increased once, and the authoritative highest bid was `1000.00`.

## Known Limitations

- No external payment gateway or settlement integration.
- No configured email/SMS notification provider.
- Search, cache and realtime are eventually consistent and may lag PostgreSQL.
- Auction maintenance uses polling rather than a dedicated scheduler service.
- Google OAuth requires developer-owned provider credentials and redirect registration.
- `VITE_API_URL` is build-time configuration.
- Compose placeholders, TLS and edge routing are operator responsibilities, not production credentials.

## More Documentation

See [`docs/`](./docs/README.md), [`DOCKER.md`](./DOCKER.md) and [`load-tests/README.md`](./load-tests/README.md).
