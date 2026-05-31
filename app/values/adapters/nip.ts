/**
 * All NIP-specific code lives here. NIPs have no `<pre>` block: the descriptive title is the first
 * heading that isn't the `NIP-<n>` label, and a leading line of backtick-wrapped tokens
 * (`` `draft` `mandatory` ``) is the classification — first tag = Status, the rest = Tags. NIPs
 * cite other NIPs as `NIP-12` / `[[12]]`, and number files in hex (`0a.md`).
 */
import type { CheerioAPI } from 'cheerio'
import type { ProjectAdapter } from '#types/project_adapter'
import type { Preamble } from '#types/preamble'
import {
  extractLabelledReferences,
  markdownHeadings,
  rewriteSpecLinks,
} from '#values/adapters/shared'

/** Link to a NIP spec file; group 1 = raw hex number, group 2 = optional `#fragment`. */
const LINK_PATTERN = /^0*([0-9a-f]+)\.md(#.*)?$/i

/** First line made only of backtick-wrapped tokens (the NIP classification tags), or `[]`. */
function tags(raw: string): string[] {
  const line = raw.match(/^[ \t]*((?:`[^`]+`[ \t]*)+)$/m)
  return line ? [...line[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]) : []
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
    const classification = tags(raw)
    if (classification.length) {
      preamble.Status = classification[0]
      if (classification.length > 1) {
        preamble.Tags = classification.slice(1)
      }
    }

    return { title, preamble }
  },

  /**
   * Drop the NIP front matter (shown in the header, not the body): the `NIP-<n>` label heading,
   * the title heading (ATX or setext), and the classification tag line.
   */
  extractBody(raw: string): string {
    return raw
      .replace(/^\s*NIP-[0-9a-fA-F]+[ \t]*\r?\n=+[ \t]*\r?\n/i, '')
      .replace(/^\s*#\s*NIP-[0-9a-fA-F]+[ \t]*\r?\n/i, '')
      .replace(/^\s*\S.*?[ \t]*\r?\n[=-]+[ \t]*\r?\n/, '')
      .replace(/^\s*#{1,6}\s+.+\r?\n/, '')
      .replace(/^\s*(?:`[^`]+`[ \t]*)+\r?\n/, '')
  },

  extractReferences(raw: string): string[] {
    return extractLabelledReferences(raw, 'NIP')
  },

  rewriteInternalLinks($: CheerioAPI, numberBase: 10 | 16): void {
    rewriteSpecLinks($, LINK_PATTERN, numberBase)
  },
}
