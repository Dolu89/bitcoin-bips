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
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring plugins
  |----------------------------------------------------------
  */
  PLUGINS_ENABLED: (name, value) => {
    if (!value) {
      throw new Error(`Value for ${name} is required`)
    }

    if (typeof value !== 'string' || !value.split(',').every((item) => item.trim())) {
      throw new Error(`Value for ${name} must be a valid string seperated by comma`)
    }

    return value.split(',').map((item) => item.trim())
  },

  /*
  |----------------------------------------------------------
  | Variables for Redis (used by BullMQ and Cache)
  |----------------------------------------------------------
  */
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional()
})
