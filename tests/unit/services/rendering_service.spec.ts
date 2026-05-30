import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import PandocService from '#services/pandoc_service'
import FakePandocService from '#services/fake_pandoc_service'
import RenderingService from '#services/rendering_service'

const BASE = 'https://raw.githubusercontent.com/bitcoin/bips/master/'

function input(extra = {}) {
  return {
    raw: 'src',
    format: 'mediawiki' as const,
    parser: 'bip' as const,
    numberBase: 10 as const,
    imageBaseUrl: BASE,
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
})
