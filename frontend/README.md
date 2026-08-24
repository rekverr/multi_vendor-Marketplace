# Marketplace Frontend

React/TypeScript/Vite frontend for the Multi-Vendor Marketplace. See the repository [README](../README.md) for architecture, backend setup, Docker and consistency rules.

## Development

```bash
cp .env.example .env
npm ci
npm run dev
```

The default frontend is available at `http://localhost:5173` and expects the API URL from `VITE_API_URL`.

## Quality and Storybook

```bash
npm run lint
npm run typecheck
npm run build
npm run storybook
npm run build-storybook
```
