import { test } from '@japa/runner'
import { searchRecord } from '#values/search_record'
import { DocumentFactory } from '#database/factories/document_factory'
import { projects } from '#config/projects'

test.group('values/search_record', () => {
  test('searchRecord flattens preamble into the index shape — {project}')
    .with([
      {
        project: 'bips',
        preamble: {
          Status: 'Final',
          Type: 'Standards Track',
          Layer: 'Consensus (soft fork)',
          Author: 'Pieter Wuille <pieter@example.com>, Greg Maxwell',
        },
        expected: {
          status: 'Final',
          type: 'Standards Track',
          layer: 'Consensus (soft fork)',
          authors: ['Pieter Wuille', 'Greg Maxwell'],
        },
      },
      {
        project: 'nips',
        preamble: { Status: 'draft', Tags: ['kind', 'event'] },
        expected: {
          status: 'draft',
          type: undefined,
          layer: undefined,
          authors: [],
        },
      },
    ])
    .run(async ({ assert }, row) => {
      const project = projects.find((p) => p.key === row.project)!
      const document = await DocumentFactory.merge({
        project: row.project,
        number: '7',
        title: 'Sample Spec',
        contentText: 'body text',
        preamble: JSON.stringify(row.preamble),
      }).makeStubbed()

      const record = searchRecord(project, document)

      assert.equal(record.id, document.id)
      assert.equal(record.project, row.project)
      assert.equal(record.number, '7')
      assert.equal(record.title, 'Sample Spec')
      assert.equal(record.content_text, 'body text')
      assert.equal(record.status, row.expected.status)
      assert.equal(record.type, row.expected.type)
      assert.equal(record.layer, row.expected.layer)
      assert.deepEqual(record.authors, row.expected.authors)
    })
})
