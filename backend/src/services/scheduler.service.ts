import cron from 'node-cron';
import alertDetectionService from './alert-detection.service';
import Logger from '../utils/logger.service';

class SchedulerService {
    /**
     * Initialize all scheduled tasks
     */
    static initializeSchedules() {
        Logger.info('Initializing scheduled tasks...');

        // Check for offline devices every 2 minutes
        this.scheduleOfflineDeviceCheck();

        // Check for abnormal bills every hour
        this.scheduleAbnormalBillCheck();

        Logger.info('Scheduled tasks initialized successfully');
    }

    /**
     * Check offline devices every 2 minutes
     */
    private static scheduleOfflineDeviceCheck() {
        // Every 2 minutes
        cron.schedule('*/2 * * * *', async () => {
            try {
                Logger.info('Running offline device check...');
                await alertDetectionService.checkOfflineDevices();
            } catch (error) {
                Logger.error('Error in offline device check:', error);
            }
        });
    }

    /**
     * Check abnormal bills every hour
     */
    private static scheduleAbnormalBillCheck() {
        // Every hour at minute 0
        cron.schedule('0 * * * *', async () => {
            try {
                Logger.info('Running abnormal bill check...');
                await alertDetectionService.checkAbnormalBills();
            } catch (error) {
                Logger.error('Error in abnormal bill check:', error);
            }
        });
    }
}

export default SchedulerService;
