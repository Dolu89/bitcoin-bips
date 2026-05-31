import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DocumentFactory } from '#database/factories/document_factory'
import { useFakeSearch } from '#tests/helpers'

const SEARCH_BOX = 'search by title, authors, keyword'

test.group('search show', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('typing a query opens the overlay and shows matching results', async ({ visit, route }) => {
    useFakeSearch({
      records: [
        {
          project: 'bips',
          number: '32',
          title: 'HD Wallets',
          authors: ['Pieter Wuille'],
          excerpt: 'hierarchical deterministic wallets',
        },
      ],
    })
    await DocumentFactory.merge({ project: 'bips' }).createMany(2)

    const page = await visit(route('home'))
    await page.getByPlaceholder(SEARCH_BOX).fill('wallet')

    await page.assertVisible('text=HD Wallets')
    await page.assertUrlContains('/search?q=wallet')
  })

  test('a query under 3 characters shows the keep-typing prompt and no results', async ({
    visit,
    route,
  }) => {
    useFakeSearch({
      records: [{ project: 'bips', number: '32', title: 'HD Wallets', authors: [] }],
    })

    const page = await visit(route('home'))
    await page.getByPlaceholder(SEARCH_BOX).fill('wa')

    await page.assertVisible('text=Type at least 3 characters')
    await page.assertNotExists('text=HD Wallets')
  })

  test('a query with no matches shows the empty state', async ({ visit, route }) => {
    useFakeSearch({
      records: [{ project: 'bips', number: '32', title: 'HD Wallets', authors: [] }],
    })

    const page = await visit(route('home'))
    await page.getByPlaceholder(SEARCH_BOX).fill('zzzznomatch')

    await page.assertVisible('text=No proposals match')
    await page.assertNotExists('text=HD Wallets')
  })

  test('results are scoped to the current project', async ({ visit, route }) => {
    useFakeSearch({
      records: [
        { project: 'bips', number: '32', title: 'HD Wallets', authors: [] },
        { project: 'nips', number: '1', title: 'Wallet NIP', authors: [] },
      ],
    })

    const page = await visit(route('home'))
    await page.getByPlaceholder(SEARCH_BOX).fill('wallet')

    await page.assertVisible('text=HD Wallets')
    await page.assertNotExists('text=Wallet NIP')
  })

  test('clicking a result card opens the spec', async ({ visit, route }) => {
    useFakeSearch({
      records: [{ project: 'bips', number: '32', title: 'HD Wallets', authors: [] }],
    })
    await DocumentFactory.merge({ project: 'bips', number: '32', sortOrder: 32 }).create()

    const page = await visit(route('home'))
    await page.getByPlaceholder(SEARCH_BOX).fill('wallet')
    await page.assertVisible('text=HD Wallets')

    await page.getByText('HD Wallets').click()

    await page.assertPath('/32')
  })

  test('clicking an author re-runs the search for that author', async ({ visit, route }) => {
    useFakeSearch({
      records: [
        {
          project: 'bips',
          number: '32',
          title: 'HD Wallets',
          authors: ['Pieter Wuille'],
          excerpt: 'wallet structure',
        },
      ],
    })

    const page = await visit(route('home'))
    await page.getByPlaceholder(SEARCH_BOX).fill('wallet')
    await page.assertVisible('text=HD Wallets')

    await page.getByRole('button', { name: 'Pieter Wuille', exact: true }).click()

    await page.assertUrlContains('q=Pieter')
    await page.assertVisible('text=HD Wallets')
  })

  test('closing the overlay returns to the page intact', async ({ visit, route }) => {
    useFakeSearch({
      records: [{ project: 'bips', number: '32', title: 'HD Wallets', authors: [] }],
    })

    const page = await visit(route('home'))
    await page.getByPlaceholder(SEARCH_BOX).fill('wallet')
    await page.assertVisible('text=HD Wallets')

    await page.keyboard.press('Escape')

    await page.assertNotVisible('text=HD Wallets')
    await page.assertPath('/')
  })

  test('a shared /search?q= link opens with the overlay pre-filled over the home', async ({
    visit,
    route,
  }) => {
    useFakeSearch({
      records: [{ project: 'bips', number: '32', title: 'HD Wallets', authors: [] }],
    })
    await DocumentFactory.merge({ project: 'bips' }).createMany(2)

    const page = await visit(route('search.show', {}, { qs: { q: 'wallet' } }))

    await page.assertVisible('text=HD Wallets')
    await page.assertPathContains('/search')
    await page.assertQueryString({ q: 'wallet' })
  })
})
