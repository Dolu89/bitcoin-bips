import NipService from '#services/nip_service'
import SearchService from '#services/search_service'
import { searchBipsValidator } from '#validators/search'
import { inject } from '@adonisjs/core'
import string from '@adonisjs/core/helpers/string'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class NipsController {

    constructor(private nipService: NipService, private searchService: SearchService) { }

    public async index({ view }: HttpContext) {
        const home = await this.nipService.getHomePage()
        const lastUpdate = await this.nipService.getLastUpdate()
        return view.render('nips/index', { home, lastUpdate })
    }

    public async show({ view, params, response }: HttpContext) {
        const { nip } = params

        const data = await this.nipService.getNip(nip)
        if (!data?.title) {
            return response.notFound()
        }

        return view.render('nips/nip', { nip, title: data.title, content: data.content, toc: data.toc })
    }

    public async search({ request, response, view }: HttpContext) {
        const { q } = await searchBipsValidator.validate(request.all())
        const searchResult = (await this.searchService.searchNips(q)).map((s) => {
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