import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Document from '#models/document'
import ProjectMeta from '#models/project_meta'
import SearchService from '#services/search_service'
import { catalogView } from '#values/catalog'

/** Minimum query length before a search runs; below it, the overlay prompts to keep typing. */
const MIN_QUERY = 3

export default class SearchController {
  @inject()
  async show({ request, response, view, project }: HttpContext, search: SearchService) {
    if (!project) {
      return response.notFound()
    }

    const query = String(request.input('q', '')).trim()
    const isFragment = request.header('X-Requested-With') === 'fetch'

    // Fragment request (live overlay): return the bare results partial.
    if (isFragment) {
      if (query.length < MIN_QUERY) {
        return view.render('partials/search/results', { query, tooShort: true })
      }
      const results = await search.search(project.key, query)
      return view.render('partials/search/results', { query, results })
    }

    // Full navigation (shared link): render the home backdrop with the overlay seeded open
    // (the overlay fetches the fragment client-side). Mirrors IndexController's home variants.
    const meta = await ProjectMeta.find(project.key)
    if (meta?.homeHtml) {
      return view.render('pages/index_readme', { homeHtml: meta.homeHtml })
    }

    const documents = await Document.query()
      .where('project', project.key)
      .select('number', 'title', 'preamble', 'sortOrder')
      .orderBy('sort_order', 'asc')

    return view.render('pages/index', catalogView(project, documents))
  }
}
