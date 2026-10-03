import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { TokenPayload } from '../types/crypto.interfaces';
import env from './validate-env';

const SECRET: string = env.SECRET_KEY;

/** Function to encrypt data using JWT (JSON Web Token) */
export const encrypt = (data: Record<string, unknown>, expiresIn?: string | number) => {
    const options: jwt.SignOptions = {};
    if (expiresIn) {
        // jsonwebtoken accepts strings with time units (e.g. "180d") or seconds as numbers
        options.expiresIn = expiresIn as jwt.SignOptions['expiresIn'];
    }
    return jwt.sign(data, SECRET, options);
};

/** Function to decode a JWT token without verifying it */
export const decrypt = (token: string): string | JwtPayload | null => {
    return jwt.decode(token);
};

/** Function to verify the validity of a JWT token */
export const verifyToken = (token: string) => {
    return jwt.verify(token, SECRET) as TokenPayload;
};

/** Asynchronous function to hash a password using bcrypt */
export const hashAsync = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

/** Asynchronous function to compare a password with a hashed password using bcrypt */
export const compareAsync = async (password: string, passwordHash: string) => {
    return await bcrypt.compare(password, passwordHash);
};