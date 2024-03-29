import BipService from '#services/bip_service'
import SearchService from '#services/search_service'
import { searchBipsValidator } from '#validators/search'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import string from '@adonisjs/core/helpers/string'

@inject()
export default class BipsController {
  constructor(
    private bipService: BipService,
    private searchService: SearchService
  ) {}

  public async index({ view }: HttpContext) {
    const bips = await this.bipService.getBips()
    const lastUpdate = await this.bipService.getLastUpdate()
    return view.render('bips/index', { bips, lastUpdate })
  }

  public async show({ params, view, response }: HttpContext) {
    const { bip } = params

    const data = await this.bipService.getBip(bip)
    if (!data?.title) {
      return response.notFound()
    }

    return view.render('bips/bip', { bip: data })
  }

  public async search({ request, response, view }: HttpContext) {
    const { q } = await searchBipsValidator.validate(request.all())
    const searchResult = (await this.searchService.searchBips(q)).map((s) => {
      const contentTruncate = string.excerpt(s.item.contentTextOnly, 1000)
      const { content, ...item } = s.item
      item.contentTextOnly = contentTruncate
      return item
    })

    switch (request.accepts(['html', 'json'])) {
      case 'html':
        return view.render('search', { query: q, searchResult })
      case 'json':
        return response.json(searchResult)
      default:
        return view.render('search', { query: q, searchResult })
    }
  }
}
