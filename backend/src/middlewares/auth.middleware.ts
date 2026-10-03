import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import userService from '../services/user.service';
import { verifyToken } from '../utils/crypto.service';
import { responseMessages } from '../utils/response-message.service';
import { sendUnauthorizedResponse } from '../utils/response.service';

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            return sendUnauthorizedResponse(res, responseMessages.tokenInvalid);
        }

        const decoded: JwtPayload | null = verifyToken(token);
        if (!decoded) {
            return sendUnauthorizedResponse(res, responseMessages.tokenInvalid);
        }

        const userData = await userService.findUserById(decoded.userId);
        if (!userData) {
            return sendUnauthorizedResponse(res, responseMessages.tokenInvalid);
        }

        res.locals.auth = {
            user: userData.toJSON()
        };
        (req as Request & { userId?: string }).userId = decoded.userId as string;
        next();
    } catch (error) {
        return sendUnauthorizedResponse(res, responseMessages.tokenInvalid);
    }
};