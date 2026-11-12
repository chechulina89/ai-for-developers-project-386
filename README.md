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
it. Owner credentials enable owner sign-in and must not be committed. If both
are unset, the API starts but owner sign-in returns `503`; setting only one
credential is a startup error.

## Docker

Build and run the production image from the repository root:

```sh
docker build -t meetly .
PORT=8080
docker run --rm -p "$PORT:$PORT" \
  -e PORT \
  -e OWNER_LOGIN \
  -e OWNER_PASSWORD \
  meetly
```

Set `OWNER_LOGIN` and `OWNER_PASSWORD` in the shell before running the
container. `PORT` defaults to `3000`; set it to the internal container port and
publish the same port as shown above. Open `http://localhost:8080`. The API
serves the built web app and `/api` from the same process. Bookings and sessions
remain in memory and are lost when the container restarts.

## Render deployment

Public app URL: [https://meetly-booking.onrender.com](https://meetly-booking.onrender.com).
The service is deployed on Render Free; auto-deploy is disabled.

The project OpenCode MCP configuration is in [`opencode.json`](./opencode.json).
Render MCP uses `RENDER_API_KEY` from the environment; do not put the key in
this repository. Set it before starting OpenCode, then check the connection
with `opencode mcp list`. Create the key through the Render Dashboard and grant
only the access needed for the chosen workspace.

Render MCP can build the Dockerfile from the connected Git repository. The
Render MCP tool's documented plan list omits Free, but this service was created
on the Free plan. Check the service's **Instance Type** in Render Dashboard
before relying on its cost. The smallest paid web-service instance is about
$7/month as of November 2026 (Hobby workspace is $0/month plus compute).
Render Free services sleep after 15 idle minutes; the first request after a
sleep can be delayed by 50 seconds or more. They have 750 instance hours per
workspace/month and are not suitable for production data. See
[`docs/research/render-mcp-opencode-deploy.md`](./docs/research/render-mcp-opencode-deploy.md)
for current limits and source links.

To enable owner sign-in, set both `OWNER_LOGIN` and `OWNER_PASSWORD` in the
hosting environment; the API starts with both unset but owner sign-in returns
`503`. Setting only one is a startup error. Render provides `PORT` to the
container. `NODE_ENV` is set to production by the Docker image.

Bookings, idempotency keys, and owner sessions currently exist only in API
process memory. They are lost on restart, redeploy, or instance spin-down.
Render Postgres is a suitable persistent store (currently from $6/month), but
this app does not yet integrate with a database. Do not use real personal data
until persistent storage and production data handling are implemented.

Run `mise run check` for contract generation checks, lint, formatting, type
checks, Vitest unit/API/component tests, production builds, API smoke tests,
Playwright Chromium E2E tests, and `hk check --all`. Install Chromium for local
browser tests with `npx playwright install --with-deps chromium`.

`packages/api-contract/main.tsp` is the API source of truth. Generate OpenAPI
and the Orval client with `npm run generate`; do not edit the generated files
manually.
