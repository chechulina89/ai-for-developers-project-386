# Project Guidelines

## Architecture

- `apps/web` is the React, Vite, and Mantine frontend.
- `apps/api` is the Fastify backend; keep its OpenAPI contract in sync.
- `packages/api-contract/main.tsp` is the API source of truth. OpenAPI output
  and `packages/api-client/src/generated` are generated; do not edit them by
  hand. Run `npm run generate` after changing the contract.

## Development

- Use the exact tool versions in `mise.toml`: run `mise install`, then `npm ci`.
- Start the frontend with `npm run dev:web` and the API with `npm run dev:api`.
- Run `npm run check` for generation, lint, formatting, type checks, tests, and
  production builds. Run `npm run smoke` to exercise the built API over HTTP.
- Run `hk install` to enable local Git hooks and `hk check --all` to run hk
  checks manually.

## Conventions

- Keep TypeScript strict and follow the existing ESLint and Prettier settings.
- Add backend tests with Vitest; use Fastify injection for route-level tests.
- Do not edit or rename `.github/workflows/hexlet-check.yml`; it is reserved
  for the Hexlet project checks.

## Agent skills

### Issue tracker

Issues are tracked in this repository's GitHub Issues. Use `gh` from this
repository; see `docs/agents/issue-tracker.md`.

### Triage labels

Use the default labels `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, and `wontfix`; see `docs/agents/triage-labels.md`.

### Domain docs

Use one shared glossary at `docs/GLOSSARY.md` and shared decisions in
`docs/adr/`; see `docs/agents/domain.md`.
