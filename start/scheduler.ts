/*
|--------------------------------------------------------------------------
| Scheduler
|--------------------------------------------------------------------------
|
| Recurring jobs for @adonisjs/queue. The embedded sync registers ONLY when explicitly
| enabled, so a default deployment keeps today's behavior (no internal scheduler, no
| background sync). The in-process worker that dispatches the schedule is started by
| SyncWorkerProvider under the same flag. Loaded in the `web` environment only (see
| adonisrc.ts preloads), so ace commands and tests never register a schedule.
|
*/
import env from '#start/env'
import FullSync from '#jobs/full_sync'

if (env.get('SYNC_SCHEDULER_ENABLED')) {
  // Schedule id defaults to the job class name, so a reboot upserts rather than duplicates.
  await FullSync.schedule({}).every(env.get('SYNC_INTERVAL', '6h')).run()
}
