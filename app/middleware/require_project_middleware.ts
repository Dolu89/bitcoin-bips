import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Exception } from '@adonisjs/core/exceptions'

/** Aborts with a 404 when no project resolved for the host (unconfigured or disabled). */
export default class RequireProjectMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.project) {
      throw new Exception('Not found', { status: 404 })
    }
    return next()
  }
}
