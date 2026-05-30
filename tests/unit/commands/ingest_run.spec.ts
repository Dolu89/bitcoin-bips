import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import Document from '#models/document'
import IngestRun from '#commands/ingest_run'
import SpecSourceService from '#services/spec_source_service'
import FakeSpecSourceService from '#services/fake_spec_source_service'
import type { FakeSource } from '#services/fake_spec_source_service'

const FIXTURE: FakeSource = {
  specs: {
    bips: [{ number: '1', sha: 'b1', content: '<pre>\n  Title: BIP One\n</pre>' }],
    nips: [{ number: '1', sha: 'n1', content: '# NIP-1: Basic protocol' }],
  },
}

test.group('commands/ingest_run', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('ingest:run bips syncs that project and succeeds', async ({ assert, swap }) => {
    swap(SpecSourceService, new FakeSpecSourceService(FIXTURE))

    const command = await ace.create(IngestRun, ['bips'])
    await command.exec()

    command.assertSucceeded()
    const doc = await Document.query().where('project', 'bips').first()
    assert.isNotNull(doc)
    command.assertLogMatches(/bips/)
  })

  test('ingest:run with no argument syncs every enabled project', async ({ assert, swap }) => {
    swap(SpecSourceService, new FakeSpecSourceService(FIXTURE))

    const command = await ace.create(IngestRun, [])
    await command.exec()

    command.assertSucceeded()
    const bipsDoc = await Document.query().where('project', 'bips').first()
    const nipsDoc = await Document.query().where('project', 'nips').first()
    assert.isNotNull(bipsDoc)
    assert.isNotNull(nipsDoc)
  })

  test('ingest:run <unknown> fails with exit code 1', async ({ assert, swap }) => {
    swap(SpecSourceService, new FakeSpecSourceService(FIXTURE))

    const command = await ace.create(IngestRun, ['ghost'])
    await command.exec()

    command.assertFailed()
    command.assertExitCode(1)
    const count = await Document.query().count('* as total')
    assert.equal(Number(count[0].$extras.total), 0)
  })
})
