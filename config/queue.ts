import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/queue'

export default defineConfig({
  default: env.get('QUEUE_DRIVER', 'database'),

  adapters: {
    // Persisted in the app's SQLite DB via the primary Lucid connection (no broker).
    database: drivers.database(),
    // Inline, in-process execution — used in dev/tests (QUEUE_DRIVER=sync).
    sync: drivers.sync(),
  },

  worker: {
    concurrency: 5,
    idleDelay: '2s',
  },

  locations: ['./app/jobs/**/*.{ts,js}'],
})
