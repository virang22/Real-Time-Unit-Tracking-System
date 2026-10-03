import 'dotenv/config';
import { createServer } from 'http';
import { App } from './app';
import { connectMongo } from './config/mongo';
import Logger from './utils/logger.service';
import SchedulerService from './services/scheduler.service';
import env from './utils/validate-env';

const app = new App();
const port = env.PORT;

const httpServer = createServer(app.express);

(async () => {
  try {
    await connectMongo();
    Logger.info('MongoDB connected, ready to serve requests.');

    // Initialize scheduled tasks
    SchedulerService.initializeSchedules();

  } catch (err) {
    Logger.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }

  httpServer.listen(port, () => {
    Logger.info(`Server is running on port ${port}... 🚀🚀`);
  });
})();
