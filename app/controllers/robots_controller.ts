import type { HttpContext } from '@adonisjs/core/http'

export default class RobotsController {
  async show({ response, project }: HttpContext) {
    if (!project) {
      return response.notFound()
    }

    response.header('Content-Type', 'text/plain')
    response.header('Cache-Control', 'public, max-age=86400')

    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /search',
      '',
      `Sitemap: https://${project.domain}/sitemap.xml`,
    ].join('\n')
  }
}
