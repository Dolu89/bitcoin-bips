import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

/**
 * Serves `/favicon.ico` for the request's project. Browsers honour the per-project `<link rel=icon>`
 * tags in the page head; this route covers bare `/favicon.ico` fetches (crawlers, bookmarks, link
 * unfurlers) so each host gets its own icon instead of a single shared one. No `public/favicon.ico`
 * file exists, so the static server falls through to this route.
 */
export default class FaviconController {
  async show({ response, project }: HttpContext) {
    if (!project) {
      return response.notFound()
    }

    response.header('Cache-Control', 'public, max-age=604800, immutable')
    return response.download(app.publicPath('icons', project.key, 'favicon.ico'))
  }
}
