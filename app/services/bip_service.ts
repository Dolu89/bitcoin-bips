import Bip from "#models/bip";
import CacheService from "#services/cache_service";

export default class BipService {

    public async getBip(bipNumber: string) {
        const bip = (await CacheService.namespace('bips').get<Bip>(bipNumber))
        return bip
    }

    public async getBips() {
        const bips = (await CacheService.namespace('bips').get<Bip[]>('all'))
        return bips
    }

    public async saveBips(bips: Bip[]) {
        await CacheService.namespace('bips').set('all', bips.sort((a: Bip, b: Bip) => Number.parseInt(a.bip) - Number.parseInt(b.bip)))
    }

    public async saveBip(bip: Bip) {
        await CacheService.namespace('bips').set(bip.bip, bip)
    }

    public async setLastUpdate() {
        const date = new Date()
        await CacheService.namespace('bips').set('lastUpdate', `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`)
    }

    public async getLastUpdate() {
        const lastUpdate = (await CacheService.namespace('bips').get('lastUpdate')) as string | null
        return lastUpdate
    }

}