import type { ProjectConfig } from '#types/project'

/** Site name shown when no project is resolved (unknown host / pre-project errors). */
const SITE_FALLBACK = 'Specs'

/** Per-page inputs; every field is optional so callers pass only what differs from the project defaults. */
export type PageMeta = {
  project?: ProjectConfig
  /** Request path (no query) used to build the canonical/`og:url`. Defaults to `/`. */
  path?: string
  /** Page title core, e.g. `BIP 32 - HD Wallets`. Omit on the home page (→ `<site> — <tagline>`). */
  title?: string
  /** Page description override. Falls back to the project description. */
  description?: string
  /** Social image override (path or absolute URL). Falls back to the project's `ogImage`. */
  ogImage?: string
  /** `website` (default) or `article` (a single spec). */
  ogType?: string
}

/** Fully resolved `<head>` metadata — pure data, rendered by `partials/head.edge`. */
export type ResolvedMeta = {
  title: string
  description: string
  siteName: string
  canonical: string | null
  ogType: string
  ogImage: string | null
  twitterCard: 'summary' | 'summary_large_image'
  themeColor: string | null
}

/** Per-project favicon asset URLs, derived by convention from the project key. */
export type IconPaths = {
  ico: string
  svg: string
  png32: string
  apple: string
  manifest: string
}

/** Static asset URLs for a project's favicon set. `/favicon.ico` is served per-host by `FaviconController`. */
export function iconPaths(key: string): IconPaths {
  const dir = `/icons/${key}`
  return {
    ico: '/favicon.ico',
    svg: `${dir}/favicon.svg`,
    png32: `${dir}/icon-32.png`,
    apple: `${dir}/icon-180.png`,
    manifest: `${dir}/site.webmanifest`,
  }
}

/** Absolute URL from a path on the project domain; passes through values already absolute; null if unresolvable. */
function absolute(base: string | null, href?: string | null): string | null {
  if (!href) return null
  if (/^https?:\/\//.test(href)) return href
  if (!base) return null
  return base + (href.startsWith('/') ? href : `/${href}`)
}

/** Strip query/hash and trailing slashes (keeping root) so canonical URLs are stable. */
function normalizePath(path: string): string {
  const noQuery = path.split('?')[0].split('#')[0]
  const trimmed = noQuery.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/**
 * Resolve the full head metadata for a page from the request's project + per-page overrides.
 * Pure and project-agnostic: every per-project value comes from `ProjectConfig`, never from a
 * branch on project identity. With no project (unknown host) it degrades to a title-only result
 * with no canonical/image — the no-context error path.
 */
export function resolveMeta(page: PageMeta = {}): ResolvedMeta {
  const { project } = page
  const siteName = project?.name ?? SITE_FALLBACK
  // The expanded brand name is the title suffix — it lifts otherwise-short titles (a bare acronym
  // or a terse spec title) into the ~50-60 char range search engines and social cards prefer.
  const fullName = project?.fullName ?? siteName
  const base = project ? `https://${project.domain}` : null

  // Inner pages read `<page> — <full name>`; the home page (no title) leads with the full name.
  const title = page.title
    ? `${page.title} — ${fullName}`
    : project
      ? `${fullName} (${siteName}) — searchable index`
      : SITE_FALLBACK

  const description = page.description ?? project?.description ?? project?.tagline ?? ''
  const canonical = base ? base + normalizePath(page.path ?? '/') : null
  const ogImage = absolute(base, page.ogImage ?? project?.ogImage)

  return {
    title,
    description,
    siteName,
    canonical,
    ogType: page.ogType ?? 'website',
    ogImage,
    twitterCard: ogImage ? 'summary_large_image' : 'summary',
    themeColor: project?.color ?? null,
  }
}
