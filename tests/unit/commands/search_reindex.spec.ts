import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import SearchReindex from '#commands/search_reindex'
import { DocumentFactory } from '#database/factories/document_factory'
import { useFakeSearch } from '#tests/helpers'

test.group('commands/search_reindex', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('search:reindex builds the index for one project and logs the count', async () => {
    const fake = useFakeSearch()
    await DocumentFactory.merge({ project: 'bips' }).createMany(3)

    const command = await ace.create(SearchReindex, ['bips'])
    await command.exec()

    command.assertSucceeded()
    command.assertLogMatches(/indexed 3/)
    const calls = fake.reindexCalls.filter((c) => c.project === 'bips')
    if (calls.length !== 1) {
      throw new Error(`expected one reindex call for bips, got ${calls.length}`)
    }
  })

  test('search:reindex exits with code 1 for an unknown project', async ({ assert }) => {
    const fake = useFakeSearch()

    const command = await ace.create(SearchReindex, ['ghost'])
    await command.exec()

    command.assertFailed()
    command.assertExitCode(1)
    assert.lengthOf(fake.reindexCalls, 0)
  })
})
