import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DocumentFactory } from '#database/factories/document_factory'

test.group('documents raw — markdown source', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('serves the markdown source verbatim, without site chrome', async ({ visit, route }) => {
    await DocumentFactory.merge({
      project: 'bips',
      number: '42',
      sortOrder: 42,
      sourceFormat: 'markdown',
      rawContent: '## Motivation\n\nThe body of BIP 42.',
    }).create()

    const page = await visit(route('documents.raw', { number: '42' }))

    // The literal `##` proves the raw source is served, not the rendered HTML page (which would
    // turn it into an <h2> with no literal hashes) — and the show page's About-rail link is absent.
    await page.assertPath('/42.md')
    await page.assertTextContains('body', '## Motivation')
    await page.assertTextContains('body', 'The body of BIP 42.')
    await page.assertNotExists('text=View on GitHub')
  })
})

test.group('documents raw — stored content_markdown', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('serves the stored content_markdown', async ({ visit, route }) => {
    await DocumentFactory.merge({
      project: 'bips',
      number: '43',
      sortOrder: 43,
      sourceFormat: 'mediawiki',
      contentMarkdown: '# Stored markdown\n\nFrom the column.',
      rawContent: '== Raw ==\nIgnored.',
    }).create()

    const page = await visit(route('documents.raw', { number: '43' }))

    // The pre-rendered column is served — not a request-time conversion of the raw mediawiki source.
    await page.assertPath('/43.md')
    await page.assertTextContains('body', '# Stored markdown')
    await page.assertTextContains('body', 'From the column.')
    await page.assertNotExists('text=Ignored.')
  })
})

test.group('documents raw — canonical number', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('redirects a non-canonical number to the canonical .md url', async ({ visit, route }) => {
    await DocumentFactory.merge({
      project: 'bips',
      number: '7',
      sortOrder: 7,
      sourceFormat: 'markdown',
      rawContent: '## Seven',
    }).create()

    const page = await visit(route('documents.raw', { number: '07' }))

    await page.assertPath('/7.md')
    await page.assertTextContains('body', '## Seven')
  })
})
