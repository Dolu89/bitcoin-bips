/**
 * Turns a spec's raw source into display-ready content at sync time: Pandoc converts to HTML,
 * then pure post-processing anchors sections + builds the TOC, rewrites intra-project links and
 * relative images, and Shiki highlights fenced code (light + dark). Also yields a plain-text
 * projection for the summary and future search. Pure-output: persistence is the caller's job.
 */
import { inject } from '@adonisjs/core'
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import { codeToHtml } from 'shiki'
import PandocService from '#services/pandoc_service'
import { linkifyRootRelativeLinks } from '#values/mediawiki'
import {
  assignAnchorsAndBuildToc,
  rewriteImages,
  rewriteRelativeLinks,
  extractText,
} from '#values/html_postprocess'
import type { ProjectAdapter } from '#types/project_adapter'

export type RenderInput = {
  raw: string
  format: 'mediawiki' | 'markdown'
  /** The project's adapter — supplies project-specific internal-link rewriting. */
  adapter: ProjectAdapter
  numberBase: 10 | 16
  imageBaseUrl: string
  /** GitHub blob base for the file's directory — non-spec relative links resolve against it. */
  linkBaseUrl: string
  /** GitHub blob base at the repo root — repo-root-relative (`/path`) mediawiki links resolve here. */
  repoBlobBaseUrl: string
}

export type RenderedContent = {
  contentHtml: string
  contentText: string
  toc: string
}

const THEMES = { light: 'github-light', dark: 'one-dark-pro' } as const

@inject()
export default class RenderingService {
  constructor(protected pandoc: PandocService) {}

  async render(input: RenderInput): Promise<RenderedContent> {
    // Repair repo-root-relative mediawiki external links before Pandoc, which would otherwise emit
    // them as literal bracketed text (the `[url text]` syntax needs a protocol).
    const raw =
      input.format === 'mediawiki'
        ? linkifyRootRelativeLinks(input.raw, input.repoBlobBaseUrl)
        : input.raw
    const html = await this.pandoc.toHtml(raw, input.format)
    const $ = cheerio.load(html, null, false)

    input.adapter.rewriteInternalLinks($, input.numberBase)
    rewriteRelativeLinks($, input.linkBaseUrl)
    rewriteImages($, input.imageBaseUrl)

    // Plain text before anchor links are appended, so the `#` markers stay out of the projection.
    const contentText = extractText($)
    const toc = assignAnchorsAndBuildToc($)
    await this.highlightCode($)

    return { contentHtml: $.html(), contentText, toc }
  }

  /** Replace each `<pre>` code block with Shiki's dual-theme output; unknown langs fall back. */
  private async highlightCode($: CheerioAPI): Promise<void> {
    const blocks = $('pre').toArray()
    for (const pre of blocks) {
      const $pre = $(pre)
      const $code = $pre.children('code').first()
      const code = ($code.length ? $code : $pre).text().replace(/\n$/, '')
      const classes = (($code.attr('class') || $pre.attr('class')) ?? '').split(/\s+/)
      let lang = classes.find((c) => c && c !== 'sourceCode' && c !== 'numberLines') ?? ''
      if (!lang) {
        // Many specs fence JSON examples without a language tag; infer it so they get colored.
        const head = code.trimStart()[0]
        lang = head === '{' || head === '[' ? 'jsonc' : 'text'
      }

      let highlighted: string
      try {
        highlighted = await codeToHtml(code, { lang, themes: THEMES })
      } catch {
        highlighted = await codeToHtml(code, { lang: 'text', themes: THEMES })
      }
      $pre.replaceWith(highlighted)
    }
  }
}
