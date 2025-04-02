import Nip from '#models/nip'
import cache from '@adonisjs/cache/services/main'

export default class NipService {

    private static cacheNamespace = 'nips'
    private static cacheAll = 'all'
    private static cacheLastUpdate = 'lastUpdate'

    public async getNip(nipNumber: string) {
        const nip = await cache.namespace(NipService.cacheNamespace).get<Nip>(nipNumber)
        return nip
    }

    public async getNips() {
        const nips = await cache.namespace(NipService.cacheNamespace).get<Nip[]>(NipService.cacheAll)
        return nips
    }

    public async saveNips(nips: Nip[]) {
        await cache.namespace(NipService.cacheNamespace).setForever(
            NipService.cacheAll,
            nips.sort((a: Nip, b: Nip) => Number.parseInt(a.nip, 16) - Number.parseInt(b.nip, 16))
        )
    }

    public async saveNip(nip: Nip) {
        await cache.namespace(NipService.cacheNamespace).setForever(nip.nip, nip)
    }

    public async setLastUpdate() {
        const date = new Date()
        await cache.namespace(NipService.cacheNamespace).setForever(
            NipService.cacheLastUpdate,
            `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
        )
    }

    public async getLastUpdate() {
        const lastUpdate = (await cache.namespace(NipService.cacheNamespace).get(NipService.cacheLastUpdate)) as string | null
        return lastUpdate
    }

    public async setHomePage(content: string) {
        await cache.namespace(NipService.cacheNamespace).setForever('home', content)
    }

    public async getHomePage() {
        const homePage = (await cache.namespace(NipService.cacheNamespace).get('home')) as string | null
        return homePage
    }
}
