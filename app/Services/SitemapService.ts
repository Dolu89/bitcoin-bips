import { SitemapManager } from 'sitemap-manager'
import Env from '@ioc:Adonis/Core/Env'
import Redis from '@ioc:Adonis/Addons/Redis'

class SitemapService {
  private static sitemap = new SitemapManager({
    siteURL: Env.get('APP_URL'),
  })
  private routes: string[] = ['/', '/support']

  public async generate() {
    // Add static pages
    let pagesUrls: Url[] = []
    for (const route of this.routes) {
      pagesUrls.push({
        loc: route,
        lastmod: '' || new Date(),
      })
    }
    SitemapService.sitemap.addUrl('pages', pagesUrls)

    // Add BIPs pages
    let bipsUrls: Url[] = []
    const keys = await Redis.keys('bip:*')
    for (const key of keys) {
      const bip = await Redis.hgetall(key)
      bipsUrls.push({
        loc: bip.bip,
        lastmod: bip.updated,
      })
    }
    SitemapService.sitemap.addUrl('bips', bipsUrls)

    await SitemapService.sitemap.finish()
  }
}

interface Url {
  loc: string
  lastmod?: string | Date
}

export default new SitemapService()
