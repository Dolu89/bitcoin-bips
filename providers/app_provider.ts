import BipService from '#services/bip_service'
import NipService from '#services/nip_service'
import SearchService from '#services/search_service'
import type { ApplicationService } from '@adonisjs/core/types'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
   */
  register() {
    this.app.container.singleton(SearchService, async (resolver) => {
      const bipService = await resolver.make(BipService)
      const nipService = await resolver.make(NipService)
      return new SearchService(bipService, nipService)
    })
  }

  /**
   * The container bindings have booted
   */
  async boot() {}

  /**
   * The application has been booted
   */
  async start() {}

  /**
   * The process has been started
   */
  async ready() {}

  /**
   * Preparing to shutdown the app
   */
  async shutdown() {}
}
