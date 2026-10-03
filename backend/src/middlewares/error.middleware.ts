import { NextFunction, Request, Response } from 'express';
import { CustomError } from '../types/common.interfaces';
import { StatusCode } from '../types/enums';
import Logger from '../utils/logger.service';
import { responseMessages } from '../utils/response-message.service';

/**Create middleware for error log */
export const errorMiddleware = (error: CustomError, request: Request, response: Response, next: NextFunction) => {
    const status = error.status || StatusCode.INTERNAL_ERROR;
    const message = error.message || responseMessages.serverError;

    // Format current date and time
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })}`;

    // Log error stack if available, otherwise log error message
    if (error.stack) {
        Logger.error(`[${formattedDate}] ${error.stack}`);
    } else {
        Logger.error(`[${formattedDate}] ${error.message}`);
    }

    const url = `Location of Error : ${request.originalUrl}  Method : ${request.method}  Request Body : ${JSON.stringify(request.body)}`;
    Logger.error(message, url);

    if (response.headersSent) {
        return next(error);
    }

    response.status(status).send({ status, message });
};
