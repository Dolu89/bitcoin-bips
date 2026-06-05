import { test } from '@japa/runner'
import { spawnSync } from 'node:child_process'
import app from '@adonisjs/core/services/app'
import PandocService from '#services/pandoc_service'

function pandocMissing(): boolean {
  try {
    return spawnSync('pandoc', ['--version']).status !== 0
  } catch {
    return true
  }
}

test.group('services/pandoc_service toHtml', () => {
  test('converts mediawiki to HTML', async ({ assert }) => {
    const svc = await app.container.make(PandocService)

    const html = await svc.toHtml('== Motivation ==\nText.', 'mediawiki')

    assert.match(html, /<h2[^>]*>Motivation/)
    assert.include(html, 'Text.')
  }).skip(pandocMissing(), 'pandoc not on PATH')

  test('converts GitHub markdown to HTML without token spans', async ({ assert }) => {
    const svc = await app.container.make(PandocService)

    const html = await svc.toHtml('## Goals\n\n```js\nconst a = 1\n```', 'markdown')

    assert.match(html, /<h2[^>]*>Goals/)
    assert.include(html, 'const a = 1')
    assert.notInclude(html, '<span')
  }).skip(pandocMissing(), 'pandoc not on PATH')

  test('renders a multi-line / malformed mediawiki <ref> as a footnote without failing', async ({
    assert,
  }) => {
    const svc = await app.container.make(PandocService)

    const html = await svc.toHtml(
      '== T ==\nA.<ref>\n  multi\n  line note\n</ref> B.<ref name"y">second</ref>\n\n<references/>',
      'mediawiki'
    )

    assert.include(html, 'class="footnote-ref"')
    assert.include(html, 'multi line note')
    assert.notInclude(html, '<references')
  }).skip(pandocMissing(), 'pandoc not on PATH')

  test('emits a real <img> (keeping its alt) instead of escaping the raw tag to text', async ({
    assert,
  }) => {
    const svc = await app.container.make(PandocService)

    const html = await svc.toHtml(
      '== T ==\n\n<img src="bip-0052/x.png" alt="A chart">',
      'mediawiki'
    )

    assert.match(html, /<img[^>]*\bsrc="bip-0052\/x\.png"/)
    assert.include(html, 'alt="A chart"')
    assert.notInclude(html, '&lt;img')
  }).skip(pandocMissing(), 'pandoc not on PATH')
})

test.group('services/pandoc_service toMarkdown', () => {
  test('toMarkdown converts MediaWiki to GFM and returns a Markdown source unchanged')
    .with([
      { raw: '== Motivation ==\nText.', format: 'mediawiki' as const, verbatim: false },
      { raw: '## Goals\n\nBody.', format: 'markdown' as const, verbatim: true },
    ])
    .run(async ({ assert }, { raw, format, verbatim }) => {
      const svc = await app.container.make(PandocService)

      const md = await svc.toMarkdown(raw, format)

      if (verbatim) {
        assert.equal(md, raw)
      } else {
        assert.match(md, /^##\s+Motivation/m)
        assert.include(md, 'Text.')
      }
    })
    .skip(pandocMissing(), 'pandoc not on PATH')

  test('keeps a raw <img> as inline HTML rather than escaping it to \\<img\\> text', async ({
    assert,
  }) => {
    const svc = await app.container.make(PandocService)

    const md = await svc.toMarkdown('<img src="bip-0052/x.png" alt="A chart">', 'mediawiki')

    assert.include(md, '<img src="bip-0052/x.png" alt="A chart">')
    assert.notInclude(md, '\\<img')
  }).skip(pandocMissing(), 'pandoc not on PATH')
})
