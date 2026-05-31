import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import Document from '#models/document'
import SyncRun from '#commands/sync_run'
import SpecSourceService from '#services/spec_source_service'
import FakeSpecSourceService from '#services/fake_spec_source_service'
import type { FakeSource } from '#services/fake_spec_source_service'
import { useFakePandoc, useFakeSearch } from '#tests/helpers'

const HEALTHY: FakeSource = {
  specs: {
    bips: [{ number: '1', sha: 'b1', content: '<pre>\n  Title: BIP One\n</pre>' }],
    nips: [{ number: '1', sha: 'n1', content: '# NIP-1: Basic protocol' }],
  },
}

test.group('commands/sync_run', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('sync:run syncs all projects, reindexes, succeeds, and logs a summary', async ({
    assert,
    swap,
  }) => {
    useFakePandoc()
    useFakeSearch()
    swap(SpecSourceService, new FakeSpecSourceService(HEALTHY))

    const command = await ace.create(SyncRun, [])
    await command.exec()

    command.assertSucceeded()
    command.assertLogMatches(/bips/)
    command.assertLogMatches(/indexed/)
    const bipsDoc = await Document.query().where('project', 'bips').first()
    const nipsDoc = await Document.query().where('project', 'nips').first()
    assert.isNotNull(bipsDoc)
    assert.isNotNull(nipsDoc)
  })

  test('sync:run exits 1 when a step fails ({mode})')
    .with([{ mode: 'ingest error' }, { mode: 'reindex failure' }])
    .run(async ({ swap }, { mode }) => {
      useFakePandoc()
      if (mode === 'ingest error') {
        useFakeSearch()
        swap(
          SpecSourceService,
          new FakeSpecSourceService({
            specs: {
              bips: [
                { number: '1', sha: 'ok', content: '<pre>\n  Title: One\n</pre>' },
                { number: '2', sha: 'boom', content: '<pre>\n  Title: Two\n</pre>' },
              ],
              nips: [{ number: '1', sha: 'n1', content: '# NIP-1: Basic protocol' }],
            },
            failingShas: ['boom'],
          })
        )
      } else {
        useFakeSearch({ throwOnReindex: true })
        swap(SpecSourceService, new FakeSpecSourceService(HEALTHY))
      }

      const command = await ace.create(SyncRun, [])
      await command.exec()

      command.assertFailed()
      command.assertExitCode(1)
    })
})
