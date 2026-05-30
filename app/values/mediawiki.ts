/**
 * Pre-Pandoc normalization of MediaWiki source. Pandoc's mediawiki reader supports `<ref>`
 * citations only as a single-line inline element; real BIPs use multi-line / block ref bodies
 * (and the occasional malformed `name"x"` attribute), which make the reader fail with a parse
 * error. We repair the attribute and flatten each ref to one line so its footnote content
 * survives, and drop the `<references/>` placeholder (Pandoc emits its own footnotes section).
 */
export function normalizeForPandoc(raw: string): string {
  return (
    raw
      // Repair a cite attribute missing its `=` (e.g. `<ref name"foo">` → `<ref name="foo">`).
      .replace(/<ref(\s+[a-z]+)"([^"]*)"/gi, '<ref$1="$2"')
      // Collapse each ref's inner whitespace to a single line so block bodies parse as footnotes.
      .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, (m) => m.replace(/\s*\n\s*/g, ' ').trim())
      // Drop the MediaWiki references placeholders — Pandoc appends its own footnotes section.
      .replace(/<references\b[^>]*\/>/gi, '')
      .replace(/<references\b[^>]*>[\s\S]*?<\/references>/gi, '')
  )
}
