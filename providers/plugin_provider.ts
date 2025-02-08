import type { ApplicationService } from '@adonisjs/core/types'

export default class PluginProvider {
  constructor(protected app: ApplicationService) { }

  /**
   * Register bindings to the container
   */
  register() {
  }

  /**
   * The container bindings have booted
   */
  async boot() {

  }

  /**
   * The application has been booted
   */
  async start() {
    const { PluginManager } = await import('#plugins/plugin_manager')
    const pluginManager = await this.app.container.make(PluginManager)
    await pluginManager.start()
  }

  /**
   * The process has been started
   */
  async ready() { }

  /**
   * Preparing to shutdown the app
   */
  async shutdown() { }
}