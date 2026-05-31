/**
 * All NIP-specific code lives here — both DATA (parsing the heading title + backtick classification
 * line, body, references, hex internal links) and DISPLAY (turning a stored Document into the shared
 * slot contract). NIPs have no `<pre>` block: the title is the first non-`NIP-<n>` heading, and a
 * leading line of backtick tokens (`` `draft` `mandatory` ``) is Status (first) + Tags (the rest).
 * The functional tags (`mandatory`/`optional`) sit in the header; advisory tags (`unrecommended`,
 * `deprecated`, …) surface in the About rail. Created/Updated dates come from git, not the source.
 */
import type { CheerioAPI } from 'cheerio'
import type Document from '#models/document'
import type { ProjectConfig } from '#types/project'
import type { ProjectAdapter } from '#types/project_adapter'
import type { Preamble } from '#types/preamble'
import type { SearchRecord } from '#types/search'
import type {
  Badge,
  BadgeTone,
  CatalogView,
  DocumentView,
  RelatedSpec,
  SearchHitView,
} from '#types/view_models'
import {
  extractLabelledReferences,
  markdownHeadings,
  rewriteSpecLinks,
} from '#values/adapters/shared'

/** Link to a NIP spec file; group 1 = raw hex number, group 2 = optional `#fragment`. */
const LINK_PATTERN = /^0*([0-9a-f]+)\.md(#.*)?$/i

/** NIP status vocabulary (lowercase) → design-system tone. Unknown/absent → neutral. */
const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'caution',
  final: 'positive',
  deprecated: 'danger',
}

/** Classification-tag → tone. Advisory tags read as warnings; functional tags read as info. */
const TAG_TONE: Record<string, BadgeTone> = {
  unrecommended: 'danger',
  deprecated: 'danger',
  mandatory: 'info',
  optional: 'neutral',
}

/** Tags pinned to the header (functional classification); all others go to the About rail. */
const HEADER_TAGS = new Set(['mandatory', 'optional'])

/** First line made only of backtick-wrapped tokens (the NIP classification tags), or `[]`. */
function classificationTags(raw: string): string[] {
  const line = raw.match(/^[ \t]*((?:`[^`]+`[ \t]*)+)$/m)
  return line ? [...line[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]) : []
}

/** The Tags preamble value as a list (it is stored as string[] but may be absent/scalar). */
function tagList(preamble: Preamble): string[] {
  const value = preamble.Tags
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function badgeForTag(tag: string): Badge {
  return { label: tag, tone: TAG_TONE[tag] ?? 'neutral' }
}

/** The status Badge for a document, or undefined when it has no status. */
function statusBadge(preamble: Preamble): Badge | undefined {
  const status = Array.isArray(preamble.Status) ? preamble.Status[0] : preamble.Status
  if (!status) {
    return undefined
  }
  return { label: status, tone: STATUS_TONE[status] ?? 'neutral' }
}

/** Header badges: the status, then the functional (header-pinned) tags. */
function headerBadges(preamble: Preamble): Badge[] {
  const badges: Badge[] = []
  const status = statusBadge(preamble)
  if (status) {
    badges.push(status)
  }
  for (const tag of tagList(preamble)) {
    if (HEADER_TAGS.has(tag)) {
      badges.push(badgeForTag(tag))
    }
  }
  return badges
}

/** Build a related-spec view-model (eyebrow + status badge) in the given direction. */
function relatedSpec(spec: Document, project: ProjectConfig, direction: 'in' | 'out'): RelatedSpec {
  const badge = statusBadge(spec.preambleData)
  return {
    number: spec.number,
    eyebrow: `${project.specLabel} ${spec.number}`,
    title: spec.title,
    badges: badge ? [badge] : [],
    direction,
  }
}

export const nipAdapter: ProjectAdapter = {
  id: 'nip',

  /**
   * NIP preamble: the descriptive title is the first heading that isn't the `NIP-<n>` label (ATX
   * or setext); the classification line (`` `draft` `mandatory` ``) becomes Status (first tag) +
   * Tags (the rest).
   */
  parsePreamble(raw: string): { title: string; preamble: Preamble } {
    let title = ''
    for (const heading of markdownHeadings(raw)) {
      const stripped = heading.replace(/^NIP-[0-9a-fA-F]+\s*:?\s*/i, '').trim()
      if (stripped) {
        title = stripped
        break
      }
    }

    const preamble: Preamble = {}
    const tags = classificationTags(raw)
    if (tags.length) {
      preamble.Status = tags[0]
      if (tags.length > 1) {
        preamble.Tags = tags.slice(1)
      }
    }

    return { title, preamble }
  },

  /**
   * Drop the NIP front matter (shown in the header, not the body): the `NIP-<n>` label heading,
   * the title heading (ATX or setext), and the classification tag line. A leading blockquote
   * admonition (e.g. `> __Warning__ …` that some NIPs put above the title) is peeled off first and
   * re-prepended, so the warning survives while the front matter beneath it is still stripped.
   */
  extractBody(raw: string): string {
    const blockquote = raw.match(/^(?:[ \t]*>.*\r?\n?)+\r?\n*/)
    const prefix = blockquote ? blockquote[0] : ''
    const body = raw
      .slice(prefix.length)
      .replace(/^\s*NIP-[0-9a-fA-F]+[ \t]*\r?\n=+[ \t]*\r?\n/i, '')
      .replace(/^\s*#\s*NIP-[0-9a-fA-F]+[ \t]*\r?\n/i, '')
      .replace(/^\s*\S.*?[ \t]*\r?\n[=-]+[ \t]*\r?\n/, '')
      .replace(/^\s*#{1,6}\s+.+\r?\n/, '')
      .replace(/^\s*(?:`[^`]+`[ \t]*)+\r?\n/, '')
    return prefix + body
  },

  extractReferences(raw: string): string[] {
    return extractLabelledReferences(raw, 'NIP')
  },

  rewriteInternalLinks($: CheerioAPI, numberBase: 10 | 16): void {
    rewriteSpecLinks($, LINK_PATTERN, numberBase)
  },

  buildDocumentView(
    document: Document,
    project: ProjectConfig,
    relatedOut: Document[],
    relatedIn: Document[]
  ): DocumentView {
    const preamble = document.preambleData

    const aboutSlots: DocumentView['aboutSlots'] = []
    // Advisory tags (everything not pinned to the header) become a coloured badge slot.
    const advisory = tagList(preamble).filter((tag) => !HEADER_TAGS.has(tag))
    if (advisory.length) {
      aboutSlots.push({ type: 'badges', label: 'Tags', badges: advisory.map(badgeForTag) })
    }
    if (document.firstCommitAt) {
      aboutSlots.push({
        type: 'date',
        label: 'Created',
        display: document.firstCommitAt.toFormat('yyyy-LL-dd'),
      })
    }
    if (document.lastCommitAt) {
      aboutSlots.push({
        type: 'date',
        label: 'Updated',
        display: document.lastCommitAt.toFormat('yyyy-LL-dd'),
      })
    }
    aboutSlots.push({
      type: 'link',
      label: 'Source',
      href: document.sourceUrl,
      text: 'View on GitHub →',
      external: true,
    })

    return {
      eyebrow: `${project.specLabel} ${document.number}`,
      title: document.title,
      badges: headerBadges(preamble),
      headerChips: [],
      aboutSlots,
      // NIPs surface their whole (tiny) preamble in the header → the raw panel is redundant.
      preamble: { show: false, rows: [] },
      related: [
        ...relatedOut.map((spec) => relatedSpec(spec, project, 'out')),
        ...relatedIn.map((spec) => relatedSpec(spec, project, 'in')),
      ],
    }
  },

  buildCatalogView(project: ProjectConfig, documents: Document[]): CatalogView {
    const columns = [{ label: 'Status' }]

    const rows = documents.map((doc) => {
      const badge = statusBadge(doc.preambleData)
      return {
        number: doc.number,
        title: doc.title,
        filterKey: badge?.label,
        cells: [{ type: 'badges' as const, badges: badge ? [badge] : [] }],
      }
    })

    const filters = [...new Set(rows.map((r) => r.filterKey).filter(Boolean))].map((status) => ({
      key: status as string,
      label: status as string,
    }))

    return {
      introHtml: `<p>${project.tagline}</p>`,
      columns,
      rows,
      filters,
      total: documents.length,
    }
  },

  buildSearchRecord(_project: ProjectConfig, document: Document): SearchRecord {
    const preamble = document.preambleData
    return {
      id: document.id,
      project: document.project,
      number: document.number,
      title: document.title,
      authors: [],
      content_text: document.contentText ?? '',
      status: Array.isArray(preamble.Status) ? preamble.Status[0] : preamble.Status,
    }
  },

  buildSearchHit(
    project: ProjectConfig,
    record: SearchRecord,
    formatted: Partial<SearchRecord> | undefined
  ): SearchHitView {
    const badge: Badge | undefined = record.status
      ? { label: record.status, tone: STATUS_TONE[record.status] ?? 'neutral' }
      : undefined
    return {
      number: record.number,
      eyebrow: `${project.specLabel} ${record.number}`,
      titleHtml: formatted?.title ?? record.title,
      excerptHtml: (formatted?.content_text as string | undefined) ?? '',
      badges: badge ? [badge] : [],
      authors: [],
    }
  },
}
