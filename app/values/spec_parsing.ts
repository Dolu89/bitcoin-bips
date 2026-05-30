/**
 * Pure, per-project parsing of a spec's raw source into title + preamble, and the raw
 * cross-references it cites. Keyed on `ProjectConfig.parser`; a new project with different
 * conventions adds an additive branch without touching existing ones.
 */
import type { Preamble } from '#types/preamble'

export type ParserKind = 'bip' | 'nip'

/** Strip contact noise (`<email>`, `(handle)`) and trim a single author token. */
function cleanAuthor(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
}

/**
 * Locate a BIP's leading preamble block and the body after it. BIPs ship in two formats: the
 * mediawiki form wraps the preamble in `<pre>…</pre>`, the markdown form in a leading ```` ``` ````
 * fence. The inner `Key: value` structure is identical, so only the delimiter differs.
 */
function splitBipPreamble(raw: string): { block: string; body: string } {
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

/**
 * BIP preamble: a leading block of RFC-2822 `Key: value` lines (in a `<pre>` or ```` ``` ````
 * fence), where a line indented with whitespace continues the previous key's value (extra authors).
 */
function parseBipPreamble(raw: string): { title: string; preamble: Preamble } {
  const { block } = splitBipPreamble(raw)
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
      // Canonical key `Author` regardless of the source spelling (some BIPs use `Authors`),
      // so the per-project display config resolves it.
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
}

/** Ordered heading texts of a markdown doc, covering both ATX (`#`) and setext (`===`/`---`). */
function nipHeadings(raw: string): string[] {
  const found: { index: number; text: string }[] = []
  for (const m of raw.matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*$/gm)) {
    found.push({ index: m.index ?? 0, text: m[1].trim() })
  }
  for (const m of raw.matchAll(/^[ \t]*(\S.*?)[ \t]*\r?\n[ \t]*([=-])\2*[ \t]*$/gm)) {
    found.push({ index: m.index ?? 0, text: m[1].trim() })
  }
  return found.sort((a, b) => a.index - b.index).map((h) => h.text)
}

/** First line made only of backtick-wrapped tokens (the NIP classification tags), or `[]`. */
function nipTags(raw: string): string[] {
  const line = raw.match(/^[ \t]*((?:`[^`]+`[ \t]*)+)$/m)
  return line ? [...line[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]) : []
}

/**
 * NIP preamble: NIPs have no `<pre>` block. The descriptive title is the first heading that
 * isn't the `NIP-<n>` label (ATX or setext); the classification line (`` `draft` `mandatory` ``)
 * becomes Status (first tag) + Tags (the rest).
 */
function parseNipPreamble(raw: string): { title: string; preamble: Preamble } {
  let title = ''
  for (const heading of nipHeadings(raw)) {
    const stripped = heading.replace(/^NIP-[0-9a-fA-F]+\s*:?\s*/i, '').trim()
    if (stripped) {
      title = stripped
      break
    }
  }

  const preamble: Preamble = {}
  const tags = nipTags(raw)
  if (tags.length) {
    preamble.Status = tags[0]
    if (tags.length > 1) {
      preamble.Tags = tags.slice(1)
    }
  }

  return { title, preamble }
}

/** Dispatch preamble parsing on the project's parser strategy. */
export function parsePreamble(
  parser: ParserKind,
  raw: string
): { title: string; preamble: Preamble } {
  return parser === 'bip' ? parseBipPreamble(raw) : parseNipPreamble(raw)
}

/**
 * Raw cross-references a spec cites. Returns raw number strings (e.g. `0032`, `141`, `32`)
 * — canonicalization is the caller's responsibility. Forms: `BIP-0032`, `BIP 141`, `NIP-12`,
 * `[[32]]`. De-duplicated, order preserved.
 */
export function extractReferences(parser: ParserKind, raw: string): string[] {
  const label = parser === 'bip' ? 'BIP' : 'NIP'
  const found: string[] = []
  const seen = new Set<string>()
  const push = (n: string) => {
    if (!seen.has(n)) {
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

  return found
}

/**
 * The spec body to render — the preamble lives in metadata, not the content. For BIPs that drops
 * the leading `<pre>` preamble block; for NIPs the leading `# H1` title (shown in the header).
 */
export function extractBody(parser: ParserKind, raw: string): string {
  if (parser === 'bip') {
    return splitBipPreamble(raw).body
  }
  // NIP front matter (shown in the header, not the body): the `NIP-<n>` label heading, the
  // title heading (ATX or setext), and the classification tag line.
  return raw
    .replace(/^\s*NIP-[0-9a-fA-F]+[ \t]*\r?\n=+[ \t]*\r?\n/i, '')
    .replace(/^\s*#\s*NIP-[0-9a-fA-F]+[ \t]*\r?\n/i, '')
    .replace(/^\s*\S.*?[ \t]*\r?\n[=-]+[ \t]*\r?\n/, '')
    .replace(/^\s*#{1,6}\s+.+\r?\n/, '')
    .replace(/^\s*(?:`[^`]+`[ \t]*)+\r?\n/, '')
}
