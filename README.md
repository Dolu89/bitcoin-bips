# bips.xyz

A small app that mirrors specification repositories as fast, searchable, readable websites. It serves two sites from a single codebase:

- **bips.xyz** — Bitcoin Improvement Proposals, from `bitcoin/bips`
- **nips.nostr.com** — Nostr Implementation Possibilities, from `nostr-protocol/nips`

Which site you get is decided by the request's hostname, so one process serves both, and the content tracks the upstream GitHub repos.

## Features

- **Always in sync** — incremental pulls from the upstream repos; only the specs that changed are re-fetched and re-rendered.
- **Full-text search** — fast per-site search with highlighted matches, backed by Meilisearch.
- **Readable specs** — MediaWiki and Markdown turned into clean HTML, with syntax-highlighted code in light and dark.
- **Cross-references** — every spec shows what it links to and what links back to it.
- **Revision history** — the recent commit history for each spec, pulled straight from GitHub.
- **Raw Markdown** — each spec is also served as plain text at `/<number>.md`.
- **One codebase, many sites** — each site is picked by hostname; adding one is a config entry plus an adapter.

## How it works

A sync job pulls the spec files from GitHub, converts each one (MediaWiki or Markdown) to HTML with pandoc, highlights code blocks with Shiki, and reads the metadata out of the preamble — title, authors, status, and so on. It also resolves cross-references between specs and keeps the recent commit history for each file. Everything is stored in SQLite, and a copy is pushed to Meilisearch for full-text search. Pages are rendered server-side with Edge; there's just enough Alpine on the front-end for the search overlay and a few interactions.

Each project is one entry in `config/projects.ts` plus an adapter in `app/values/adapters/` that knows how to parse and present that project's specs. Adding a third site is those two things — the shared controllers and templates never branch on which project they're rendering.

## Running it locally

You'll need Node 24+, npm, and a recent pandoc (3.x) on your PATH — the renderer shells out to it. Meilisearch is optional; the site runs without it, you just won't have search.

```bash
npm install
cp .env.example .env
node ace generate:key   # fills in APP_KEY
npm run dev             # http://localhost:3333, with HMR
```

One gotcha: the app resolves the project from the hostname, and `localhost` matches neither `bips.xyz` nor `nips.nostr.com`, so out of the box you'll get a 404. Point a project at localhost in your `.env`:

```
BIPS_DOMAIN=localhost
```

Now `http://localhost:3333` serves the BIPs site (use `NIPS_DOMAIN=localhost` for the other one).

At this point the catalog is empty. To pull real data you need a GitHub token — a read-only personal access token is enough — set as `GITHUB_API_KEY` in `.env`, then:

```bash
node ace sync:ingest bips   # fetch the specs into SQLite
node ace sync:index bips    # push them to Meilisearch (skip if you're not running it)
```

Tests run with `node ace test` (or `node ace test unit` for the fast, no-network suite).

## Syncing the specs

Three commands, all idempotent — they diff against what's already stored and only do the work that actually changed:

- `node ace sync:ingest [project]` — pull specs into the catalog (every enabled project, or just one)
- `node ace sync:index [project]` — rebuild the search index from the catalog
- `node ace sync:run` — ingest everything, then rebuild the index, in that order. This is the one to put on a cron.

If you'd rather not run an external cron, the app can schedule itself: set `SYNC_SCHEDULER_ENABLED=true` and `SYNC_INTERVAL=6h`, and it runs `sync:run` on that cadence from inside the web process.

## Deploying

There's a `Dockerfile` (multi-stage — it bundles a recent pandoc and compiles the native SQLite driver against the runtime image) and a `docker-compose.yml` that brings the app up alongside Meilisearch. The compose file is wired for [Dokploy](https://dokploy.com): it expects an external `dokploy-network` so Dokploy's Traefik can route to the app and handle TLS.

The variables you must set are `APP_KEY`, `APP_URL`, and `MEILISEARCH_API_KEY`. Add `GITHUB_API_KEY` if the container should ingest, and set `BIPS_DOMAIN` / `NIPS_DOMAIN` to your real hosts. Migrations run automatically on startup, and the container answers a `/up` healthcheck.

To bring the stack up by hand, outside Dokploy:

```bash
docker network create dokploy-network   # first time only
docker compose up --build
```

Deploying doesn't fetch any specs on its own. Either turn on the embedded scheduler, or run `sync:run` as a scheduled task against the running container.
