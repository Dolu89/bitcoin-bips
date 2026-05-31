import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('robots show', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('disallows /search and advertises an active sitemap line', async ({ visit, route }) => {
    const page = await visit(route('robots.show'))

    await page.assertTextContains('body', 'Disallow: /search')
    await page.assertTextContains('body', 'Sitemap: https://127.0.0.1/sitemap.xml')
    // The sitemap line is active, not commented out.
    await page.assertNotExists('text=# Sitemap')
  })
})
