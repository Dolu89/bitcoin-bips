/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

/**
 * Broad spec-number matcher (decimal digits are a subset of hex). Strict
 * per-base validation lives in `canonicalize`, not here.
 */
router.where('number', { match: /^[0-9a-fA-F]+$/ })

// Every public page lives under the host's project. Register static routes before `/:number`.
router
  .group(() => {
    router.get('/:number/history', [controllers.Documents, 'history'])
    router.get('/:number', [controllers.Documents, 'show'])
  })
  .use(middleware.requireProject())
