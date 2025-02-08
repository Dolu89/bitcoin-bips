import cache from '@adonisjs/cache/services/main'
import StoreContract from '#models/contracts/store'
import { CacheProvider } from '@adonisjs/cache/types'

export default class StoreService<T extends StoreContract> {

    cache: CacheProvider
    constructor() {
        this.cache = cache
    }

    public async get(number: string) {
        return this.cache.get<T>({ key: number })
    }

    public async getAll() {
        return this.cache.get<T[]>({ key: 'all' })
    }

    public async saveAll(items: T[]) {
        // Remove content from items before saving to save space
        const itemsToSave = items.map((item) => {
            const { content, ...rest } = item
            return { ...rest }
        })

        await this.cache.setForever(
            {
                key: 'all',
                value: itemsToSave.sort((a: Omit<T, "content">, b: Omit<T, "content">) => Number.parseInt(a.number) - Number.parseInt(b.number))
            }
        )
    }

    public async save(item: T) {
        await this.cache.setForever({ key: item.number, value: item })
    }
}