import Redis from '@ioc:Adonis/Addons/Redis'
import Bip from 'App/Models/Bip'
import Fuse from 'fuse.js'

class SearchService {
  private fuse: Fuse<Bip>
  public async search(terms: string): Promise<Fuse.FuseResult<Bip>[]> {
    if (!this.fuse) {
      await this.init()
    }
    return this.fuse.search(terms)
  }

  public async init() {
    const keys = await Redis.keys('bip:*')
    const bips: Bip[] = []

    for (const key of keys) {
      const bip = await Redis.hgetall(key)
      bips.push({
        bip: bip.bip,
        authors: bip.authors,
        content: bip.content,
        contentSource: bip.contentSource,
        created: bip.created,
        layer: bip.layer,
        status: bip.status,
        title: bip.title,
        type: bip.type,
        hash: bip.hash,
        updated: bip.updated,
      })
    }
    const options = {
      shouldSort: true,
      includeMatches: true,
      threshold: 0.1,
      location: 0,
      distance: 100000,
      maxPatternLength: 32,
      minMatchCharLength: 1,
      keys: [{ name: 'title', weight: 2 }, 'authors', 'contentSource'],
    }

    this.fuse = new Fuse(bips, options)
  }
}

export default new SearchService()
