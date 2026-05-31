import { test } from '@japa/runner'
import { DateTime } from 'luxon'
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

test.group('documents show — About dates', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('BIP shows a Created date from the preamble and an Updated date from git', async ({
    visit,
  }) => {
    await DocumentFactory.merge({
      project: 'bips',
      number: '32',
      sortOrder: 32,
      title: 'HD Wallets',
      preamble: JSON.stringify({ Status: 'Final', Created: '2012-02-11' }),
      lastCommitAt: DateTime.fromISO('2020-05-01T00:00:00Z'),
    }).create()

    const page = await visit('http://bips.local:3333/32')

    await page.assertVisible('text=Created')
    await page.assertVisible('text=2012-02-11')
    await page.assertVisible('text=2020-05-01')
  })

  test('NIP shows a Created date derived from the first git commit', async ({ visit }) => {
    await DocumentFactory.merge({
      project: 'nips',
      number: '4',
      sortOrder: 4,
      title: 'Encrypted Direct Message',
      preamble: JSON.stringify({ Status: 'final', Tags: ['unrecommended'] }),
      firstCommitAt: DateTime.fromISO('2021-01-15T00:00:00Z'),
      lastCommitAt: DateTime.fromISO('2023-09-09T00:00:00Z'),
    }).create()

    const page = await visit('http://nips.local:3333/4')

    await page.assertVisible('text=Created')
    await page.assertVisible('text=2021-01-15')
    // The advisory tag surfaces as a badge in the About rail.
    await page.assertVisible('text=unrecommended')
  })
})
