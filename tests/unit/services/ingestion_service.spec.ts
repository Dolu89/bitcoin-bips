import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import Document from '#models/document'
import ProjectMeta from '#models/project_meta'
import IngestionService from '#services/ingestion_service'
import SpecSourceService from '#services/spec_source_service'
import FakeSpecSourceService from '#services/fake_spec_source_service'
import { DocumentFactory } from '#database/factories/document_factory'
import { projects } from '#config/projects'

const bips = projects.find((p) => p.key === 'bips')!

test.group('services/ingestion_service syncProject', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('inserts a new spec with raw content + metadata, rendered columns null', async ({
    assert,
    swap,
  }) => {
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
    assert.equal(doc.contentHtml, null)
    assert.equal(doc.contentText, null)
    assert.equal(doc.toc, null)
    assert.equal(summary.added, 1)
    assert.equal(summary.updated, 0)
  })

  test('updates a spec in place when the upstream blob sha differs', async ({ assert, swap }) => {
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
})
