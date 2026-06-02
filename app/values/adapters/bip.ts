/**
 * All BIP-specific code lives here — both DATA (parsing the RFC-2822 `<pre>`/fenced preamble, body,
 * references, internal links) and DISPLAY (turning a stored Document into the shared slot contract).
 * BIPs carry `Key: value` metadata, a colored Status, Type/Layer header chips, an authors list, and
 * a `Created` date in the preamble; they cite other BIPs as `BIP-0032` / `BIP 141` / `[[32]]`.
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
  cleanAuthor,
  extractSpecReferences,
  rewriteSpecLinks,
  scalar,
  toAuthorList,
} from '#values/adapters/shared'

/** Link to a BIP spec file; group 1 = raw number, group 2 = optional `#fragment`. */
const LINK_PATTERN = /^bip-0*([0-9]+)\.(?:mediawiki|md)(#.*)?$/i

/** BIP status vocabulary → design-system tone. Unknown/absent → neutral. */
const STATUS_TONE: Record<string, BadgeTone> = {
  Active: 'positive',
  Final: 'positive',
  Deployed: 'accent',
  Complete: 'accent',
  Draft: 'caution',
  Proposed: 'caution',
  Closed: 'neutral',
  Withdrawn: 'neutral',
  Rejected: 'neutral',
  Replaced: 'neutral',
  Obsolete: 'neutral',
}

/** Standfirst shown above the BIP catalog (was the inline `project.key === 'bips'` template branch). */
const INTRO_HTML = `<p>
  People wishing to submit BIPs first should propose their idea or document to the
  <a class="bips-link" href="https://groups.google.com/g/bitcoindev" target="_blank" rel="noreferrer">bitcoin-dev mailing list</a>.
  After discussion, please open a PR. After copy-editing and acceptance, it will be published here.
</p>
<p>
  Having a BIP here does not make it a formally accepted standard until its status becomes
  <strong>Final</strong> or <strong>Active</strong>.
</p>`

/** The status Badge for a document, or undefined when it has no status. */
function statusBadge(preamble: Preamble): Badge | undefined {
  const status = scalar(preamble.Status)
  if (!status) {
    return undefined
  }
  return { label: status, tone: STATUS_TONE[status] ?? 'neutral' }
}

/**
 * Locate a BIP's leading preamble block and the body after it. BIPs ship in two formats: the
 * mediawiki form wraps the preamble in `<pre>…</pre>`, the markdown form in a leading ```` ``` ````
 * fence. The inner `Key: value` structure is identical, so only the delimiter differs.
 */
function splitPreamble(raw: string): { block: string; body: string } {
  const pre = raw.match(/<pre>([\s\S]*?)<\/pre>\s*/i)
  if (pre) {
    return { block: pre[1], body: raw.slice(pre.index! + pre[0].length) }
  }
  const fence = raw.match(/^\s*```[^\n]*\n([\s\S]*?)\n```[ \t]*\r?\n?/)
  if (fence) {
    return { block: fence[1], body: raw.slice(fence.index! + fence[0].length) }
  }
  return { block: '', body: raw }
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

export const bipAdapter: ProjectAdapter = {
  id: 'bip',

  /**
   * BIP preamble: a leading block of RFC-2822 `Key: value` lines (in a `<pre>` or ```` ``` ````
   * fence), where a line indented with whitespace continues the previous key's value (extra authors).
   */
  parsePreamble(raw: string): { title: string; preamble: Preamble } {
    const { block } = splitPreamble(raw)
    const lines = block.split(/\r?\n/)

    const fields: Record<string, string[]> = {}
    let currentKey: string | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }
      // BIP preambles indent every line, so trim first: a `Key: value` line opens a field;
      // any other non-empty line continues the current field (e.g. extra authors).
      const kv = trimmed.match(/^([A-Za-z][A-Za-z- ]*?):\s*(.*)$/)
      if (kv) {
        currentKey = kv[1].trim()
        fields[currentKey] = kv[2].trim() ? [kv[2].trim()] : []
      } else if (currentKey) {
        fields[currentKey].push(trimmed)
      }
    }

    const preamble: Preamble = {}
    for (const [key, values] of Object.entries(fields)) {
      if (key === 'Author' || key === 'Authors') {
        // Canonical key `Author` regardless of the source spelling (some BIPs use `Authors`).
        preamble.Author = values
          .flatMap((v) => v.split(','))
          .map(cleanAuthor)
          .filter(Boolean)
      } else {
        preamble[key] = values.join(' ')
      }
    }

    const title = typeof preamble.Title === 'string' ? preamble.Title : ''
    return { title, preamble }
  },

  /** Drop the leading `<pre>` (or ```` ``` ````) preamble block; the preamble lives in metadata. */
  extractBody(raw: string): string {
    return splitPreamble(raw).body
  },

  extractReferences(raw: string): string[] {
    return extractSpecReferences(raw, 'BIP', LINK_PATTERN)
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
    const badge = statusBadge(preamble)

    const headerChips = (['Type', 'Layer'] as const).flatMap((key) => {
      const value = scalar(preamble[key])
      return value ? [{ label: key, value }] : []
    })

    const aboutSlots: DocumentView['aboutSlots'] = []
    const authors = toAuthorList(preamble.Author)
    if (authors.length) {
      aboutSlots.push({ type: 'authors', label: 'Authors', authors })
    }
    const created = scalar(preamble.Created)
    if (created) {
      aboutSlots.push({ type: 'date', label: 'Created', display: created })
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

    const rows = Object.entries(preamble).map(([label, value]) => ({
      label,
      value: Array.isArray(value) ? value.join(', ') : value,
    }))

    return {
      eyebrow: `${project.specLabel} ${document.number}`,
      title: document.title,
      badges: badge ? [badge] : [],
      headerChips,
      aboutSlots,
      preamble: { show: true, rows },
      related: [
        ...relatedOut.map((spec) => relatedSpec(spec, project, 'out')),
        ...relatedIn.map((spec) => relatedSpec(spec, project, 'in')),
      ],
    }
  },

  buildCatalogView(_project: ProjectConfig, documents: Document[]): CatalogView {
    const columns = [{ label: 'Status' }, { label: 'Type' }, { label: 'Layer' }]

    const rows = documents.map((doc) => {
      const preamble = doc.preambleData
      const badge = statusBadge(preamble)
      return {
        number: doc.number,
        title: doc.title,
        filterKey: scalar(preamble.Status),
        cells: [
          { type: 'badges' as const, badges: badge ? [badge] : [] },
          { type: 'text' as const, value: scalar(preamble.Type) },
          { type: 'text' as const, value: scalar(preamble.Layer) },
        ],
      }
    })

    const filters = [...new Set(rows.map((r) => r.filterKey).filter(Boolean))].map((status) => ({
      key: status as string,
      label: status as string,
    }))

    return { introHtml: INTRO_HTML, columns, rows, filters, total: documents.length }
  },

  buildSearchRecord(_project: ProjectConfig, document: Document): SearchRecord {
    const preamble = document.preambleData
    return {
      id: document.id,
      project: document.project,
      number: document.number,
      title: document.title,
      authors: toAuthorList(preamble.Author),
      content_text: document.contentText ?? '',
      status: scalar(preamble.Status),
      type: scalar(preamble.Type),
      layer: scalar(preamble.Layer),
    }
  },

  buildSearchHit(
    project: ProjectConfig,
    record: SearchRecord,
    formatted: Partial<SearchRecord> | undefined
  ): SearchHitView {
    const authors = record.authors ?? []
    const authorsHtml = (formatted?.authors as string[] | undefined) ?? authors
    const badge: Badge | undefined = record.status
      ? { label: record.status, tone: STATUS_TONE[record.status] ?? 'neutral' }
      : undefined
    const meta = [record.type, record.layer].filter(Boolean).join(' · ') || undefined
    return {
      number: record.number,
      eyebrow: `${project.specLabel} ${record.number}`,
      titleHtml: formatted?.title ?? record.title,
      excerptHtml: (formatted?.content_text as string | undefined) ?? '',
      badges: badge ? [badge] : [],
      meta,
      authors: authors.map((name, index) => ({ name, html: authorsHtml[index] ?? name })),
    }
  },
}
