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

/**
 * MediaWiki external-link syntax `[url text]` only linkifies when `url` carries a protocol, so a
 * repo-root-relative path — e.g. `[/bip-0119/vectors the bip-0119/vectors directory]` in BIP 119,
 * or `[/bip-0075/paymentrequest.proto paymentrequest.proto]` in BIP 75 — is emitted as literal
 * bracketed text. Rewrite each to an absolute GitHub URL so Pandoc renders a real external link:
 * `/blob/` for a file (a trailing `.ext` in the last segment), `/tree/` for a directory.
 * `repoBlobBase` is the repo-root blob base (`https://github.com/<owner>/<repo>/blob/<branch>/`).
 */
export function linkifyRootRelativeLinks(raw: string, repoBlobBase: string): string {
  const treeBase = repoBlobBase.replace('/blob/', '/tree/')
  // `[/path` then whitespace (may span lines) then the link text up to the closing `]`.
  return raw.replace(
    /\[\/([^\s\]]+)[ \t\r\n]+([^\]]+?)\]/g,
    (_whole, path: string, text: string) => {
      const base = /\.[a-z0-9]+$/i.test(path) ? repoBlobBase : treeBase
      return `[${base}${path} ${text.replace(/\s+/g, ' ').trim()}]`
    }
  )
}
