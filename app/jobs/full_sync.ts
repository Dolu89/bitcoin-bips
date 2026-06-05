import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import IngestionService from '#services/ingestion_service'

/**
 * At most one full sync runs at a time across every trigger. The embedded worker is
 * single-concurrency, so this in-process flag only has to skip the tick that lands while a run
 * is still going (e.g. the after-boot dispatch racing the first schedule fire).
 */
let running = false

/**
 * Run one full orchestrated sync (every enabled project, then the search reindex) and log the
 * same report the `sync:run` command emits. Decoupled from the queue Job + scheduler so the
 * core logic is unit-testable on its own. A run that lands while another is in progress is
 * skipped, never queued behind it.
 */
export async function runFullSyncOnce(): Promise<void> {
  if (running) {
    logger.info('embedded sync skipped — a run is already in progress')
    return
  }

  running = true
  try {
    const service = await app.container.make(IngestionService)
    const report = await service.syncEverything()

    for (const summary of report.ingest) {
      logger.info(
        `[${summary.project}] added ${summary.added}, updated ${summary.updated}, ` +
          `unchanged ${summary.unchanged}, links ${summary.links}, errors ${summary.errors.length}`
      )
      for (const error of summary.errors) {
        logger.error(`  ${summary.project}#${error.number}: ${error.message}`)
      }
    }

    for (const outcome of report.reindex) {
      if (outcome.error) {
        logger.error(`[${outcome.project}] reindex failed: ${outcome.error}`)
      } else {
        logger.info(`[${outcome.project}] indexed ${outcome.count} specs`)
      }
    }
  } finally {
    running = false
  }
}

/**
 * Queue job wrapping the embedded recurring sync. Runs on the dedicated `ingest` queue at
 * single concurrency; `maxRetries: 0` so a failed run is logged (see `failed`) and left for the
 * next scheduled tick rather than retried immediately.
 */
export default class FullSync extends Job<Record<string, never>> {
  static options: JobOptions = { queue: 'ingest', maxRetries: 0 }

  async execute(): Promise<void> {
    await runFullSyncOnce()
  }

  async failed(error: Error): Promise<void> {
    logger.error({ err: error }, 'embedded sync run failed')
  }
}
