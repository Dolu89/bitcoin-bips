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

  // The current project resolves from the test host (BIPS_DOMAIN=127.0.0.1 in .env.test), so the
  // browser path renders a bips page; the NIP first-commit → date-slot path is covered in
  // tests/unit/values/adapters/nip.spec.ts. This proves the About rail renders both a preamble
  // date (Created) and a git-sourced date (Updated) end-to-end through the real template.
  test('renders an Assigned date from the preamble and an Updated date from git', async ({
    visit,
    route,
  }) => {
    await DocumentFactory.merge({
      project: 'bips',
      number: '32',
      sortOrder: 32,
      title: 'HD Wallets',
      preamble: JSON.stringify({ Status: 'Final', Created: '2012-02-11' }),
      lastCommitAt: DateTime.fromISO('2020-05-01T00:00:00Z'),
    }).create()

    const page = await visit(route('documents.show', { number: '32' }))

    // Scope to the About rail: the date also appears in the raw preamble panel, so an unscoped
    // text= locator is ambiguous under Playwright strict mode. The bip adapter labels the
    // preamble date "Assigned" (it falls back to the spec's `Created` header for the value).
    await page.assertExists('.bip-meta-rail >> text=Assigned')
    await page.assertExists('.bip-meta-rail >> text=2012-02-11')
    await page.assertExists('.bip-meta-rail >> text=Updated')
    await page.assertExists('.bip-meta-rail >> text=2020-05-01')
  })
})
