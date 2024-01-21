/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
const BipsController = () => import('#controllers/bips_controller')

router.get('/', [BipsController, 'index'])
router.get('/search', [BipsController, 'search']).as('search')
router.get('/support', async ({ view }) => view.render('support'))
router.get('/:bip', [BipsController, 'show']).where('bip', '[0-9]').as('show')