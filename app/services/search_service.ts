import Bip from '#models/bip'
import { inject } from '@adonisjs/core'
import Fuse, { FuseResult } from 'fuse.js'
import BipService from '#services/bip_service'

@inject()
export default class SearchService {
  constructor(private bipService: BipService) {}

  private fuse: Fuse<Bip> | null = null

  public async search(terms: string): Promise<FuseResult<Bip>[]> {
    if (!this.fuse) {
      return []
    }

    return this.fuse.search(terms)
  }

  public async init() {
    const bips = await this.bipService.getBips()
    if (!bips) return

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
