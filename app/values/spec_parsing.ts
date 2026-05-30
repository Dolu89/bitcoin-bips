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
 * BIP preamble: a leading `<pre>` block of RFC-2822 `Key: value` lines, where a line
 * indented with whitespace continues the previous key's value (used for multiple authors).
 */
function parseBipPreamble(raw: string): { title: string; preamble: Preamble } {
  const match = raw.match(/<pre>([\s\S]*?)<\/pre>/i)
  const block = match ? match[1] : ''
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
      preamble[key] = values
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

/** NIP preamble: title from the first `# H1`, dropping a leading `NIP-<n>:` label. */
function parseNipPreamble(raw: string): { title: string; preamble: Preamble } {
  const heading = raw.match(/^#\s+(.+)$/m)
  const rawTitle = heading ? heading[1].trim() : ''
  const title = rawTitle.replace(/^NIP-[0-9a-fA-F]+\s*:\s*/, '').trim()
  return { title, preamble: {} }
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
