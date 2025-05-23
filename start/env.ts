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
  APP_URL: Env.schema.string(),
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  CACHE_VIEWS: Env.schema.boolean(),
  GITHUB_API_KEY: Env.schema.string.optional(),
  CACHE_FOLDER: Env.schema.string(),
  UNGH_URL: Env.schema.string(),

  // Websites
  BIPS_URL: Env.schema.string.optional(),
  NIPS_URL: Env.schema.string.optional(),
})
