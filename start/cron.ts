import cron from 'node-cron'
import UpdateBips from 'App/Services/UpdateBips'

cron.schedule('0 0 * * *', async () => {
  await UpdateBips.process()
})
