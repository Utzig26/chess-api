export type TokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  username: string;
  type: TokenType;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
}
