import { test } from '@japa/runner'
import { catalogView } from '#values/catalog'
import { DocumentFactory } from '#database/factories/document_factory'
import { projects } from '#config/projects'

const bips = projects.find((p) => p.key === 'bips')!

test.group('values/catalog', () => {
  test('catalogView builds rows, statuses, and columns from documents', async ({ assert }) => {
    const documents = [
      await DocumentFactory.merge({
        number: '1',
        title: 'First',
        preamble: JSON.stringify({ Status: 'Final', Type: 'Standards Track' }),
      }).makeStubbed(),
      await DocumentFactory.merge({
        number: '2',
        title: 'Second',
        preamble: JSON.stringify({ Status: 'Final', Type: 'Informational' }),
      }).makeStubbed(),
      await DocumentFactory.merge({
        number: '3',
        title: 'Third',
        preamble: JSON.stringify({ Type: 'Process' }),
      }).makeStubbed(),
    ]

    const view = catalogView(bips, documents)

    assert.lengthOf(view.rows, 3)
    assert.equal(view.total, 3)

    // Header-placement display entries become the table columns.
    assert.deepEqual(
      view.tableColumns.map((c) => c.key),
      bips.display.filter((e) => e.placement === 'header').map((e) => e.key)
    )

    // De-duplicated set of present statuses; the status-less doc is excluded.
    assert.deepEqual(view.statuses, ['Final'])

    // Each row carries its identity + per-column cells.
    assert.equal(view.rows[0].number, '1')
    assert.equal(view.rows[0].title, 'First')
    assert.equal(view.rows[0].status, 'Final')
    assert.lengthOf(view.rows[0].cells, view.tableColumns.length)
    assert.isUndefined(view.rows[2].status)
  })
})
