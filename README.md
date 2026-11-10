# Meetly

Meetly demonstrates a client booking flow for a single preconfigured online
meeting. Guests can choose a duration, date, and available time, submit their
name and phone number, and receive a confirmation. The owner signs in at
`/owner` to see upcoming bookings.

The current profile is explicitly a demo placeholder. Bookings, idempotency
keys, and owner sessions are held in memory by one API process and can be lost
when it restarts. Do not enter real personal data.

## Development

Use the versions in `mise.toml`, install dependencies with `npm ci`, then run:

```sh
OWNER_LOGIN=demo-owner OWNER_PASSWORD='replace-this-locally' npm run dev:api
npm run dev:web
```

The API listens on port 3000 and the Vite development server proxies `/api` to
it. The owner credentials are required by the API and must not be committed.

Run `mise run check` for contract generation checks, lint, formatting, type
checks, Vitest unit/API/component tests, production builds, API smoke tests,
Playwright Chromium E2E tests, and `hk check --all`. Install Chromium for local
browser tests with `npx playwright install --with-deps chromium`.

`packages/api-contract/main.tsp` is the API source of truth. Generate OpenAPI
and the Orval client with `npm run generate`; do not edit the generated files
manually.
