import type { DateTime } from 'luxon'
import type Document from '#models/document'
import type { ProjectConfig } from '#types/project'

/** Escape the five XML predefined entities in a `<loc>` value (defensive — inputs are clean). */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** One `<url>` block: a `<loc>` and, when a timestamp is known, a W3C-datetime `<lastmod>`. */
function urlEntry(loc: string, lastmod: DateTime | null): string {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod.toISO()}</lastmod>` : ''
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodTag}\n  </url>`
}

/**
 * Build the project's `sitemap.xml` body from its documents: the home URL plus one URL per spec,
 * all on the project's own domain. Each spec carries its own `lastmod`; the home carries the
 * catalog's most-recent update (`lastUpdate`). An empty catalog with no `lastUpdate` yields a valid
 * minimal sitemap — the home URL alone, no `lastmod`. Pure — callers own the DB query and headers.
 */
export function sitemapXml(
  project: ProjectConfig,
  documents: Document[],
  lastUpdate: DateTime | null
): string {
  const base = `https://${project.domain}`

  const entries = [
    urlEntry(`${base}/`, lastUpdate),
    ...documents.map((doc) => urlEntry(`${base}/${doc.number}`, doc.updatedAt)),
  ]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}
