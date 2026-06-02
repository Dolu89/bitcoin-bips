import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import * as cheerio from 'cheerio'
import { nipAdapter, HEADER_TAGS } from '#values/adapters/nip'
import { projects } from '#config/projects'
import { DocumentFactory } from '#database/factories/document_factory'

const nips = projects.find((p) => p.key === 'nips')!
const load = (html: string) => cheerio.load(html, null, false)

const NIP_SETEXT = `NIP-01
======

Basic protocol flow description
-------------------------------

\`draft\` \`mandatory\` \`relay\`

This NIP defines the basic protocol.`

test.group('adapters/nip parsePreamble', () => {
  test('takes the title from the first H1 with the NIP-<n>: prefix removed', ({ assert }) => {
    const raw = `# NIP-12: Generic Tag Queries\n\nDescription of the NIP.`
    const { title } = nipAdapter.parsePreamble(raw)
    assert.equal(title, 'Generic Tag Queries')
  })

  test('parses a setext title (skipping the NIP-<n> label) and classification tags', ({
    assert,
  }) => {
    const { title, preamble } = nipAdapter.parsePreamble(NIP_SETEXT)
    assert.equal(title, 'Basic protocol flow description')
    assert.equal(preamble.Status, 'draft')
    assert.deepEqual(preamble.Tags, ['mandatory', 'relay'])
  })
})

test.group('adapters/nip extractBody', () => {
  test('drops the leading NIP H1 title', ({ assert }) => {
    const raw = `# NIP-12: Generic Tag Queries\n\n## Section\n\nBody.`
    const body = nipAdapter.extractBody(raw)
    assert.notInclude(body, '# NIP-12')
    assert.include(body, '## Section')
  })

  test('drops the setext label, title and tag line', ({ assert }) => {
    const body = nipAdapter.extractBody(NIP_SETEXT)
    assert.notInclude(body, 'NIP-01')
    assert.notInclude(body, 'Basic protocol flow description')
    assert.notInclude(body, '`draft`')
    assert.include(body, 'This NIP defines the basic protocol.')
  })

  test('strips the front matter but keeps a warning blockquote that precedes it', ({ assert }) => {
    const raw = `> __Warning__  \`unrecommended\`: vulnerable to one specific attack\n\n${NIP_SETEXT}`
    const body = nipAdapter.extractBody(raw)
    assert.include(body, '__Warning__')
    assert.notInclude(body, 'NIP-01\n======')
    assert.include(body, 'This NIP defines the basic protocol.')
  })
})

test.group('adapters/nip extractReferences', () => {
  test('returns raw numbers of cited NIPs', ({ assert }) => {
    assert.deepEqual(nipAdapter.extractReferences('See NIP-12 and [[01]].'), ['12', '01'])
  })
})

test.group('adapters/nip rewriteInternalLinks', () => {
  test('rewrites a hex 01.md link to /1', ({ assert }) => {
    const $ = load('<a href="01.md">x</a>')
    nipAdapter.rewriteInternalLinks($, 16)
    assert.equal($('a').attr('href'), '/1')
  })
})

test.group('adapters/nip buildDocumentView', () => {
  // Mechanism, not policy: the status leads, then each tag is routed by HEADER_TAGS membership.
  // Expectations derive from HEADER_TAGS itself, so editing which tags are pinned (or their tones)
  // never touches this test.
  test('puts the status first, then routes each tag by HEADER_TAGS membership', async ({
    assert,
  }) => {
    const tags = ['mandatory', 'optional', 'unrecommended', 'zzz-unknown'] // spans both buckets
    const doc = await DocumentFactory.merge({
      project: 'nips',
      number: '4',
      title: 'Encrypted Direct Message',
      preamble: JSON.stringify({ Status: 'final', Tags: tags }),
    }).makeStubbed()

    const view = nipAdapter.buildDocumentView(doc, nips, [], [])

    assert.equal(view.badges[0].label, 'final') // the status is always the first header badge
    const header = view.badges.slice(1).map((b) => b.label)
    const about = view.aboutSlots.flatMap((s) =>
      s.type === 'badges' ? s.badges.map((b) => b.label) : []
    )

    for (const tag of tags) {
      if (HEADER_TAGS.has(tag)) assert.include(header, tag)
      else assert.include(about, tag)
    }
    assert.sameMembers([...header, ...about], tags) // every tag placed exactly once
    assert.isFalse(view.preamble.show) // NIPs render their preamble in the header
  })

  // Real fallback logic (not policy): a tag with no tone mapping reads as neutral.
  test('an unknown tag falls back to the neutral tone', async ({ assert }) => {
    const doc = await DocumentFactory.merge({
      project: 'nips',
      number: '4',
      title: 'Encrypted Direct Message',
      preamble: JSON.stringify({ Tags: ['zzz-unknown'] }),
    }).makeStubbed()

    const view = nipAdapter.buildDocumentView(doc, nips, [], [])
    const badges = view.aboutSlots.flatMap((s) => (s.type === 'badges' ? s.badges : []))
    assert.deepInclude(badges, { label: 'zzz-unknown', tone: 'neutral' })
  })

  test('shows a Created date from the first git commit (NIPs have none in-source)', async ({
    assert,
  }) => {
    const doc = await DocumentFactory.merge({
      project: 'nips',
      number: '1',
      title: 'Basic protocol',
      preamble: JSON.stringify({ Status: 'draft' }),
      firstCommitAt: DateTime.fromISO('2021-01-15T00:00:00Z'),
      lastCommitAt: DateTime.fromISO('2023-09-09T00:00:00Z'),
    }).makeStubbed()

    const view = nipAdapter.buildDocumentView(doc, nips, [], [])

    assert.includeDeepMembers(view.aboutSlots, [
      { type: 'date', label: 'Created', display: '2021-01-15' },
      { type: 'date', label: 'Updated', display: '2023-09-09' },
    ])
  })
})

test.group('adapters/nip buildSearchRecord', () => {
  test('has a status but no type/layer (NIPs define none)', async ({ assert }) => {
    const doc = await DocumentFactory.merge({
      project: 'nips',
      number: '1',
      title: 'Basic protocol',
      preamble: JSON.stringify({ Status: 'draft', Tags: ['mandatory'] }),
    }).makeStubbed()

    const record = nipAdapter.buildSearchRecord(nips, doc)

    assert.equal(record.status, 'draft')
    assert.isUndefined(record.type)
    assert.isUndefined(record.layer)
  })
})
