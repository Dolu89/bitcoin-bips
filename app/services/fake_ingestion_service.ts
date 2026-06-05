import IngestionService from '#services/ingestion_service'
import type { FullSyncReport } from '#types/ingestion'

/**
 * Test fake for the embedded sync job. Records how many times the full sync ran and, when a
 * gate is engaged, holds a run in-flight so the overlap guard in `runFullSyncOnce` can be
 * exercised. Boundary: the real IngestionService wraps external IO (GitHub via
 * SpecSourceService, Meilisearch via SearchService, the pandoc binary) — faking it keeps the
 * unit tests off the network. The four super deps are unused; the override replaces the work.
 */
export default class FakeIngestionService extends IngestionService {
  syncCount = 0
  #release?: () => void
  #gate?: Promise<void>

  constructor() {
    super(null as never, null as never, null as never, null as never)
  }

  /** Hold the next `syncEverything()` in-flight until the returned `release()` is called. */
  gateOn(): () => void {
    this.#gate = new Promise<void>((resolve) => {
      this.#release = resolve
    })
    return () => this.#release?.()
  }

  async syncEverything(): Promise<FullSyncReport> {
    this.syncCount++
    // One-shot: only the first call after gateOn() waits, so a second (un-guarded) call
    // returns immediately and the overlap test fails on the count, not on a timeout.
    const gate = this.#gate
    this.#gate = undefined
    if (gate) {
      await gate
    }
    return { ingest: [], reindex: [] }
  }
}
