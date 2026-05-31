import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Umbrella sync for an external scheduler (OS cron). With no argument it syncs every enabled
 * project and then — only once all ingests have completed — rebuilds the search index, in that
 * order. Per-project ingest failures and reindex failures are reported, not fatal; the command
 * exits non-zero when any step fails so the scheduler/monitoring detects a non-clean run.
 * Targeted runs stay on `sync:ingest [project]` and `sync:index [project]`.
 */
export default class SyncRun extends BaseCommand {
  static commandName = 'sync:run'
  static description = 'Sync every project then rebuild the search index, in order'

  static options: CommandOptions = { startApp: true }

  async run() {
    const { default: IngestionService } = await import('#services/ingestion_service')
    const service = await this.app.container.make(IngestionService)

    const report = await service.syncEverything()

    for (const summary of report.ingest) {
      this.logger.info(
        `[${summary.project}] added ${summary.added}, updated ${summary.updated}, ` +
          `unchanged ${summary.unchanged}, links ${summary.links}, errors ${summary.errors.length}`
      )
      for (const error of summary.errors) {
        this.logger.error(`  ${summary.project}#${error.number}: ${error.message}`)
      }
    }

    for (const outcome of report.reindex) {
      if (outcome.error) {
        this.logger.error(`[${outcome.project}] reindex failed: ${outcome.error}`)
      } else {
        this.logger.info(`[${outcome.project}] indexed ${outcome.count} specs`)
      }
    }

    const hadIngestErrors = report.ingest.some((summary) => summary.errors.length > 0)
    const hadReindexErrors = report.reindex.some((outcome) => outcome.error)
    if (hadIngestErrors || hadReindexErrors) {
      this.exitCode = 1
    }
  }
}
