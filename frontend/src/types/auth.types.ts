export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  mobile: string;
  password: string;
};

export type User = {
  id: string;
  name?: string | null;
  email: string;
  mobile?: string | null;
};

export type AuthResponseData = {
  token: string;
  user: User;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};
