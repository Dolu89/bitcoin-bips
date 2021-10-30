import Bip from 'App/Models/Bip'
import Fuse from 'fuse.js'
import BipService from './BipService'

class SearchService {
  private fuse: Fuse<Bip>
  public async search(terms: string): Promise<Fuse.FuseResult<Bip>[]> {
    if (!this.fuse) {
      await this.init()
    }
    return this.fuse.search(terms)
  }

  public async init() {
    const bips = await BipService.getAll()
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
