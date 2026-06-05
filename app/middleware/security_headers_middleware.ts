import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Sets the response security headers that Shield does not manage — `Referrer-Policy`
 * and `Permissions-Policy`. Registered on the server stack (before the static
 * middleware) so every response carries them: pages, static assets, and 404s alike.
 */
export default class SecurityHeadersMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.response.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    ctx.response.header(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), browsing-topics=()'
    )

    return next()
  }
}
