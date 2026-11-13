# Render MCP and OpenCode deployment research

Checked on 2026-11-12 against official documentation.

## OpenCode connection

OpenCode supports project-level `opencode.json` configuration and remote
Streamable HTTP MCP servers under `mcp.servers` ([OpenCode MCP docs](https://opencode.ai/docs/mcp-servers/),
[OpenCode config docs](https://opencode.ai/docs/config/)). Render's hosted MCP
endpoint is `https://mcp.render.com/mcp`. Render's official integrations use
OAuth, but its documentation gives API-key setup for other clients ([Render
MCP docs](https://render.com/docs/mcp-server)); OpenCode can pass the key using
an environment substitution ([OpenCode MCP docs](https://opencode.ai/docs/mcp-servers/)).
The project config therefore uses `RENDER_API_KEY` without storing a key in the
repository.

OpenCode MCP connections can modify service environment variables and deploy
services ([Render MCP docs](https://render.com/docs/mcp-server)). Render
recommends caution when exposing account resources to an AI client. Use a
least-privilege Render identity/key where available and only authorize actions
after reviewing the target workspace.

## Docker web service and pricing

Render's MCP `create_web_service` supports Docker runtime, repository/branch,
Dockerfile path, build context, region, environment variables, and auto-deploy.
The MCP tool's accepted compute plans do not include `free`, and it cannot
deploy a prebuilt registry image ([Render MCP server tools](https://github.com/render-oss/render-mcp-server)).
Creating a web service from the repository starts its initial deployment
([Render MCP docs](https://render.com/docs/mcp-server)).

Render lists the Hobby workspace at $0/month plus compute. The smallest paid
web-service compute is $7/month (512 MB RAM). Render also offers a free web
service, but its free instance spins down after 15 idle minutes, receives 750
instance hours per workspace/month, has an ephemeral filesystem, and is not
available in the MCP tool's plan list. Usage beyond included bandwidth or build
pipeline limits can incur charges or suspend service, depending on billing
settings ([Render pricing](https://render.com/pricing.md), [Render free
instances](https://render.com/docs/free), [Render MCP server tools](https://github.com/render-oss/render-mcp-server)).

The MCP-created Docker service must be built from the Git repository; publishing
a local prebuilt image is not supported by the MCP tool. Render's Docker
runtime expects the process to bind to `0.0.0.0` and supports the `PORT`
environment variable ([Render MCP server tools](https://github.com/render-oss/render-mcp-server),
[Render Docker docs](https://render.com/docs/docker)).

## Data persistence

This application currently stores bookings, idempotency keys, and owner
sessions in process memory. A restart, redeploy, or free-service spin-down loses them; a persistent
filesystem alone would not preserve in-memory state ([Render free instances](https://render.com/docs/free)).
Render Postgres is the appropriate persistent store, but the app needs a
database integration and migration before it can use one. The current Render
pricing page lists entry-level Postgres compute at $6/month; free Postgres
expires after 30 days and is not a suitable long-term store ([Render pricing](https://render.com/pricing.md),
[Render free instances](https://render.com/docs/free)).

## Sources

- [Render MCP Server docs](https://render.com/docs/mcp-server)
- [Render MCP server tools and accepted parameters](https://github.com/render-oss/render-mcp-server)
- [OpenCode MCP server configuration and environment substitution](https://opencode.ai/docs/mcp-servers/)
- [OpenCode project configuration locations](https://opencode.ai/docs/config/)
- [Render Docker deployment](https://render.com/docs/docker)
- [Render free instance limitations](https://render.com/docs/free)
- [Render pricing](https://render.com/pricing.md)
