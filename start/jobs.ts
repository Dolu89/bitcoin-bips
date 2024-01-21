import app from '@adonisjs/core/services/app'
import UpdaterService from '#services/updater_service'
import cron from 'node-cron'

const service = await app.container.make(UpdaterService)
service.updateBips().then(() => {
  console.log('Initial BIPS update done')
}).catch((error) => {
  console.log('Error while updating BIPS', error)
})

cron.schedule('0 0 * * *', async () => {
  console.log('Refreshing BIPS starting...')
  try {
    await service.updateBips()
    console.log('Refreshing BIPS done')
  } catch (error) {
    console.log('Error while refreshing BIPS', error)
  }
})