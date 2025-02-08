import queue from '@rlanz/bull-queue/services/main';
import { PluginContract } from '#plugins/plugin_contract'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import ScheduledrJob from './jobs/scheduler_job.js';

const BipsPlugin: PluginContract = {
    name: 'bips-plugin',
    enable: env.get('PLUGINS_ENABLED').includes('bips'),
    async start() {
        logger.info(`Starting ${this.name}`)
        await this.schedule()
    },
    async schedule() {
        const JOB_INTERVAL_PATTERN = "0 0 * * *";

        // Running the job immediately
        queue.dispatch(ScheduledrJob, {}, { jobId: `${ScheduledrJob.name}-immediate` });

        // Running the job at the specified interval
        queue.dispatch(ScheduledrJob, {}, { jobId: ScheduledrJob.name, repeat: { pattern: JOB_INTERVAL_PATTERN } });
    },
}

export default BipsPlugin
