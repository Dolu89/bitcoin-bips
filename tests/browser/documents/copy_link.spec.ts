import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DocumentFactory } from '#database/factories/document_factory'

test.group('documents copy link', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('the Copy link button copies the canonical spec URL and confirms', async ({
    visit,
    route,
    browserContext,
    assert,
  }) => {
    await DocumentFactory.merge({
      project: 'bips',
      number: '42',
      sortOrder: 42,
      title: 'HD Wallets',
    }).create()
    await browserContext.grantPermissions(['clipboard-read', 'clipboard-write'])

    const page = await visit(route('documents.show', { number: '42' }))
    await page.getByRole('button', { name: 'Copy link' }).click()

    await page.assertVisible('text=Copied')
    // The callback runs in the browser; cast around Node's global `navigator` (no clipboard type).
    const clip = await page.evaluate(() =>
      (navigator as unknown as { clipboard: { readText(): Promise<string> } }).clipboard.readText()
    )
    assert.match(clip, /\/42$/)
  })

  test('the .md sub-action copies the markdown URL and confirms', async ({
    visit,
    route,
    browserContext,
    assert,
  }) => {
    await DocumentFactory.merge({
      project: 'bips',
      number: '42',
      sortOrder: 42,
      title: 'HD Wallets',
    }).create()
    await browserContext.grantPermissions(['clipboard-read', 'clipboard-write'])

    const page = await visit(route('documents.show', { number: '42' }))
    await page.getByRole('button', { name: 'Copy Markdown link' }).click()

    await page.assertVisible('text=Copied')
    // The callback runs in the browser; cast around Node's global `navigator` (no clipboard type).
    const clip = await page.evaluate(() =>
      (navigator as unknown as { clipboard: { readText(): Promise<string> } }).clipboard.readText()
    )
    assert.match(clip, /\/42\.md$/)
  })
})
