import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';

  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error]', { statusCode, code, message, stack: err.stack });
  } else {
    console.error('[Error]', { statusCode, code, message });
  }

  res.status(statusCode).json({
    data: null,
    error: {
      message,
      code,
    },
  });
}

export function createError(
  message: string,
  statusCode: number,
  code: string
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
