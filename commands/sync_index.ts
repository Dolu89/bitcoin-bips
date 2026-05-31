import { args, BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * On-demand search reindex: rebuild the Meilisearch index from the catalog already in the
 * database. With no argument, reindexes every enabled project; with a project key, that one.
 * Independent of a sync — useful after a fresh Meilisearch instance.
 */
export default class SyncIndex extends BaseCommand {
  static commandName = 'sync:index'
  static description = 'Rebuild the search index from the catalog in the database'

  static options: CommandOptions = { startApp: true }

  @args.string({
    description: 'Project key to reindex (omit to reindex all enabled projects)',
    required: false,
  })
  declare project?: string

  async run() {
    const { default: SearchService } = await import('#services/search_service')
    const { projects } = await import('#config/projects')
    const service = await this.app.container.make(SearchService)

    if (this.project) {
      const project = projects.find((p) => p.key === this.project && p.enabled)
      if (!project) {
        this.logger.error(`Unknown or disabled project "${this.project}"`)
        this.exitCode = 1
        return
      }
      const count = await service.reindexProject(project)
      this.logger.info(`[${project.key}] indexed ${count} specs`)
      return
    }

    for (const project of projects.filter((p) => p.enabled)) {
      const count = await service.reindexProject(project)
      this.logger.info(`[${project.key}] indexed ${count} specs`)
    }
  }
}
