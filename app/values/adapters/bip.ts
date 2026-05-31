/**
 * All BIP-specific code lives here. BIPs carry an RFC-2822 `Key: value` preamble inside a
 * `<pre>…</pre>` block (mediawiki) or a leading ```` ``` ```` fence (markdown), and cite other
 * BIPs as `BIP-0032` / `BIP 141` / `[[32]]`.
 */
import type { CheerioAPI } from 'cheerio'
import type { ProjectAdapter } from '#types/project_adapter'
import type { Preamble } from '#types/preamble'
import { cleanAuthor, extractLabelledReferences, rewriteSpecLinks } from '#values/adapters/shared'

/** Link to a BIP spec file; group 1 = raw number, group 2 = optional `#fragment`. */
const LINK_PATTERN = /^bip-0*([0-9]+)\.(?:mediawiki|md)(#.*)?$/i

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
    return extractLabelledReferences(raw, 'BIP')
  },

  rewriteInternalLinks($: CheerioAPI, numberBase: 10 | 16): void {
    rewriteSpecLinks($, LINK_PATTERN, numberBase)
  },
}
