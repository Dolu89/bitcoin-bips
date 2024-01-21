import { SitemapManager } from 'sitemap-manager'
import BipService from '#services/bip_service'
import env from '#start/env'
import { inject } from '@adonisjs/core'

@inject()
export default class SitemapService {

    constructor(private bipService: BipService) { }

    public async generate() {
        const siteUrl = env.get('APP_URL')
        const sitemap = new SitemapManager({
            siteURL: siteUrl,
        })
        const routes: string[] = ['', 'support']

        let lastUpdate: Date | null = null

        // Add BIPs pages
        let bipsUrls: Url[] = []
        const bips = await this.bipService.getBips()
        if (!bips) return

        for (const bip of bips) {
            bipsUrls.push({
                loc: `${siteUrl}/${bip.bip}`,
                lastmod: bip.updated,
            })

            const bipUpdateDate = new Date(bip.updated)
            if (lastUpdate === null || lastUpdate < bipUpdateDate) {
                lastUpdate = bipUpdateDate
            }
        }
        sitemap.addUrl('bips', bipsUrls)

        // Add static pages
        let pagesUrls: Url[] = []
        for (const route of routes) {
            pagesUrls.push({
                loc: `${siteUrl}/${route}`,
                lastmod: lastUpdate!,
            })
        }
        sitemap.addUrl('pages', pagesUrls)

        await sitemap.finish()
    }
}

interface Url {
    loc: string
    lastmod?: string | Date
}