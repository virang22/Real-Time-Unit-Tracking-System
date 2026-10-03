import mongoose from 'mongoose';
import Logger from '../utils/logger.service';
import env from '../utils/validate-env';

export const connectMongo = async (): Promise<void> => {
  const uri = env.MONGODB_URI;
  try {
    await mongoose.connect(uri);
    Logger.info('MongoDB connection established');
  } catch (err) {
    Logger.error('Failed to connect to MongoDB:', err);
    throw err;
  }
};
