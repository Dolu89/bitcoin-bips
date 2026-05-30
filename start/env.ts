/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Projects — optional per-project domain override (defaults live in config/projects.ts).
  BIPS_DOMAIN: Env.schema.string.optional(),
  NIPS_DOMAIN: Env.schema.string.optional(),

  // Database — sqlite filename under tmp/ (overridden in .env.test for an isolated test DB).
  DB_DATABASE: Env.schema.string.optional(),

  // GitHub — authenticated ingestion reads (~5000 req/h). Optional: boot never blocks;
  // a sync errors only when invoked without it. Tests fake the source and need no value.
  GITHUB_API_KEY: Env.schema.string.optional(),
})
