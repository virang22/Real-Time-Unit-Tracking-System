import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { NextFunction, Request, Response } from 'express';
import { responseMessages } from '../utils/response-message.service';
import { sendBadRequestResponse } from '../utils/response.service';

const ajv = new Ajv();
addFormats(ajv);

/** Validate schemas and missing params */
export const validateSchema = (schema: any, type: 'body' | 'query') => {
    const validate = ajv.compile(schema);

    return (req: Request, res: Response, next: NextFunction) => {
        const valid = validate(req[type]);
        if (!valid) return sendBadRequestResponse(res, responseMessages.validationFailed, validate.errors);

        next();
    };
};