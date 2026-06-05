import { args, BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * On-demand sync trigger: pull specs from the upstream source into the catalog. With no
 * argument, syncs every enabled project; with a project key, syncs that one. Decoupled from
 * the HTTP server — the site keeps serving while this runs.
 */
export default class SyncIngest extends BaseCommand {
  static commandName = 'sync:ingest'
  static description = 'Sync specs from the upstream source into the catalog'

  static options: CommandOptions = { startApp: true }

  @args.string({
    description: 'Project key to sync (omit to sync all enabled projects)',
    required: false,
  })
  declare project?: string

  async run() {
    const { default: IngestionService } = await import('#services/ingestion_service')
    const { projects } = await import('#config/projects')
    const service = await this.app.container.make(IngestionService)

    if (this.project) {
      const project = projects.find((p) => p.key === this.project && p.enabled)
      if (!project) {
        this.logger.error(`Unknown or disabled project "${this.project}"`)
        this.exitCode = 1
        return
      }
      this.report(await service.syncProject(project))
      return
    }

    const summaries = await service.syncAll()
    let hadErrors = false
    for (const summary of summaries) {
      this.report(summary)
      if (summary.errors.length > 0) {
        hadErrors = true
      }
    }
    if (hadErrors) {
      this.exitCode = 1
    }
  }

  private report(summary: {
    project: string
    added: number
    updated: number
    unchanged: number
    links: number
    errors: { number: string; message: string }[]
  }) {
    this.logger.info(
      `[${summary.project}] added ${summary.added}, updated ${summary.updated}, ` +
        `unchanged ${summary.unchanged}, links ${summary.links}, errors ${summary.errors.length}`
    )
    for (const error of summary.errors) {
      this.logger.error(`  ${summary.project}#${error.number}: ${error.message}`)
    }
    if (this.project && summary.errors.length > 0) {
      this.exitCode = 1
    }
  }
}
