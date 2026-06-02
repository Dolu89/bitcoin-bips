/**
 * Helpers shared across project adapters. These are the genuinely project-agnostic primitives —
 * author cleanup, heading scanning, the reference-extraction shape, and the internal-link
 * rewriting loop. Project-specific *choices* (which preamble keys exist, which link pattern, which
 * status tones) live in the adapters themselves (`app/values/adapters/<id>.ts`), never here.
 */
import type { CheerioAPI } from 'cheerio'
import { canonicalize } from '#values/document_number'

/** Strip contact noise (`<email>`, `(handle)`) and trim a single author token. */
export function cleanAuthor(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
}

/** First scalar of a preamble value that may be a string or string[] (undefined → undefined). */
export function scalar(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }
  return Array.isArray(value) ? value[0] : value
}

/** Normalize a preamble author value (string or list) into a clean list of names, emails stripped. */
export function toAuthorList(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return []
  }
  return (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(','))
    .map((author) => author.replace(/<[^>]*>/g, '').trim())
    .filter(Boolean)
}

/** Ordered heading texts of a markdown doc, covering both ATX (`#`) and setext (`===`/`---`). */
export function markdownHeadings(raw: string): string[] {
  const found: { index: number; text: string }[] = []
  for (const m of raw.matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*$/gm)) {
    found.push({ index: m.index ?? 0, text: m[1].trim() })
  }
  for (const m of raw.matchAll(/^[ \t]*(\S.*?)[ \t]*\r?\n[ \t]*([=-])\2*[ \t]*$/gm)) {
    found.push({ index: m.index ?? 0, text: m[1].trim() })
  }
  return found.sort((a, b) => a.index - b.index).map((h) => h.text)
}

/** Markdown `](target)` and mediawiki `[[target]]` / `[[target|label]]` link targets in raw source. */
function linkTargets(raw: string): string[] {
  const targets: string[] = []
  // Markdown inline links: `](target)` or `](<target> "title")`.
  for (const m of raw.matchAll(/\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)) {
    targets.push(m[1])
  }
  // Mediawiki wiki-links: `[[target]]` or `[[target|label]]`.
  for (const m of raw.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g)) {
    targets.push(m[1].trim())
  }
  return targets
}

/**
 * Raw cross-references a spec cites, for a given label (`BIP` / `NIP`). Returns raw number strings
 * (e.g. `0032`, `141`, `32`, `24`) — canonicalization is the caller's responsibility. Catches both
 * labelled prose (`BIP-0032`, `BIP 141`, `NIP-12`, `[[32]]`) AND links whose target resolves to a
 * sibling spec file per `linkPattern` (`[…](24.md#kind-0)`, `[[bip-0032.mediawiki]]`) — so a spec
 * referenced only via a link still lands in the related graph, matching the body's internal links.
 * A link to a non-spec repo file (e.g. `README.mediawiki`) does not match `linkPattern`, so it is
 * not treated as a reference. De-duplicated, order preserved.
 */
export function extractSpecReferences(raw: string, label: string, linkPattern: RegExp): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  const push = (n: string) => {
    if (n && !seen.has(n)) {
      seen.add(n)
      found.push(n)
    }
  }

  // `BIP-0032`, `BIP 141`, `BIP123`
  const labelled = new RegExp(`\\b${label}[-\\s]?(\\d+)\\b`, 'gi')
  for (const m of raw.matchAll(labelled)) {
    push(m[1])
  }
  // Wiki-style `[[32]]` / `[[bip-32]]`
  for (const m of raw.matchAll(/\[\[(?:bip-|nip-)?(\d+)\]\]/gi)) {
    push(m[1])
  }
  // Links pointing at a sibling spec file.
  for (const target of linkTargets(raw)) {
    const m = target.match(linkPattern)
    if (m) {
      push(m[1])
    }
  }

  return found
}

/**
 * Rewrite links to a spec file of the same project to the on-site URL (`/<number>`), preserving a
 * fragment. `pattern` (supplied by the adapter) matches the project's spec filenames with capture
 * group 1 = the raw number and group 2 = an optional `#fragment`. Leaves absolute (`http(s):`,
 * `//`), `mailto:`, and bare `#` anchors untouched.
 */
export function rewriteSpecLinks($: CheerioAPI, pattern: RegExp, numberBase: 10 | 16): void {
  $('a[href]').each((_, el) => {
    const $el = $(el)
    const href = $el.attr('href') ?? ''
    if (/^(https?:|mailto:|\/\/|#)/i.test(href)) {
      return
    }
    const match = href.match(pattern)
    if (!match) {
      return
    }
    const canonical = canonicalize(match[1], numberBase)
    if (canonical === null) {
      return
    }
    $el.attr('href', `/${canonical}${match[2] ?? ''}`)
  })
}
