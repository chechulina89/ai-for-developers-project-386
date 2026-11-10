# Project Guidelines

## Architecture

- `apps/web` is the React, Vite, and Mantine frontend.
- `apps/api` is the Fastify backend; keep its OpenAPI contract in sync.
- `packages/api-contract/main.tsp` is the API source of truth. The generated
  OpenAPI file at
  `packages/api-contract/openapi/@typespec/openapi3/openapi.yaml` and the
  client SDK at `packages/api-client/src/generated/api.ts` must not be edited
  by hand. Run `npm run generate` after changing the contract.

## Development

- Use the exact tool versions in `mise.toml`: run `mise install`, then `npm ci`.
- Start the frontend with `npm run dev:web`; configure `OWNER_LOGIN` and
  `OWNER_PASSWORD` before starting `npm run dev:api`.
- The current booking store is in-memory and single-process for demonstration;
  bookings and sessions can disappear when the API restarts.
- Run `mise run check` for generation, lint, formatting, type checks, unit and
  API tests, production builds, smoke, browser E2E, and hk checks.
- Run `hk install` to enable local Git hooks and `hk check --all` to run hk
  checks manually.

## Conventions

- Keep TypeScript strict and follow the existing ESLint and Prettier settings.
- Use Conventional Commits. Every implementation commit must reference the
  GitHub Issue it addresses, for example `feat: add available slots (#19)`.
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

Use one shared glossary at `GLOSSARY.md` and shared decisions in
`docs/adr/`; see `docs/agents/domain.md`.
