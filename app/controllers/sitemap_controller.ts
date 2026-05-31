import type { HttpContext } from '@adonisjs/core/http'
import Document from '#models/document'
import ProjectMeta from '#models/project_meta'
import { sitemapXml } from '#values/sitemap'

export default class SitemapController {
  async show({ response, request, project }: HttpContext) {
    if (!project) {
      return response.notFound()
    }

    const meta = await ProjectMeta.find(project.key)
    const lastUpdate = meta?.lastUpdate ?? null

    // Cache — ETag keyed on the catalog's last update timestamp (mirrors the index).
    const etag = lastUpdate ? lastUpdate.toISO()! : 'empty'
    response.header('Cache-Control', 'public, no-cache')
    response.header('ETag', etag)
    if (request.header('if-none-match') === etag) {
      response.status(304)
      return
    }

    const documents = await Document.query()
      .where('project', project.key)
      .select('number', 'updatedAt')
      .orderBy('sort_order', 'asc')

    response.header('Content-Type', 'application/xml; charset=utf-8')

    return sitemapXml(project, documents, lastUpdate)
  }
}
