import path from 'path';
import { addColors, createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { colors, levels } from './constants';

// create logs directory if it doesn't exist
const dir = path.join(process.cwd(), 'logs');

// tell winston that you want to link the colors
addColors(colors);

const dailyRotateFile = new DailyRotateFile({
    maxSize: '20m',
    level: 'debug',
    maxFiles: '14d',
    zippedArchive: true,
    handleExceptions: true,
    datePattern: 'YYYY-MM-DD',
    filename: dir + '/%DATE%.log',
    format: format.combine(format.errors({ stack: true }), format.timestamp(), format.json()),
});

export default createLogger({
    levels,
    transports: [
        dailyRotateFile,
        new transports.Console({
            level: 'debug',
            format: format.combine(format.prettyPrint(), format.errors({ stack: true }), format.colorize({ all: true })),
        }),
    ],
    exceptionHandlers: [dailyRotateFile],
    exitOnError: false, // do not exit on handled exceptions
});