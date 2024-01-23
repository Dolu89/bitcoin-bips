/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import env from '#start/env'

const BipsController = () => import('#controllers/bips_controller')
const NipsController = () => import('#controllers/nips_controller')

const bipsUrl = env.get('BIPS_URL')
const nipsUrl = env.get('NIPS_URL')

if (bipsUrl) {
    router.group(() => {
        router.get('/', [BipsController, 'index'])
        router.get('/search', [BipsController, 'search']).as('search')
        router.get('/:bip', [BipsController, 'show']).where('bip', '[0-9]').as('show')
        router.get('/support', async ({ view }) => view.render('support'))
    }).domain(bipsUrl)
}

if (nipsUrl) {
    router.group(() => {
        router.get('/', [NipsController, 'index'])
        router.get('/search', [NipsController, 'search']).as('search')
        router.get('/:nip', [NipsController, 'show']).where('nip', '[0-9]').as('show')
        router.get('/support', async ({ view }) => view.render('support'))
    }).domain(nipsUrl)
}


