import { Response } from 'express';
import { Response as ResponseType } from '../types/common.interfaces';
import { StatusCode } from '../types/enums';
import { responseMessages } from './response-message.service';

/**
 * Send a standardized success response
 * @param res - Express response object
 * @param message - Success message
 * @param data - Response data (optional)
 * @param totalData - Total count for pagination (optional)
 */
export const sendSuccessResponse = (
    res: Response,
    message: string,
    data: unknown = null,
    totalData?: number
): void => {
    const resObject: ResponseType = {
        success: true,
        message,
        data,
        ...(totalData !== undefined && { totalData })
    };
    res.status(StatusCode.SUCCESS).json(resObject);
};

/**
 * Send a standardized bad request response
 * @param res - Express response object
 * @param message - Error message (default: responseMessages.badRequest)
 * @param data - Additional error data (optional)
 */
export const sendBadRequestResponse = (
    res: Response,
    message: string = responseMessages.badRequest,
    data: unknown = null
): void => {
    const resObject: ResponseType = {
        success: false,
        message,
        data
    };
    res.status(StatusCode.BAD_REQUEST).json(resObject);
};

/**
 * Send a standardized unauthorized response
 * @param res - Express response object
 * @param message - Error message (default: responseMessages.unauthorized)
 * @param data - Additional error data (optional)
 */
export const sendUnauthorizedResponse = (
    res: Response,
    message: string = responseMessages.unauthorized,
    data: unknown = null
): void => {
    const resObject: ResponseType = {
        success: false,
        message,
        data
    };
    res.status(StatusCode.UNAUTHORIZED).json(resObject);
};

/**
 * Send a standardized forbidden response
 * @param res - Express response object
 * @param message - Error message (default: responseMessages.forbidden)
 * @param data - Additional error data (optional)
 */
export const sendForbiddenResponse = (
    res: Response,
    message: string = responseMessages.forbidden,
    data: unknown = null
): void => {
    const resObject: ResponseType = {
        success: false,
        message,
        data
    };
    res.status(StatusCode.FORBIDDEN).json(resObject);
};

/**
 * Send a standardized not found response
 * @param res - Express response object
 * @param message - Error message (default: responseMessages.notFound)
 * @param data - Additional error data (optional)
 */
export const sendNotFoundResponse = (
    res: Response,
    message: string = responseMessages.notFound,
    data: unknown = null
): void => {
    const resObject: ResponseType = {
        success: false,
        message,
        data
    };
    res.status(StatusCode.NOT_FOUND).json(resObject);
};

/**
 * Send a standardized conflict error response
 * @param res - Express response object
 * @param message - Error message (default: responseMessages.conflict)
 * @param data - Additional error data (optional)
 */
export const sendConflictErrorResponse = (
    res: Response,
    message: string = responseMessages.conflict,
    data: unknown = null
): void => {
    const resObject: ResponseType = {
        success: false,
        message,
        data
    };
    res.status(StatusCode.CONFLICT).json(resObject);
};

/**
 * Send a standardized internal server error response
 * @param res - Express response object
 * @param message - Error message (default: responseMessages.serverError)
 * @param data - Additional error data (optional)
 */
export const sendServerErrorResponse = (
    res: Response,
    message: string = responseMessages.serverError,
    data: unknown = null
): void => {
    const resObject: ResponseType = {
        success: false,
        message,
        data
    };
    res.status(StatusCode.INTERNAL_ERROR).json(resObject);
};

/**
 * Send a custom response with any status code
 * @param res - Express response object
 * @param statusCode - HTTP status code from StatusCode enum
 * @param message - Response message
 * @param data - Response data (optional)
 * @param totalData - Total count for pagination (optional)
 */
export const sendCustomResponse = (
    res: Response,
    statusCode: StatusCode,
    message: string,
    data: unknown = null,
    totalData?: number
): void => {
    const resObject: ResponseType = {
        success: statusCode === StatusCode.SUCCESS,
        message,
        data,
        ...(totalData !== undefined && { totalData })
    };
    res.status(statusCode).json(resObject);
};