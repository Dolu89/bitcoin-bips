import edge from 'edge.js'
import app from '@adonisjs/core/services/app'
import { edgeIconify, addCollection } from 'edge-iconify'
import { icons as lucide } from '@iconify-json/lucide'
import env from '#start/env'
import type { ProjectConfig } from '#types/project'
import { umamiTag } from '#values/analytics'
import { resolveMeta, iconPaths, type PageMeta } from '#values/site_meta'

// Register the Lucide icon collection so templates can use `@svg('lucide:<name>')`.
addCollection(lucide)
edge.use(edgeIconify)

/**
 * Per-project theme as inline CSS vars: derives every brand shade from the one
 * accent color via `color-mix`, so a new project only supplies `color`. The
 * tints mix toward `transparent` (not white/black) so they read correctly over
 * both the light and dark page backgrounds — this inline style applies to both.
 */
edge.global('brandStyle', (project?: ProjectConfig) => {
  if (!project) return ''
  const c = project.color
  return [
    `--brand:${c}`,
    `--top-accent:${c}`,
    `--border-brand:${c}`,
    `--link:${c}`,
    `--brand-hover:color-mix(in srgb, ${c}, #000 12%)`,
    `--brand-ink:color-mix(in srgb, ${c}, #000 26%)`,
    `--link-hover:color-mix(in srgb, ${c}, #000 26%)`,
    `--brand-tint:color-mix(in srgb, ${c} 12%, transparent)`,
    `--bg-tint:color-mix(in srgb, ${c} 6%, transparent)`,
    `--shadow-brand:0 6px 20px color-mix(in srgb, ${c} 28%, transparent)`,
  ].join(';')
})

/**
 * Per-project Umami tag params, or null when analytics is inactive (non-production,
 * no script URL configured, or the project carries no id). Rendered by
 * `partials/analytics.edge`; the prod flag + shared script URL are injected here so
 * the helper in `#values/analytics` stays pure and unit-testable.
 */
edge.global('analyticsTag', (project?: ProjectConfig) =>
  umamiTag(project, { enabled: app.inProduction, scriptUrl: env.get('UMAMI_SCRIPT_URL') ?? null })
)

/**
 * Resolves the full `<head>` metadata (title, description, canonical, Open Graph/Twitter) for a
 * page. Rendered by `partials/head.edge`, which passes the shared `project` + `currentPath` plus
 * any page-level overrides. Logic lives in `#values/site_meta` so it stays pure and unit-testable.
 */
edge.global('siteMeta', (page: PageMeta = {}) => resolveMeta(page))

/** Per-project favicon asset URLs, derived from the project key — see `partials/head.edge`. */
edge.global('iconPaths', (key: string) => iconPaths(key))

// Builds the segmented additions/deletions diff bar (5 cells) for a commit.
edge.global('diffBar', (additions: number, deletions: number) => {
  const total = Math.max(additions + deletions, 1)
  const segments = 5
  const add = Math.round((additions / total) * segments)
  const del = Math.min(segments - add, Math.ceil((deletions / total) * segments))
  const none = Math.max(segments - add - del, 0)
  const cells = [...Array(add).fill('add'), ...Array(del).fill('del'), ...Array(none).fill('none')]
  return cells.map((kind) => `<span class="diffbar__c diffbar__c--${kind}"></span>`).join('')
})
