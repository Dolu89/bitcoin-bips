import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import * as cheerio from 'cheerio'
import { bipAdapter } from '#values/adapters/bip'
import { projects } from '#config/projects'
import { DocumentFactory } from '#database/factories/document_factory'

const bips = projects.find((p) => p.key === 'bips')!
const load = (html: string) => cheerio.load(html, null, false)

const BIP_HEADER = `<pre>
  BIP: 32
  Title: Hierarchical Deterministic Wallets
  Author: Pieter Wuille <pieter@example.com>
  Status: Final
  Type: Informational
  Layer: Applications
  Assigned: 2012-02-11
</pre>
== Abstract ==
Body text here.`

const BIP_MULTI_AUTHOR = `<pre>
  BIP: 2
  Title: BIP process
  Author: Luke Dashjr <luke@example.com>
          Amir Taaki <amir@example.com>, Jane Roe (jane)
  Status: Active
  Assigned: 2016-02-03
</pre>`

const BIP_MARKDOWN = `\`\`\`
  BIP: 3
  Title: Updated BIP Process
  Authors: Murch <murch@murch.one>
  Status: Deployed
  Type: Process
\`\`\`

## Abstract

Body of the markdown BIP.`

test.group('adapters/bip parsePreamble', () => {
  test('extracts the title and preamble fields from the <pre> block', ({ assert }) => {
    const { title, preamble } = bipAdapter.parsePreamble(BIP_HEADER)
    assert.equal(title, 'Hierarchical Deterministic Wallets')
    assert.equal(preamble.Status, 'Final')
    assert.equal(preamble.Type, 'Informational')
    assert.equal(preamble.Layer, 'Applications')
    assert.equal(preamble.Assigned, '2012-02-11')
  })

  test('normalizes the author line into a clean list — {label}')
    .with([
      { label: 'single author', raw: BIP_HEADER, expected: ['Pieter Wuille'] },
      {
        label: 'multi-author + folded continuation line',
        raw: BIP_MULTI_AUTHOR,
        expected: ['Luke Dashjr', 'Amir Taaki', 'Jane Roe'],
      },
    ])
    .run(({ assert }, { raw, expected }) => {
      const { preamble } = bipAdapter.parsePreamble(raw)
      assert.deepEqual(preamble.Author, expected)
    })

  test('parses a markdown BIP preamble from a leading ``` fence', ({ assert }) => {
    const { title, preamble } = bipAdapter.parsePreamble(BIP_MARKDOWN)
    assert.equal(title, 'Updated BIP Process')
    assert.equal(preamble.Status, 'Deployed')
    assert.equal(preamble.Type, 'Process')
    assert.deepEqual(preamble.Author, ['Murch'])
  })

  test('canonicalizes a plural "Authors:" key to Author', ({ assert }) => {
    const raw = `<pre>\n  Title: X\n  Authors: Jesse Posner <jesse@vora.io>\n           Jurvis Tan <jurvis@block.xyz>\n</pre>`
    const { preamble } = bipAdapter.parsePreamble(raw)
    assert.deepEqual(preamble.Author, ['Jesse Posner', 'Jurvis Tan'])
    assert.isUndefined(preamble.Authors)
  })
})

test.group('adapters/bip extractBody', () => {
  test('drops the leading BIP <pre> preamble block', ({ assert }) => {
    const body = bipAdapter.extractBody(BIP_HEADER)
    assert.notInclude(body, 'BIP: 32')
    assert.notInclude(body, '<pre>')
    assert.include(body, '== Abstract ==')
    assert.include(body, 'Body text here.')
  })

  test('drops the leading markdown ``` preamble fence', ({ assert }) => {
    const body = bipAdapter.extractBody(BIP_MARKDOWN)
    assert.notInclude(body, 'BIP: 3')
    assert.notInclude(body, '```')
    assert.include(body, '## Abstract')
    assert.include(body, 'Body of the markdown BIP.')
  })
})

test.group('adapters/bip extractReferences', () => {
  test('returns raw numbers of cited specs — {label}')
    .with([
      { label: 'BIP-0032', body: 'See BIP-0032 for details.', expected: ['0032'] },
      { label: 'BIP 141', body: 'Defined in BIP 141.', expected: ['141'] },
      { label: 'wiki [[32]]', body: 'Refer to [[32]].', expected: ['32'] },
      { label: 'non-spec file link', body: 'See [[README.mediawiki]].', expected: [] },
      { label: 'no citation', body: 'No references at all.', expected: [] },
    ])
    .run(({ assert }, { body, expected }) => {
      assert.deepEqual(bipAdapter.extractReferences(body), expected)
    })
})

test.group('adapters/bip rewriteInternalLinks', () => {
  test('rewrites a bip-0032.mediawiki link to /32', ({ assert }) => {
    const $ = load('<a href="bip-0032.mediawiki">x</a>')
    bipAdapter.rewriteInternalLinks($, 10)
    assert.equal($('a').attr('href'), '/32')
  })

  test('leaves an external link untouched', ({ assert }) => {
    const $ = load('<a href="https://example.com/bip-0032.mediawiki">x</a>')
    bipAdapter.rewriteInternalLinks($, 10)
    assert.equal($('a').attr('href'), 'https://example.com/bip-0032.mediawiki')
  })
})

test.group('adapters/bip buildDocumentView', () => {
  test('surfaces authors, an Assigned date from the preamble, and an Updated date from git', async ({
    assert,
  }) => {
    const doc = await DocumentFactory.merge({
      number: '32',
      title: 'HD Wallets',
      sourceUrl: 'https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki',
      preamble: JSON.stringify({
        Status: 'Final',
        Type: 'Standards Track',
        Layer: 'Applications',
        Author: ['Pieter Wuille'],
        Assigned: '2012-02-11',
      }),
      lastCommitAt: DateTime.fromISO('2020-05-01T00:00:00Z'),
    }).makeStubbed()

    const view = bipAdapter.buildDocumentView(doc, bips, [], [])

    assert.equal(view.eyebrow, 'BIP 32')
    // One header badge labelled with the status (mechanism). Its tone is policy → not pinned here.
    assert.lengthOf(view.badges, 1)
    assert.equal(view.badges[0].label, 'Final')
    assert.includeDeepMembers(view.headerChips, [
      { label: 'Type', value: 'Standards Track' },
      { label: 'Layer', value: 'Applications' },
    ])
    assert.includeDeepMembers(view.aboutSlots, [
      { type: 'authors', label: 'Authors', authors: ['Pieter Wuille'] },
      { type: 'date', label: 'Assigned', display: '2012-02-11' },
      { type: 'date', label: 'Updated', display: '2020-05-01' },
    ])
    assert.isTrue(view.preamble.show)
  })

  // Real fallback logic: files use `Assigned`, but the BIP-2 spec names the header `Created`.
  test('falls back to a `Created` header when `Assigned` is absent', async ({ assert }) => {
    const doc = await DocumentFactory.merge({
      number: '32',
      title: 'HD Wallets',
      preamble: JSON.stringify({ Created: '2012-02-11' }),
    }).makeStubbed()

    const view = bipAdapter.buildDocumentView(doc, bips, [], [])
    assert.includeDeepMembers(view.aboutSlots, [
      { type: 'date', label: 'Assigned', display: '2012-02-11' },
    ])
  })

  // Real fallback logic (not policy): a status with no tone mapping reads as neutral.
  test('an unknown status falls back to the neutral tone', async ({ assert }) => {
    const doc = await DocumentFactory.merge({
      number: '32',
      title: 'HD Wallets',
      preamble: JSON.stringify({ Status: 'zzz-unknown' }),
    }).makeStubbed()

    const view = bipAdapter.buildDocumentView(doc, bips, [], [])
    assert.deepEqual(view.badges, [{ label: 'zzz-unknown', tone: 'neutral' }])
  })

  test('tags related specs with their direction', async ({ assert }) => {
    const doc = await DocumentFactory.merge({ number: '32', title: 'HD Wallets' }).makeStubbed()
    const out = await DocumentFactory.merge({
      number: '44',
      title: 'Multi-Account',
      preamble: JSON.stringify({ Status: 'Final' }),
    }).makeStubbed()
    const incoming = await DocumentFactory.merge({
      number: '49',
      title: 'Derivation',
      preamble: JSON.stringify({ Status: 'Draft' }),
    }).makeStubbed()

    const view = bipAdapter.buildDocumentView(doc, bips, [out], [incoming])

    assert.deepEqual(
      view.related.map((r) => ({ number: r.number, direction: r.direction })),
      [
        { number: '44', direction: 'out' },
        { number: '49', direction: 'in' },
      ]
    )
  })
})

test.group('adapters/bip buildCatalogView', () => {
  test('builds rows, status-filter chips, and columns', async ({ assert }) => {
    const documents = [
      await DocumentFactory.merge({
        number: '1',
        title: 'First',
        preamble: JSON.stringify({
          Status: 'Final',
          Type: 'Standards Track',
          Author: ['Satoshi Nakamoto', 'Hal Finney'],
        }),
      }).makeStubbed(),
      await DocumentFactory.merge({
        number: '2',
        title: 'Second',
        preamble: JSON.stringify({ Status: 'Draft' }),
      }).makeStubbed(),
    ]

    const view = bipAdapter.buildCatalogView(bips, documents)

    assert.lengthOf(view.rows, 2)
    assert.deepEqual(
      view.columns.map((c) => c.label),
      ['Author', 'Status', 'Type', 'Layer']
    )
    assert.includeMembers(
      view.filters.map((f) => f.label),
      ['Final', 'Draft']
    )
  })

  test('renders the author cell as a chip list, empty when absent', async ({ assert }) => {
    const documents = [
      await DocumentFactory.merge({
        number: '1',
        title: 'First',
        preamble: JSON.stringify({ Author: ['Satoshi Nakamoto', 'Hal Finney'] }),
      }).makeStubbed(),
      await DocumentFactory.merge({
        number: '2',
        title: 'Second',
        preamble: JSON.stringify({ Status: 'Draft' }),
      }).makeStubbed(),
    ]

    const view = bipAdapter.buildCatalogView(bips, documents)

    // Author cells are positional to the Author column — derive its index, don't hardcode it.
    // The template turns each name into a clickable search chip; an absent author yields no chips.
    const authorCol = view.columns.findIndex((c) => c.label === 'Author')
    const authorLists = view.rows.map((row) => {
      const cell = row.cells[authorCol]
      return cell.type === 'authors' ? cell.authors : null
    })
    assert.deepEqual(authorLists, [['Satoshi Nakamoto', 'Hal Finney'], []])
  })
})

test.group('adapters/bip buildSearchRecord', () => {
  test('maps status/type/layer + authors', async ({ assert }) => {
    const doc = await DocumentFactory.merge({
      number: '32',
      title: 'HD Wallets',
      preamble: JSON.stringify({
        Status: 'Final',
        Type: 'Standards Track',
        Layer: 'Applications',
        Author: ['Pieter Wuille'],
      }),
    }).makeStubbed()

    const record = bipAdapter.buildSearchRecord(bips, doc)

    assert.equal(record.status, 'Final')
    assert.equal(record.type, 'Standards Track')
    assert.equal(record.layer, 'Applications')
    assert.deepEqual(record.authors, ['Pieter Wuille'])
  })
})
