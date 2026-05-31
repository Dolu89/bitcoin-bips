import type { HttpContext } from '@adonisjs/core/http'
import Document from '#models/document'
import ProjectMeta from '#models/project_meta'
import { adapterFor } from '#values/adapters'

export default class IndexController {
  async show({ view, response, request, project }: HttpContext) {
    if (!project) {
      return response.notFound()
    }

    const meta = await ProjectMeta.find(project.key)
    const lastUpdate = meta?.lastUpdate ?? null

    // Cache — ETag keyed on the catalog's last update timestamp.
    const etag = lastUpdate ? lastUpdate.toISO()! : 'empty'
    response.header('Cache-Control', 'public, no-cache')
    response.header('ETag', etag)
    if (request.header('if-none-match') === etag) {
      response.status(304)
      return
    }

    // README variant — projects with a curated home page (e.g. NIPs).
    if (meta?.homeHtml) {
      return view.render('pages/index_readme', { homeHtml: meta.homeHtml })
    }

    // Table variant — generated catalog (e.g. BIPs).
    const documents = await Document.query()
      .where('project', project.key)
      .select('number', 'title', 'preamble', 'sortOrder')
      .orderBy('sort_order', 'asc')

    return view.render(
      'pages/index',
      adapterFor(project.adapter).buildCatalogView(project, documents)
    )
  }
}
