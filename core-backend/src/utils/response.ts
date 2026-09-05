import { Response } from 'express';

export const sendSuccess = (
  res: Response,
  data: any,
  message: string = 'Success',
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message: string = 'Internal Server Error',
  statusCode: number = 500,
  errors: any = null
) => {
  // Surface unexpected 5xx responses (with the caller's stack) so they are
  // never silent — many route handlers catch and sendError directly.
  if (statusCode >= 500) {
    const err = (errors as any)?.stack ? errors : new Error(message);
    console.error(`[API-${statusCode}] ${message}`, err?.stack || '');
  }
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
