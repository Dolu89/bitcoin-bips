import env from '#start/env'
import { BentoCache, bentostore } from 'bentocache'
import { fileDriver } from 'bentocache/drivers/file'

export default new BentoCache({
  default: 'filesystem',
  ttl: '24h',
  stores: {
    filesystem: bentostore().useL2Layer(
      fileDriver({
        directory: env.get('CACHE_FOLDER'),
      })
    ),
  },
})
