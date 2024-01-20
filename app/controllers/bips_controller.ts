import BipService from '#services/bip_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class BipsController {
    constructor(private bipService: BipService) { }

    public async index({ view }: HttpContext) {
        const bips = await this.bipService.getBips()
        const lastUpdate = await this.bipService.getLastUpdate()
        return view.render('index', { bips, lastUpdate })
    }

    public async show({ params, view, response }: HttpContext) {
        const { bip } = params

        const data = await this.bipService.getBip(bip)
        if (!data?.title) {
            return response.notFound()
        }
        const lastUpdate = await this.bipService.getLastUpdate()
        
        return view.render('bip', { bip: data, lastUpdate })
    }
}