import { test } from '@japa/runner'
import { runFullSyncOnce } from '#jobs/full_sync'
import IngestionService from '#services/ingestion_service'
import FakeIngestionService from '#services/fake_ingestion_service'

test.group('jobs/full_sync', () => {
  test('runFullSyncOnce triggers the full sync once', async ({ assert, swap }) => {
    const fake = new FakeIngestionService()
    swap(IngestionService, fake)

    await runFullSyncOnce()

    assert.equal(fake.syncCount, 1)
  })

  test('overlapping runFullSyncOnce calls collapse to a single sync', async ({ assert, swap }) => {
    const fake = new FakeIngestionService()
    const release = fake.gateOn()
    swap(IngestionService, fake)

    const first = runFullSyncOnce() // held in-flight by the gate
    await runFullSyncOnce() // lands while the first is active — should be skipped
    release()
    await first

    assert.equal(fake.syncCount, 1)
  })
})
