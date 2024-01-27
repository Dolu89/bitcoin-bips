import env from '#start/env'
import { defineConfig, store, drivers } from '@adonisjs/cache'

const cacheConfig = defineConfig({
  default: 'multitier',
  stores: {
    multitier: store()
      .useL1Layer(drivers.memory({ maxSize: 10 * 1024 * 1024 }))
      .useL2Layer(drivers.file({
        directory: env.get('CACHE_FOLDER'),
      }))

  }
})

export default cacheConfig

declare module '@adonisjs/cache/types' {
  interface CacheStores extends InferStores<typeof cacheConfig> { }
}
