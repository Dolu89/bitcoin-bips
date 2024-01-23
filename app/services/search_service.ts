import Bip from '#models/bip'
import { inject } from '@adonisjs/core'
import Fuse, { FuseResult } from 'fuse.js'
import BipService from '#services/bip_service'
import NipService from '#services/nip_service'
import Nip from '#models/nip'

@inject()
export default class SearchService {
  constructor(private bipService: BipService, private nipService: NipService) { }

  private fuseBips: Fuse<Bip> | null = null
  private fuseNips: Fuse<Nip> | null = null
  private static options = {
    shouldSort: true,
    includeMatches: true,
    threshold: 0.1,
    location: 0,
    distance: 100000,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [{ name: 'title', weight: 2 }, 'authors', 'contentSource'],
  }

  public async searchBips(terms: string): Promise<FuseResult<Bip>[]> {
    if (!this.fuseBips) {
      return []
    }
    return this.fuseBips.search(terms)
  }

  public async searchNips(terms: string): Promise<FuseResult<Bip>[]> {
    if (!this.fuseNips) {
      return []
    }
    return this.fuseNips.search(terms)
  }

  public async initBips() {
    const bips = await this.bipService.getBips()
    if (!bips) return
    this.fuseBips = new Fuse(bips, SearchService.options)
  }

  public async initNips() {
    const nips = await this.nipService.getNips()
    if (!nips) return
    this.fuseNips = new Fuse(nips, SearchService.options)
  }
}
