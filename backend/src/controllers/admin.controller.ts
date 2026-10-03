import { Request, Response, NextFunction } from 'express';
import userService from '../services/user.service';
import { sendSuccessResponse, sendServerErrorResponse } from '../utils/response.service';
import { responseMessages } from '../utils/response-message.service';

/**
 * DEVELOPMENT ONLY – Return a user record INCLUDING the password hash.
 * This endpoint MUST NOT be exposed in production.
 */
export const getUserWithPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Forbidden in production' });
    }
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!userId) {
      return sendServerErrorResponse(res, responseMessages.badRequest, new Error('Invalid user id'));
    }
    const user = await userService.findUserById(userId);
    if (!user) {
      return sendServerErrorResponse(res, responseMessages.user.notFoundSingle, new Error('User not found'));
    }
    const payload = (user as any).toJSON(); // includes hashed password
    return sendSuccessResponse(res, responseMessages.user.retrievedSingle, { user: payload });
  } catch (error) {
    return sendServerErrorResponse(res, responseMessages.serverError, error);
  }
};
