import { UserPayload } from '../types/user.interfaces';
import { compareAsync } from '../utils/crypto.service';
import { responseMessages } from '../utils/response-message.service';
import User from '../models/user.model';

const userAttributes = ['_id', 'name', 'email', 'mobile'];

const findUserByEmail = async (email: string) => {
  return await User.findOne({ email, isDeleted: false })
    .select([...userAttributes, 'password'])
    .exec();
};

const findUserById = async (userId: string) => {
  return await User.findById(userId)
    .where({ isDeleted: false })
    .select([...userAttributes, 'address', 'createdAt', 'updatedAt'])
    .exec();
};

const updateUser = async (userId: string, updateData: UserPayload, updatedBy?: string | null) => {
  const updateObj: any = { ...updateData, updatedAt: new Date() };
  if (updatedBy) updateObj.updatedBy = updatedBy;
  await User.findByIdAndUpdate(userId, updateObj).exec();
};

/** Create a new user */
const createUser = async (userData: UserPayload, createdBy?: string | null) => {
  const createObj: any = { ...userData };
  if (createdBy) createObj.createdBy = createdBy;
  return await User.create(createObj);
};

/** Login with email and password */
const loginWithEmailAndPassword = async (email: string, password: string) => {
  const user = await findUserByEmail(email);
  if (!user || !user.password) {
    return { error: responseMessages.authentication.invalidEmailOrPassword } as const;
  }

  const isPasswordValid = await compareAsync(password, user.password);
  if (!isPasswordValid) {
    return { error: responseMessages.authentication.invalidEmailOrPassword } as const;
  }

  return user;
};

export default {
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  loginWithEmailAndPassword,
};