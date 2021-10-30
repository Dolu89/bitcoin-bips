import { SitemapManager } from 'sitemap-manager'
import Env from '@ioc:Adonis/Core/Env'
import BipService from './BipService'

class SitemapService {
  private static siteUrl: string = Env.get('APP_URL')
  private static sitemap = new SitemapManager({
    siteURL: SitemapService.siteUrl,
  })
  private routes: string[] = ['', 'support']

  public async generate() {
    let lastUpdate: Date | null = null

    // Add BIPs pages
    let bipsUrls: Url[] = []
    const bips = await BipService.getAll()
    for (const bip of bips) {
      bipsUrls.push({
        loc: `${SitemapService.siteUrl}/${bip.bip}`,
        lastmod: bip.updated,
      })

      const bipUpdateDate = new Date(bip.updated)
      if (lastUpdate === null || lastUpdate < bipUpdateDate) {
        lastUpdate = bipUpdateDate
      }
    }
    SitemapService.sitemap.addUrl('bips', bipsUrls)

    // Add static pages
    let pagesUrls: Url[] = []
    for (const route of this.routes) {
      pagesUrls.push({
        loc: `${SitemapService.siteUrl}/${route}`,
        lastmod: lastUpdate!,
      })
    }
    SitemapService.sitemap.addUrl('pages', pagesUrls)

    await SitemapService.sitemap.finish()
  }
}

interface Url {
  loc: string
  lastmod?: string | Date
}

export default new SitemapService()
