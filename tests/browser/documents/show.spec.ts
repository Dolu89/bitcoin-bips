import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DocumentFactory } from '#database/factories/document_factory'

test.group('documents show — ingested, unrendered', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('renders a spec whose content_html and content_text are null without error', async ({
    visit,
    route,
  }) => {
    await DocumentFactory.merge({
      project: 'bips',
      number: '42',
      sortOrder: 42,
      title: 'Null Content Spec',
      contentHtml: null,
      contentText: null,
      toc: null,
    }).create()

    const page = await visit(route('documents.show', { number: '42' }))

    await page.assertPath('/42')
    await page.assertVisible('text=Null Content Spec')
  })
})
