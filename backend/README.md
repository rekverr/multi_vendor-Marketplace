# Marketplace Backend

NestJS/TypeScript ESM backend for the Multi-Vendor Marketplace. The complete architecture, environment, Docker, consistency rules and test instructions are in the repository [README](../README.md).

## Development

```bash
cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Swagger is served at `http://localhost:3000/docs`; PostgreSQL health and Prometheus metrics are available at `/health` and `/metrics`.

## Quality Gates

```bash
npm run lint:check
npm run typecheck
npm run test -- --runInBand
npm run test:e2e
npm run build
```
