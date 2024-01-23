import BipService from '#services/bip_service'
import NipService from '#services/nip_service'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import type { NextFn } from '@adonisjs/core/types/http'

export default class WebsiteMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    /**
     * Middleware logic goes here (before the next call)
     */
    const url = ctx.request.completeUrl(false)
    const bipsUrl = env.get('BIPS_URL')
    const nipsUrl = env.get('NIPS_URL')

    if (bipsUrl && url.includes(bipsUrl)) {
      const service = await app.container.make(BipService)
      const lastUpdate = await service.getLastUpdate()
      ctx.view.share({ isBips: true, appUrl: bipsUrl, lastUpdate })
    }
    else if (nipsUrl && url.includes(nipsUrl)) {
      const service = await app.container.make(NipService)
      const lastUpdate = await service.getLastUpdate()
      ctx.view.share({ isNips: true, appUrl: nipsUrl, lastUpdate })
    }

    /**
     * Call next method in the pipeline and return its output
     */
    const output = await next()
    return output
  }
}