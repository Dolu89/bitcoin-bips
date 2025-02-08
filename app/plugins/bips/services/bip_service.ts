import cache from '@adonisjs/cache/services/main'
import StoreService from '#services/store_service'
import { Bip } from '../models/bip.js'

export default class BipService extends StoreService<Bip> {
    constructor() {
        super()
        this.cache = cache.namespace('bips')
    }
}