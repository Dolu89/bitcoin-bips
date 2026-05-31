import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { sitemapXml } from '#values/sitemap'
import { DocumentFactory } from '#database/factories/document_factory'
import { projects } from '#config/projects'

const bips = projects.find((p) => p.key === 'bips')!
const nips = projects.find((p) => p.key === 'nips')!

test.group('values/sitemap', () => {
  test('builds a urlset with the home + per-spec URLs on the project domain, each with lastmod')
    .with([bips, nips])
    .run(async ({ assert }, project) => {
      const d1 = DateTime.fromISO('2026-01-02T03:04:05.000Z', { zone: 'utc' })
      const d2 = DateTime.fromISO('2026-03-04T05:06:07.000Z', { zone: 'utc' })
      const home = DateTime.fromISO('2026-03-04T05:06:07.000Z', { zone: 'utc' })

      const documents = [
        await DocumentFactory.merge({ number: '7', updatedAt: d1 }).makeStubbed(),
        await DocumentFactory.merge({ number: '42', updatedAt: d2 }).makeStubbed(),
      ]

      const xml = sitemapXml(project, documents, home)

      // Sitemap protocol envelope.
      assert.include(xml, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
      assert.include(xml, '</urlset>')

      // Home entry on the project's own domain, with the most-recent lastmod.
      assert.include(xml, `<loc>https://${project.domain}/</loc>`)
      assert.include(xml, `<lastmod>${home.toISO()}</lastmod>`)

      // One entry per spec, on the project's domain, each with its own lastmod.
      assert.include(xml, `<loc>https://${project.domain}/7</loc>`)
      assert.include(xml, `<loc>https://${project.domain}/42</loc>`)
      assert.include(xml, `<lastmod>${d1.toISO()}</lastmod>`)
      assert.include(xml, `<lastmod>${d2.toISO()}</lastmod>`)
    })

  test('builds a home-only urlset with no lastmod when the catalog is empty', ({ assert }) => {
    const xml = sitemapXml(bips, [], null)

    // Well-formed envelope.
    assert.include(xml, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    assert.include(xml, '</urlset>')

    // Home URL present...
    assert.include(xml, `<loc>https://${bips.domain}/</loc>`)
    // ...with no lastmod anywhere, and no spec URLs.
    assert.notInclude(xml, '<lastmod>')
    assert.equal(xml.match(/<loc>/g)?.length, 1)
  })
})
