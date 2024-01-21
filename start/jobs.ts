import app from '@adonisjs/core/services/app'
import UpdaterService from '#services/updater_service'

const service = await app.container.make(UpdaterService)
service.updateBips().then(() => {
    console.log('Initial BIPS update done')
})