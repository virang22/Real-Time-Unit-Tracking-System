import { apiRequest } from "./axios";
import type { ApiResponse, AuthResponseData, LoginPayload, RegisterPayload } from "../types/auth.types";

export async function login(payload: LoginPayload) {
  return apiRequest<ApiResponse<AuthResponseData>>("/auth/login", {
    method: "POST",
    body: payload,
  });
}

export async function register(payload: RegisterPayload) {
  return apiRequest<ApiResponse<AuthResponseData>>("/auth/register", {
    method: "POST",
    body: payload,
  });
}
