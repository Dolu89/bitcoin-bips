import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import PandocService from '#services/pandoc_service'
import FakePandocService from '#services/fake_pandoc_service'
import RenderingService from '#services/rendering_service'
import { bipAdapter } from '#values/adapters/bip'

const BASE = 'https://raw.githubusercontent.com/bitcoin/bips/master/'
const BLOB = 'https://github.com/bitcoin/bips/blob/master/'

function input(extra = {}) {
  return {
    raw: 'src',
    format: 'mediawiki' as const,
    adapter: bipAdapter,
    numberBase: 10 as const,
    imageBaseUrl: BASE,
    linkBaseUrl: BLOB,
    repoBlobBaseUrl: BLOB,
    ...extra,
  }
}

test.group('services/rendering_service render', () => {
  test('anchors headings and emits an aligned TOC', async ({ assert, swap }) => {
    swap(
      PandocService,
      new FakePandocService({ render: () => '<h2>Motivation</h2><p>x</p><h3>Goals</h3>' })
    )
    const svc = await app.container.make(RenderingService)

    const r = await svc.render(input())

    assert.match(r.contentHtml, /<h2 id="motivation"/)
    assert.match(r.contentHtml, /<h3 id="goals"/)
    assert.include(r.toc, 'href="#motivation"')
    assert.include(r.toc, 'href="#goals"')
  })

  test('rewrites internal links and images', async ({ assert, swap }) => {
    swap(
      PandocService,
      new FakePandocService({
        render: () => '<a href="bip-0002.mediawiki">two</a><img src="img/a.png">',
      })
    )
    const svc = await app.container.make(RenderingService)

    const r = await svc.render(input())

    assert.include(r.contentHtml, 'href="/2"')
    assert.include(r.contentHtml, `src="${BASE}img/a.png"`)
  })

  test('highlights fenced code via Shiki dual theme', async ({ assert, swap }) => {
    swap(
      PandocService,
      new FakePandocService({ render: () => '<pre class="js"><code>const a = 1</code></pre>' })
    )
    const svc = await app.container.make(RenderingService)

    const r = await svc.render(input({ format: 'markdown' }))

    assert.include(r.contentHtml, 'class="shiki')
    assert.include(r.contentHtml, '--shiki-dark')
  })

  test('infers JSON highlighting for an untagged brace/bracket code block', async ({
    assert,
    swap,
  }) => {
    swap(
      PandocService,
      new FakePandocService({ render: () => '<pre><code>{ "kind": 1 }</code></pre>' })
    )
    const svc = await app.container.make(RenderingService)

    const r = await svc.render(input())

    assert.include(r.contentHtml, 'class="shiki')
    assert.match(r.contentHtml, /<span style="color:/)
  })

  test('produces plain text without markup', async ({ assert, swap }) => {
    swap(
      PandocService,
      new FakePandocService({ render: () => '<h2>Abstract</h2><p>Hello world.</p>' })
    )
    const svc = await app.container.make(RenderingService)

    const r = await svc.render(input())

    assert.include(r.contentText, 'Abstract')
    assert.include(r.contentText, 'Hello world.')
    assert.notInclude(r.contentText, '<')
  })

  test('externalizes a relative non-spec link to the source repo', async ({ assert, swap }) => {
    swap(
      PandocService,
      new FakePandocService({ render: () => '<a href="README.mediawiki">readme</a>' })
    )
    const svc = await app.container.make(RenderingService)

    const r = await svc.render(input())

    assert.include(r.contentHtml, `href="${BLOB}README.mediawiki"`)
    assert.include(r.contentHtml, 'target="_blank"')
    assert.include(r.contentHtml, 'rel="noreferrer"')
  })

  test('opens an absolute external content link in a new tab', async ({ assert, swap }) => {
    swap(
      PandocService,
      new FakePandocService({ render: () => '<a href="https://utxos.org">utxos</a>' })
    )
    const svc = await app.container.make(RenderingService)

    const r = await svc.render(input())

    assert.include(r.contentHtml, 'href="https://utxos.org"')
    assert.include(r.contentHtml, 'target="_blank"')
    assert.include(r.contentHtml, 'rel="noreferrer"')
  })

  test('linkifies a repo-root-relative mediawiki link before Pandoc sees it', async ({
    assert,
    swap,
  }) => {
    let seen = ''
    swap(
      PandocService,
      new FakePandocService({
        render: (raw) => {
          seen = raw
          return '<p>x</p>'
        },
      })
    )
    const svc = await app.container.make(RenderingService)

    await svc.render(input({ raw: 'See [/bip-0119/vectors the vectors directory].' }))

    assert.include(
      seen,
      `[${BLOB.replace('/blob/', '/tree/')}bip-0119/vectors the vectors directory]`
    )
  })

  test('rewrites a NIP-style markdown link with a hex number', async ({ assert, swap }) => {
    const { nipAdapter } = await import('#values/adapters/nip')
    swap(PandocService, new FakePandocService({ render: () => '<a href="01.md">NIP-01</a>' }))
    const svc = await app.container.make(RenderingService)

    const r = await svc.render(input({ adapter: nipAdapter, numberBase: 16 as const }))

    assert.include(r.contentHtml, 'href="/1"')
  })
})
