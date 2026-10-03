export interface Response {
    success: boolean;
    message: string;
    data?: unknown;
    totalData?: number;
}

export interface CustomError {
    status?: number;
    message: string;
    stack?: string;
    name: string;
    code?: string;
}