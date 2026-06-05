import type { ApplicationService } from '@adonisjs/core/types'
import type { QueueConfig, AdapterFactory } from '@adonisjs/queue/types'
import { Worker } from '@adonisjs/queue'
import env from '#start/env'

/**
 * Runs the embedded sync queue worker INSIDE the web process — no separate `queue:work`
 * command, no OS cron, no extra long-lived process the operator must launch. Mirrors what
 * `queue:work` does: resolve the configured adapters, then start a single-concurrency worker on
 * the `ingest` queue (so at most one full sync runs at a time). Inert unless
 * SYNC_SCHEDULER_ENABLED is set, and only in the `web` environment — ace commands and tests
 * never spawn it.
 */
export default class SyncWorkerProvider {
  #worker?: Worker

  constructor(protected app: ApplicationService) {}

  async ready() {
    if (!env.get('SYNC_SCHEDULER_ENABLED') || this.app.getEnvironment() !== 'web') {
      return
    }

    const config = this.app.config.get<QueueConfig>('queue')
    const logger = await this.app.container.make('logger')
    const queueManager = await this.app.container.make('queue.manager')

    // Resolve config-provider adapters to plain factories (mirrors @adonisjs/queue's queue:work).
    const adapters: Record<string, AdapterFactory> = {}
    for (const [name, adapter] of Object.entries(config.adapters)) {
      adapters[name] = typeof adapter === 'function' ? adapter : await adapter.resolver(this.app)
    }

    await queueManager.loadJobs()

    this.#worker = new Worker({
      ...config,
      adapters,
      autoLoadJobs: false,
      jobFactory: config.jobFactory ?? ((jobClass) => this.app.container.make(jobClass)),
      logger: config.logger ?? logger,
      worker: { ...config.worker, concurrency: 1 },
    })

    // start() loops until stop(); never await it (it does not resolve while running).
    this.#worker.start(['ingest']).catch((error) => {
      logger.error({ err: error }, 'embedded sync worker stopped unexpectedly')
    })

    // Kick off one run shortly after boot; the overlap guard dedupes it against the first tick.
    const { default: FullSync } = await import('#jobs/full_sync')
    await FullSync.dispatch({})
  }

  async shutdown() {
    await this.#worker?.stop()
  }
}
