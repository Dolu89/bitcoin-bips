import env from '#start/env'
import { defineConfig, store, drivers } from '@adonisjs/cache'

const cacheConfig = defineConfig({
  default: 'file',
  stores: {
    
    file: store().useL2Layer(drivers.file({
      directory: env.get('CACHE_FOLDER'),
    }))
    
  }
})

export default cacheConfig

declare module '@adonisjs/cache/types' {
  interface CacheStores extends InferStores<typeof cacheConfig> {}
}