import app from '@adonisjs/core/services/app'
import UpdaterService from '#services/updater_service'
import cron from 'node-cron'
import env from '#start/env'

const service = await app.container.make(UpdaterService)

const bipsUrl = env.get('BIPS_URL')
const nipsUrl = env.get('NIPS_URL')

if (bipsUrl) {
  // Initial updates
  await service.updateBips().then(() => {
    console.log('Initial BIPS update done')
  }).catch((error) => {
    console.log('Error while updating BIPS', error)
  })
}

if (nipsUrl) {
  await service.updateNips().then(() => {
    console.log('Initial NIPS update done')
  }).catch((error) => {
    console.log('Error while updating NIPS', error)
  })
}

// Schedule updates
cron.schedule('0 0 * * *', async () => {
  if (bipsUrl) {
    try {
      console.log('Refreshing BIPS starting...')
      await service.updateBips()
      console.log('Refreshing BIPS done')
    } catch (error) {
      console.log('Error while refreshing BIPS', error)
    }
  }

  if (nipsUrl) {
    try {
      console.log('Refreshing BIPS starting...')
      await service.updateNips()
      console.log('Refreshing NIPS done')
    } catch (error) {
      console.log('Error while refreshing NIPS', error)
    }
  }
})