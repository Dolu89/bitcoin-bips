import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import Document from '#models/document'
import ProjectMeta from '#models/project_meta'
import IngestionService from '#services/ingestion_service'
import SpecSourceService from '#services/spec_source_service'
import FakeSpecSourceService from '#services/fake_spec_source_service'
import { DocumentFactory } from '#database/factories/document_factory'
import { useFakePandoc, useFakeSearch } from '#tests/helpers'
import { projects } from '#config/projects'

const bips = projects.find((p) => p.key === 'bips')!

test.group('services/ingestion_service syncProject', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('inserts a new spec with raw content + metadata and rendered columns', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [{ number: '32', sha: 's1', content: '<pre>\n  Title: HD Wallets\n</pre>' }],
        },
      })
    )
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const doc = await Document.query().where('project', 'bips').where('number', '32').firstOrFail()
    assert.equal(doc.rawContent, '<pre>\n  Title: HD Wallets\n</pre>')
    assert.equal(doc.hash, 's1')
    assert.equal(doc.sortOrder, 32)
    assert.isNotNull(doc.contentHtml)
    assert.isNotNull(doc.contentText)
    assert.isNotNull(doc.toc)
    assert.equal(summary.added, 1)
    assert.equal(summary.updated, 0)
  })

  test('updates a spec in place when the upstream blob sha differs', async ({ assert, swap }) => {
    useFakePandoc()
    await DocumentFactory.merge({
      project: 'bips',
      number: '5',
      hash: 'old',
      title: 'Old title',
      rawContent: 'old body',
    }).create()

    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: { bips: [{ number: '5', sha: 's2', content: '<pre>\n  Title: New title\n</pre>' }] },
      })
    )
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const rows = await Document.query().where('project', 'bips').where('number', '5')
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].hash, 's2')
    assert.equal(rows[0].title, 'New title')
    assert.equal(rows[0].rawContent, '<pre>\n  Title: New title\n</pre>')
    assert.equal(summary.updated, 1)
    assert.equal(summary.added, 0)
  })

  test('a second sync with no upstream change refetches nothing and writes nothing', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    const fake = new FakeSpecSourceService({
      specs: { bips: [{ number: '1', sha: 's1', content: '<pre>\n  Title: One\n</pre>' }] },
    })
    swap(SpecSourceService, fake)
    const service = await app.container.make(IngestionService)

    await service.syncProject(bips)
    const fetchesAfterFirst = fake.specFetchCount
    const before = await Document.query()
      .where('project', 'bips')
      .where('number', '1')
      .firstOrFail()

    const summary = await service.syncProject(bips)
    const after = await Document.query().where('project', 'bips').where('number', '1').firstOrFail()

    assert.equal(fake.specFetchCount, fetchesAfterFirst)
    assert.equal(after.rawContent, before.rawContent)
    assert.equal(after.hash, before.hash)
    assert.equal(summary.unchanged, 1)
    assert.equal(summary.added, 0)
    assert.equal(summary.updated, 0)
  })

  test('resolves an intra-project reference into the relatedOut pivot', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [
            { number: '10', sha: 'a', content: '<pre>\n  Title: A\n</pre>' },
            { number: '20', sha: 'b', content: '<pre>\n  Title: B\n</pre>\nSee BIP-10.' },
          ],
        },
      })
    )
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const a = await Document.query().where('project', 'bips').where('number', '10').firstOrFail()
    const b = await Document.query().where('project', 'bips').where('number', '20').firstOrFail()
    await b.load('relatedOut')
    assert.includeMembers(
      b.relatedOut.map((d) => d.id),
      [a.id]
    )
    assert.isAbove(summary.links, 0)
    assert.lengthOf(summary.errors, 0)
  })

  test('drops a reference to a number absent from the catalog', async ({ assert, swap }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [
            { number: '7', sha: 's7', content: '<pre>\n  Title: Seven\n</pre>\nSee BIP-999.' },
          ],
        },
      })
    )
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const doc = await Document.query().where('project', 'bips').where('number', '7').firstOrFail()
    await doc.load('relatedOut')
    assert.lengthOf(doc.relatedOut, 0)
    assert.lengthOf(summary.errors, 0)
  })

  test('captures the project home file into project_metas', async ({ assert, swap }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: { bips: [{ number: '1', sha: 's1', content: '<pre>\n  Title: One\n</pre>' }] },
        home: {
          bips: { sha: 'h1', content: '# Bitcoin Improvement Proposals', format: 'mediawiki' },
        },
      })
    )
    const service = await app.container.make(IngestionService)

    await service.syncProject(bips)

    const meta = await ProjectMeta.findOrFail('bips')
    assert.equal(meta.homeContent, '# Bitcoin Improvement Proposals')
    assert.equal(meta.homeFormat, 'mediawiki')
    assert.equal(meta.homeHash, 'h1')
    assert.isNotNull(meta.homeSourceUrl)
  })

  test('a second sync does not re-capture the home when its blob sha is unchanged', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    const fake = new FakeSpecSourceService({
      specs: { bips: [{ number: '1', sha: 's1', content: '<pre>\n  Title: One\n</pre>' }] },
      home: { bips: { sha: 'h1', content: '# Home' } },
    })
    swap(SpecSourceService, fake)
    const service = await app.container.make(IngestionService)

    await service.syncProject(bips)
    const homeFetchesAfterFirst = fake.homeFetchCount
    const metaBefore = await ProjectMeta.findOrFail('bips')

    await service.syncProject(bips)
    const metaAfter = await ProjectMeta.findOrFail('bips')

    assert.equal(fake.homeFetchCount, homeFetchesAfterFirst)
    assert.equal(metaAfter.homeContent, metaBefore.homeContent)
    assert.equal(metaAfter.homeHash, metaBefore.homeHash)
  })

  test('collects a failing spec as an error and still processes the rest', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [
            { number: '1', sha: 'ok', content: '<pre>\n  Title: Healthy\n</pre>' },
            { number: '2', sha: 'boom', content: '<pre>\n  Title: Broken\n</pre>' },
          ],
        },
        failingShas: ['boom'],
      })
    )
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const healthy = await Document.query().where('project', 'bips').where('number', '1').first()
    const broken = await Document.query().where('project', 'bips').where('number', '2').first()
    assert.isNotNull(healthy)
    assert.isNull(broken)
    assert.lengthOf(summary.errors, 1)
    assert.equal(summary.errors[0].number, '2')
    assert.equal(summary.added, 1)
  })

  test('stamps the project lastUpdate after a sync', async ({ assert, swap }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: { bips: [{ number: '1', sha: 's1', content: '<pre>\n  Title: One\n</pre>' }] },
      })
    )
    const service = await app.container.make(IngestionService)

    await service.syncProject(bips)

    const meta = await ProjectMeta.findOrFail('bips')
    assert.isNotNull(meta.lastUpdate)
  })

  test('a render failure is isolated and the sync continues', async ({ assert, swap }) => {
    useFakePandoc({ shouldThrow: (raw) => raw.includes('BOOM') })
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [
            { number: '1', sha: 'ok', content: '<pre>\n  Title: Healthy\n</pre>' },
            {
              number: '2',
              sha: 'bad',
              content: '<pre>\n  Title: Broken\n</pre>\nBOOM in the body.',
            },
          ],
        },
      })
    )
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const healthy = await Document.query()
      .where('project', 'bips')
      .where('number', '1')
      .firstOrFail()
    const broken = await Document.query()
      .where('project', 'bips')
      .where('number', '2')
      .firstOrFail()
    assert.isNotNull(healthy.contentHtml)
    assert.isNull(broken.contentHtml)
    assert.isNull(broken.toc)
    assert.lengthOf(summary.errors, 1)
    assert.equal(summary.errors[0].number, '2')
    assert.equal(summary.added, 2)
  })

  test('re-renders a previously-ingested spec whose contentHtml is null', async ({
    assert,
    swap,
  }) => {
    const pandoc = useFakePandoc()
    await DocumentFactory.merge({
      project: 'bips',
      number: '9',
      hash: 's9',
      rawContent: '<pre>\n  Title: Nine\n</pre>',
      contentHtml: null,
    }).create()

    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: { bips: [{ number: '9', sha: 's9', content: '<pre>\n  Title: Nine\n</pre>' }] },
      })
    )
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const doc = await Document.query().where('project', 'bips').where('number', '9').firstOrFail()
    assert.isNotNull(doc.contentHtml)
    assert.equal(summary.unchanged, 0)
    assert.lengthOf(pandoc.calls, 1)
  })

  test('renders the curated home into home_html', async ({ assert, swap }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: { bips: [{ number: '1', sha: 's1', content: '<pre>\n  Title: One\n</pre>' }] },
        home: { bips: { sha: 'h1', content: '# Home\n\nText.', format: 'markdown' } },
      })
    )
    const service = await app.container.make(IngestionService)

    await service.syncProject(bips)

    const meta = await ProjectMeta.findOrFail('bips')
    assert.isNotNull(meta.homeHtml)
  })

  test('captures a changed spec commits into document_commits', async ({ assert, swap }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: { bips: [{ number: '32', sha: 's1', content: '<pre>\n  Title: HD\n</pre>' }] },
        commits: {
          bips: {
            '32': [
              {
                hash: 'aaaaaaa',
                message: 'Add HD wallets',
                author: 'Alice',
                committedAt: '2023-06-12T00:00:00Z',
                additions: 12,
                deletions: 3,
              },
              {
                hash: 'bbbbbbb',
                message: 'Draft',
                author: 'Bob',
                committedAt: '2019-03-04T00:00:00Z',
                additions: 40,
                deletions: 1,
              },
            ],
          },
        },
      })
    )
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const doc = await Document.query().where('project', 'bips').where('number', '32').firstOrFail()
    const commits = await doc.related('commits').query()
    assert.lengthOf(commits, 2)
    const top = commits.find((c) => c.hash === 'aaaaaaa')!
    assert.equal(top.message, 'Add HD wallets')
    assert.equal(top.author, 'Alice')
    assert.equal(top.additions, 12)
    assert.equal(top.deletions, 3)
    assert.equal(top.committedAt.toISODate(), '2023-06-12')
    assert.equal(summary.added, 1)
    assert.lengthOf(summary.errors, 0)
  })

  test('backfills commits for an already-ingested spec with none', async ({ assert, swap }) => {
    useFakePandoc()
    await DocumentFactory.merge({
      project: 'bips',
      number: '9',
      hash: 's9',
      rawContent: '<pre>\n  Title: Nine\n</pre>',
      contentHtml: '<p>done</p>',
    }).create()

    const fake = new FakeSpecSourceService({
      specs: { bips: [{ number: '9', sha: 's9', content: '<pre>\n  Title: Nine\n</pre>' }] },
      commits: {
        bips: {
          '9': [
            {
              hash: 'ccccccc',
              message: 'Edit nine',
              author: 'Carol',
              committedAt: '2020-01-02T00:00:00Z',
              additions: 5,
              deletions: 2,
            },
          ],
        },
      },
    })
    swap(SpecSourceService, fake)
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const doc = await Document.query().where('project', 'bips').where('number', '9').firstOrFail()
    const commits = await doc.related('commits').query()
    assert.lengthOf(commits, 1)
    assert.equal(commits[0].hash, 'ccccccc')
    assert.equal(summary.unchanged, 1)
    assert.equal(summary.updated, 0)
    assert.equal(fake.specFetchCount, 0)
  })

  test('does not re-interrogate an unchanged spec that already has commits', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    const fake = new FakeSpecSourceService({
      specs: { bips: [{ number: '1', sha: 's1', content: '<pre>\n  Title: One\n</pre>' }] },
      commits: {
        bips: {
          '1': [
            {
              hash: 'ddddddd',
              message: 'One',
              author: 'Dan',
              committedAt: '2018-05-05T00:00:00Z',
              additions: 3,
              deletions: 0,
            },
          ],
        },
      },
    })
    swap(SpecSourceService, fake)
    const service = await app.container.make(IngestionService)

    await service.syncProject(bips)
    const commitFetchesAfterFirst = fake.commitFetchCount
    const doc = await Document.query().where('project', 'bips').where('number', '1').firstOrFail()
    const commitsAfterFirst = await doc.related('commits').query()

    const summary = await service.syncProject(bips)
    const commitsAfterSecond = await doc.related('commits').query()

    assert.equal(fake.commitFetchCount, commitFetchesAfterFirst)
    assert.lengthOf(commitsAfterSecond, commitsAfterFirst.length)
    assert.equal(summary.unchanged, 1)
  })

  test('isolates a commit-capture failure and continues the sync', async ({ assert, swap }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [
            { number: '1', sha: 'ok', content: '<pre>\n  Title: Healthy\n</pre>' },
            { number: '2', sha: 'ok2', content: '<pre>\n  Title: Two\n</pre>' },
          ],
        },
        commits: {
          bips: {
            '1': [
              {
                hash: 'eeeeeee',
                message: 'One',
                author: 'Eve',
                committedAt: '2021-07-07T00:00:00Z',
                additions: 1,
                deletions: 1,
              },
            ],
          },
        },
        failingCommitPaths: ['2'],
      })
    )
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    const one = await Document.query().where('project', 'bips').where('number', '1').firstOrFail()
    const two = await Document.query().where('project', 'bips').where('number', '2').firstOrFail()
    const oneCommits = await one.related('commits').query()
    const twoCommits = await two.related('commits').query()
    assert.isNotNull(one.contentHtml)
    assert.lengthOf(oneCommits, 1)
    assert.isNotNull(two.contentHtml)
    assert.lengthOf(twoCommits, 0)
    assert.lengthOf(summary.errors, 1)
    assert.equal(summary.errors[0].number, '2')
    assert.match(summary.errors[0].message, /^commits:/)
    assert.equal(summary.added, 2)
  })

  test('stores the total commit count while keeping only the recent window', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: { bips: [{ number: '7', sha: 's7', content: '<pre>\n  Title: Seven\n</pre>' }] },
        commits: {
          bips: {
            '7': [
              {
                hash: 'fffffff',
                message: 'Latest',
                author: 'Ann',
                committedAt: '2022-02-02T00:00:00Z',
                additions: 1,
                deletions: 0,
              },
            ],
          },
        },
        commitTotals: { bips: { '7': 42 } },
      })
    )
    const service = await app.container.make(IngestionService)

    await service.syncProject(bips)

    const doc = await Document.query().where('project', 'bips').where('number', '7').firstOrFail()
    const commits = await doc.related('commits').query()
    assert.equal(doc.commitCount, 42)
    assert.lengthOf(commits, 1)
  })

  test('backfills the total for a spec that has commits but no stored total', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    const seeded = await DocumentFactory.merge({
      project: 'bips',
      number: '8',
      hash: 's8',
      rawContent: '<pre>\n  Title: Eight\n</pre>',
      contentHtml: '<p>done</p>',
      commitCount: null,
    }).create()
    await seeded.related('commits').create({
      hash: 'old1234',
      message: 'old',
      author: 'A',
      committedAt: DateTime.fromISO('2020-01-01T00:00:00Z'),
      additions: 1,
      deletions: 1,
    })

    const fake = new FakeSpecSourceService({
      specs: { bips: [{ number: '8', sha: 's8', content: '<pre>\n  Title: Eight\n</pre>' }] },
      commits: {
        bips: {
          '8': [
            {
              hash: 'new1234',
              message: 'new',
              author: 'B',
              committedAt: '2021-01-01T00:00:00Z',
              additions: 2,
              deletions: 0,
            },
          ],
        },
      },
      commitTotals: { bips: { '8': 17 } },
    })
    swap(SpecSourceService, fake)
    const service = await app.container.make(IngestionService)

    await service.syncProject(bips)

    const doc = await Document.query().where('project', 'bips').where('number', '8').firstOrFail()
    assert.equal(doc.commitCount, 17)
    assert.equal(fake.specFetchCount, 0)
  })
})

test.group('services/ingestion_service reindex hook', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('reindexes the synced specs into search', async ({ assert, swap }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [{ number: '32', sha: 's1', content: '<pre>\n  Title: HD Wallets\n</pre>' }],
        },
      })
    )
    const search = useFakeSearch()
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    assert.equal(summary.added, 1)
    const calls = search.reindexCalls.filter((c) => c.project === 'bips')
    assert.lengthOf(calls, 1)
  })

  test('a reindex failure leaves the sync green and out of summary.errors', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [{ number: '32', sha: 's1', content: '<pre>\n  Title: HD Wallets\n</pre>' }],
        },
      })
    )
    const search = useFakeSearch({ throwOnReindex: true })
    const service = await app.container.make(IngestionService)

    const summary = await service.syncProject(bips)

    assert.equal(summary.added, 1)
    assert.lengthOf(summary.errors, 0)
    assert.lengthOf(search.reindexCalls, 1)
    const doc = await Document.query().where('project', 'bips').where('number', '32').first()
    assert.isNotNull(doc)
  })
})

test.group('services/ingestion_service syncAll', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('a project whose listing fails yields an error summary and the others still sync', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [{ number: '1', sha: 'b1', content: '<pre>\n  Title: One\n</pre>' }],
          nips: [{ number: '1', sha: 'n1', content: '# NIP-1: Basic protocol' }],
        },
        failingListProjects: ['bips'],
      })
    )
    useFakeSearch()
    const service = await app.container.make(IngestionService)

    const summaries = await service.syncAll()

    const bipsSummary = summaries.find((s) => s.project === 'bips')!
    const nipsSummary = summaries.find((s) => s.project === 'nips')!
    assert.isAtLeast(bipsSummary.errors.length, 1)
    assert.equal(bipsSummary.errors[0].number, '*')
    assert.equal(bipsSummary.added, 0)
    assert.isAtLeast(nipsSummary.added, 1)

    const bipsDocs = await Document.query().where('project', 'bips')
    const nipsDocs = await Document.query().where('project', 'nips')
    assert.lengthOf(bipsDocs, 0)
    assert.isAbove(nipsDocs.length, 0)
  })
})

test.group('services/ingestion_service syncEverything', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('syncs every enabled project, then reindexes each only after all ingests complete', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [{ number: '1', sha: 'b1', content: '<pre>\n  Title: One\n</pre>' }],
          nips: [{ number: '1', sha: 'n1', content: '# NIP-1: Basic protocol' }],
        },
      })
    )
    const search = useFakeSearch()
    const service = await app.container.make(IngestionService)

    const report = await service.syncEverything()

    const bipsIngest = report.ingest.find((s) => s.project === 'bips')!
    const nipsIngest = report.ingest.find((s) => s.project === 'nips')!
    assert.isAtLeast(bipsIngest.added, 1)
    assert.isAtLeast(nipsIngest.added, 1)
    assert.includeMembers(
      report.reindex.map((r) => r.project),
      ['bips', 'nips']
    )

    // report.reindex carries only the final ordered loop (the kept per-project inline hook does
    // not push to it), so its project order is the loop's order.
    assert.deepEqual(
      report.reindex.map((r) => r.project),
      ['bips', 'nips']
    )

    // The final reindex loop is the last pass over the projects; its tail in reindexCalls runs
    // after every project's ingest has persisted, so its first call already sees the whole
    // catalog — proof the loop followed all ingests rather than interleaving with them.
    const counted = await Document.query().count('* as total')
    const totalDocs = Number(counted[0].$extras.total)
    const finalLoop = search.reindexCalls.slice(-2)
    assert.deepEqual(
      finalLoop.map((c) => c.project),
      ['bips', 'nips']
    )
    assert.equal(finalLoop[0].catalogTotal, totalDocs)
  })

  test('a failing reindex is captured in the report and does not throw', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [{ number: '1', sha: 'b1', content: '<pre>\n  Title: One\n</pre>' }],
          nips: [{ number: '1', sha: 'n1', content: '# NIP-1: Basic protocol' }],
        },
      })
    )
    useFakeSearch({ throwOnReindex: true })
    const service = await app.container.make(IngestionService)

    const report = await service.syncEverything()

    assert.isNotEmpty(report.reindex)
    for (const outcome of report.reindex) {
      assert.isDefined(outcome.error)
    }
    for (const summary of report.ingest) {
      assert.lengthOf(summary.errors, 0)
    }
    const docs = await Document.query()
    assert.isAbove(docs.length, 0)
  })

  test('a failed project ingest does not stop the final search refresh', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    swap(
      SpecSourceService,
      new FakeSpecSourceService({
        specs: {
          bips: [{ number: '1', sha: 'b1', content: '<pre>\n  Title: One\n</pre>' }],
          nips: [{ number: '1', sha: 'n1', content: '# NIP-1: Basic protocol' }],
        },
        failingListProjects: ['bips'],
      })
    )
    const search = useFakeSearch()
    const service = await app.container.make(IngestionService)

    const report = await service.syncEverything()

    const bipsIngest = report.ingest.find((s) => s.project === 'bips')!
    const nipsIngest = report.ingest.find((s) => s.project === 'nips')!
    assert.isAtLeast(bipsIngest.errors.length, 1)
    assert.isAtLeast(nipsIngest.added, 1)
    assert.include(
      search.reindexCalls.map((c) => c.project),
      'nips'
    )
    const nipsDocs = await Document.query().where('project', 'nips')
    assert.isAbove(nipsDocs.length, 0)
  })
})
