/**
 * Pure, project-agnostic post-processing of Pandoc's HTML output, run at sync by RenderingService.
 * Operates on a loaded Cheerio document in place (anchors, image rewrites) and derives the
 * navigable TOC and the plain-text projection. Internal-link rewriting is project-specific and
 * lives in each adapter (`rewriteInternalLinks`). Anchor ids and TOC links come from one `slugify`
 * so deep links and the scroll-spy stay aligned; transforms are deterministic for the hash cache.
 */
import type { CheerioAPI } from 'cheerio'

/** Stable, lowercase anchor slug — the single source shared by headings and the TOC. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type TocItem = { level: 2 | 3; id: string; text: string }

function buildTocHtml(items: TocItem[]): string {
  let html = '<ul>'
  let inSub = false
  items.forEach((item, i) => {
    if (item.level === 2) {
      if (inSub) {
        html += '</ul></li>'
        inSub = false
      } else if (i > 0) {
        html += '</li>'
      }
      html += `<li><a href="#${item.id}">${escapeHtml(item.text)}</a>`
    } else {
      if (!inSub) {
        if (i === 0) {
          html += '<li>'
        }
        html += '<ul>'
        inSub = true
      }
      html += `<li><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`
    }
  })
  html += inSub ? '</ul></li></ul>' : '</li></ul>'
  return html
}

/**
 * Assign deterministic, deduplicated ids to every `h2`/`h3`, append a hover anchor link beside
 * each, and return a nested TOC (`<ul>`) of links to those same ids. Empty string when the
 * document has no such headings.
 */
export function assignAnchorsAndBuildToc($: CheerioAPI): string {
  const used = new Map<string, number>()
  const items: TocItem[] = []

  $('h2, h3').each((_, el) => {
    const $el = $(el)
    const text = $el.text().trim()
    const base = slugify(text) || 'section'
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    const id = seen === 0 ? base : `${base}-${seen + 1}`

    $el.attr('id', id)
    $el.prepend(`<a class="bips-anchor" href="#${id}" aria-hidden="true">#</a> `)
    items.push({ level: $el.is('h3') ? 3 : 2, id, text })
  })

  return items.length === 0 ? '' : buildTocHtml(items)
}

/** Rewrite relative image sources onto the repo's raw base; absolute and data URIs untouched. */
export function rewriteImages($: CheerioAPI, imageBaseUrl: string): void {
  $('img[src]').each((_, el) => {
    const $el = $(el)
    const src = $el.attr('src') ?? ''
    if (/^(https?:|data:|\/\/)/i.test(src)) {
      return
    }
    $el.attr('src', new URL(src, imageBaseUrl).toString())
  })
}

/** Plain-text projection of the document — markup stripped, whitespace collapsed. */
export function extractText($: CheerioAPI): string {
  return $.root().text().replace(/\s+/g, ' ').trim()
}
