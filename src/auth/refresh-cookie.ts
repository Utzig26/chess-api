import { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/auth';

function baseOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(
  response: Response,
  token: string,
  expiresAt: Date,
  isProduction: boolean,
): void {
  response.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(isProduction),
    expires: expiresAt,
  });
}

export function clearRefreshCookie(
  response: Response,
  isProduction: boolean,
): void {
  response.clearCookie(REFRESH_COOKIE_NAME, baseOptions(isProduction));
}
