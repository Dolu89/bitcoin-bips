import Bip from '#models/bip'
// import CacheService from '#services/cache_service'
import cache from '@adonisjs/cache/services/main'

export default class BipService {
  public async getBip(bipNumber: string) {
    const bip = await cache.namespace('bips').get<Bip>(bipNumber)
    return bip
  }

  public async getBips() {
    const bips = await cache.namespace('bips').get<Bip[]>('all')
    return bips
  }

  public async saveBips(bips: Bip[]) {
    await cache.namespace('bips').setForever(
      'all',
      bips.sort((a: Bip, b: Bip) => Number.parseInt(a.bip) - Number.parseInt(b.bip))
    )
  }

  public async saveBip(bip: Bip) {
    await cache.namespace('bips').setForever(bip.bip, bip)
  }

  public async setLastUpdate() {
    const date = new Date()
    await cache.namespace('bips').setForever(
      'lastUpdate',
      `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
    )
  }

  public async getLastUpdate() {
    const lastUpdate = (await cache.namespace('bips').get('lastUpdate')) as string | null
    console.log('lastUpdate', lastUpdate)
    return lastUpdate
  }
}
