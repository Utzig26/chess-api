export type TokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  username: string;
  type: TokenType;
}

export interface RefreshTokenPayload extends JwtPayload {
  type: 'refresh';
  family: string;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
}
