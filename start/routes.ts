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

// Liveness probe for the container/proxy. Outside the project group, so it answers
// 200 on any host (the per-host project is irrelevant to "is the process up?").
router.get('/up', ({ response }) => response.ok({ status: 'ok' }))

// Every public page lives under the host's project. Register static routes before `/:number`.
router
  .group(() => {
    router.get('/', [controllers.Index, 'show']).as('home')
    router.get('/favicon.ico', [controllers.Favicon, 'show'])
    router.get('/robots.txt', [controllers.Robots, 'show'])
    router.get('/sitemap.xml', [controllers.Sitemap, 'show'])
    router.get('/search', [controllers.Search, 'show'])
    router
      .get('/:number.md', [controllers.Documents, 'raw'])
      .where('number', { match: /^[0-9a-fA-F]+\.md$/ })
    router.get('/:number/history', [controllers.Documents, 'history'])
    router.get('/:number', [controllers.Documents, 'show'])
  })
  .use(middleware.requireProject())
