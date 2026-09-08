# Current dashboard behavior ? 2026-09-08

The dashboard now requests `source=all` for overview, analytics and execution logs. Seeded MongoDB records and incoming runtime records are displayed together, with no source selector or demo banner. Internal source provenance is retained for routing and enforcement. API callers that omit source still get runtime-only results.

Quota display is backed by `AIQuotaPolicy.dashboardBaseline` plus active runtime usage. Baselines are inserted once, never rewritten on reruns, and are excluded from live quota admission. Hardcoded frontend utilization percentages have been removed. Runtime usage resets by its configured period; the display baseline remains the seeded starting value.

```powershell
npm run build
npm run seed:ai:production -- --env-file .env.production --workspace brand-ecommerce --workspace vizr --workspace ibrahem-portfolio --quota-baseline --apply
```

Validation: 55 tests pass, including combined log totals and additive quota display with unchanged enforcement counters. Both builds and targeted frontend lint pass. The seeder uses the existing MongoDB DNS fallback and retry logic.

The earlier implementation notes below are historical; their source-selector and banner descriptions are superseded by this section.

---

# Production AI starter configuration

Do not run the general `npm run seed` against production: it replaces demo settings, accounts and synthetic telemetry.

Build first with `npm run build`. Inventory is read-only by default:

```powershell
npm run seed:ai:production -- --env-file .env.production --workspace brand-ecommerce --workspace vizr --workspace ibrahem-portfolio
```

Add `--apply` to insert missing providers, six agent templates and disabled routing/budget templates in those existing workspaces. Existing documents, timestamps, permissions, default agent assignments, usage counters and request logs are preserved. Unknown workspace slugs abort before writes. Run one seeder at a time.

Optionally supply both `--provider` and `--model` using the actual configured provider and model identifier. This inserts a missing model and assigns it only to newly inserted agents. Without those options, new agents require a model selection in the dashboard. No provider request or model availability check is performed.

New agents are disabled with an empty-permission role and no tools. Review their model, permissions, tools and prompt before enabling and assigning a default in the dashboard. New routing and quota templates are disabled until reviewed. Provider credentials remain in environment configuration.

Omit `--env-file` when the deployment shell already supplies production environment variables. When provided, the selected file overrides shell values; connection secrets are never printed.

## Production inventory — 2026-09-08

The locally configured `.env.production` database contains 13 providers and 26 models. Each of `brand-ecommerce`, `vizr` and `ibrahem-portfolio` already contains 6 agents, 6 routing policies, 4 quota policies and 420 demo request logs. None has runtime request logs. The latest dashboard intentionally excludes demo logs from traffic analytics. No production data was changed during this investigation.

Both deployed `/api/admin/ai-management/agents` and `/api/admin/ai-management/runtime` returned HTTP 401 to unauthenticated checks. An authenticated dashboard error is needed to diagnose any missing configuration display; the database inventory does not prove what database the Vercel deployment uses.

Validation: backend TypeScript build and isolated MongoDB seeder integration test passed. The test verifies tenant isolation, unknown-workspace rejection, disabled starters, no artificial traffic, existing provider disable preservation, and byte-equivalent document content after a rerun, including dashboard prompts, zero temperature and default assignments.

## Large simulated traffic dataset

```powershell
npm run build
npm run seed:ai:production -- --env-file .env.production --workspace brand-ecommerce --workspace vizr --workspace ibrahem-portfolio --traffic 10000 --apply
```

`--traffic` seeds only request logs, preserving all existing configuration and quota counters. It inserts 10,000 records per workspace over the preceding 30 days in batches of 500. Provider/model pairs come from the database. Requests, costs, tokens, latency and failures are synthetic and marked `source: demo`. No upstream calls are made. Stable correlation IDs make reruns insert-only: they do not duplicate or refresh existing records. Supported count: 1?100,000 per workspace. All selected workspaces must already have agents and valid provider/model references.

Overview, analytics and log endpoints accept `source=demo`; omitted or other values retain runtime-only behavior. The dashboard's Automatic mode selects demo only when the workspace has no real execution logs. A visible banner labels simulated metrics, and the traffic selector permits explicit real/demo views. Runtime routing, quota accounting and billing continue to exclude demo traffic. The separate runtime token-insights widget is hidden in demo mode to avoid mixing datasets.

Validation: 55 backend tests pass, including traffic idempotency, preservation of real logs, tenant isolation and source-separated analytics. Backend and frontend builds pass.
