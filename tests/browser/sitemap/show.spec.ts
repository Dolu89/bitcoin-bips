import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DocumentFactory } from '#database/factories/document_factory'

test.group('sitemap show', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('lists the home and every spec URL of the project', async ({ visit, route }) => {
    await DocumentFactory.merge({ project: 'bips', number: '7', sortOrder: 7 }).create()
    await DocumentFactory.merge({ project: 'bips', number: '42', sortOrder: 42 }).create()

    const page = await visit(route('sitemap.show'))

    await page.assertTextContains('body', 'https://127.0.0.1/7')
    await page.assertTextContains('body', 'https://127.0.0.1/42')
  })

  test('serves a valid minimal sitemap when the catalog is empty', async ({ visit, route }) => {
    const page = await visit(route('sitemap.show'))

    // Home URL is listed — the sitemap rendered, no 404/500...
    await page.assertTextContains('body', 'https://127.0.0.1/')
    // ...and no spec URL is present.
    await page.assertNotExists('text=https://127.0.0.1/7')
  })
})
