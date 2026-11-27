# NeonVision Cloudflare D1 memory service

This is an isolated, opt-in persistence adapter. The production Render service remains on its current SQLite path until the D1 adapter is tested and explicitly enabled.

## Resources provisioned

- D1 database: `neonvision-memory`
- D1 database ID: `ba90ad91-802a-439b-a485-6a586d48a316`
- Worker: `neonvision-memory`
- Worker URL: `https://neonvision-memory.transition-marketing-agency.workers.dev`
- Worker D1 binding: `DB`
- Worker secret binding: `NEONVISION_MEMORY_TOKEN` (not yet configured)
- Region reported by D1: APAC

## Database schema

The D1 database contains matching tables for:
- `chat_messages`
- `strategic_memory`
- `bookings`

It also contains `schema_migrations` for future versioned schema changes.

## Backend configuration (do not enable until authenticated integration tests pass)

Render environment variables will eventually require:

- `MEMORY_BACKEND=d1`
- `NEONVISION_MEMORY_URL=https://neonvision-memory.transition-marketing-agency.workers.dev`
- `NEONVISION_MEMORY_TOKEN=<secret configured independently in the Worker and Render>`

The token must be a high-entropy secret and must never be committed to source control or logged.

## Safety / cutover policy

- SQLite remains the default when `MEMORY_BACKEND` is unset or not `d1`.
- Do not enable D1 on Render until the Worker secret is configured, all adapter tests pass, and a migration/rollback plan for any existing SQLite records has been verified.
- Do not change the existing `dtm-lead-bridge` Worker.
- Do not change the knowledge corpus or re-embed.
- The current production deployment is not switched to D1 by this branch.
