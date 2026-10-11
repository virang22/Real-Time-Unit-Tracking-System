import Logger from '../utils/logger.service';

class SchedulerService {
    /**
     * Initialize all scheduled tasks
     */
    static initializeSchedules() {
        Logger.info('Initializing scheduled tasks...');
        Logger.info('Scheduled tasks initialized successfully');
    }
}

export default SchedulerService;
