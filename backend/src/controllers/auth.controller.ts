import { NextFunction, Request, Response } from "express";
import userService from "../services/user.service";
import { UserPayload } from "../types/user.interfaces";
import { encrypt, hashAsync } from "../utils/crypto.service";
import loggerService from "../utils/logger.service";
import { sendForgotPasswordMail } from "../utils/mail.service";
import { responseMessages } from "../utils/response-message.service";
import { sendBadRequestResponse, sendServerErrorResponse, sendSuccessResponse, sendUnauthorizedResponse } from "../utils/response.service";

/** Generate a random password */
const generatePassword = (length: number = 8): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
};

/** Login */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await userService.loginWithEmailAndPassword(email, password);
    if (!user) {
      return sendServerErrorResponse(res, responseMessages.authentication.loginFailed, new Error('Unknown login method'));
    }
    if ('error' in user) {
      return sendUnauthorizedResponse(res, user.error);
    }
    const token = encrypt({ userId: user.id, email: user.email }, '1d');
    const userResponse: Record<string, unknown> = (user as any).toJSON ? (user as any).toJSON() : { ...user };
    delete userResponse.password;
    return sendSuccessResponse(res, responseMessages.authentication.loginSuccess, { token, user: userResponse });
  } catch (error) {
    loggerService.error(`Login error: ${error}`);
    sendServerErrorResponse(res, responseMessages.authentication.loginFailed, error);
    next(error);
  }
};

/** Register */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, mobile, name, password } = req.body;
    const existing = await userService.findUserByEmail(email);
    if (existing) {
      return sendBadRequestResponse(res, responseMessages.user.emailAlreadyRegistered);
    }
    const userData: UserPayload = { email, mobile, name };
    if (password) {
      userData.password = await hashAsync(password);
    }
    const newUser = await userService.createUser(userData);
    if (!newUser) {
      return sendServerErrorResponse(res, responseMessages.user.failedToCreate);
    }
    const token = encrypt({ userId: newUser.id, email: newUser.email }, '1d');
    const newUserResponse: Record<string, unknown> = (newUser as any).toJSON ? (newUser as any).toJSON() : { ...newUser };
    delete newUserResponse.password;
    return sendSuccessResponse(res, responseMessages.authentication.registerSuccess, { token, user: newUserResponse });
  } catch (error) {
    loggerService.error(`Error registering user: ${error}`);
    sendServerErrorResponse(res, responseMessages.authentication.registerFailed, error);
    next(error);
  }
};

/** Forgot password */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const user = await userService.findUserByEmail(email);
    if (!user) {
      return sendBadRequestResponse(res, responseMessages.user.notFoundSingle);
    }
    const newPassword = generatePassword(8);
    await userService.updateUser(user.id, { password: await hashAsync(newPassword) });
    await sendForgotPasswordMail({ name: user.name || '', email: user.email || '', password: newPassword });
    return sendSuccessResponse(res, responseMessages.authentication.forgotPasswordSuccess);
  } catch (error) {
    loggerService.error(`Error forgot password: ${error}`);
    sendServerErrorResponse(res, responseMessages.authentication.forgotPasswordFailed, error);
    next(error);
  }
};