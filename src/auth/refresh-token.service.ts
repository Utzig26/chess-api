import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schema/refresh-token.schema';
import { RefreshTokenPayload } from './interfaces/jwt-payload.interface';
import { UserDocument } from '../users/schema/user.schema';
import { JwtConfig } from '../config/configuration';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  user: { id: string; username: string };
}

@Injectable()
export class RefreshTokenService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    private jwtService: JwtService,
    config: ConfigService,
  ) {
    this.jwtConfig = config.getOrThrow<JwtConfig>('jwt');
  }

  async issue(
    user: UserDocument,
    family: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        type: 'refresh',
        family,
        jti: randomUUID(),
      },
      {
        secret: this.jwtConfig.refreshSecret,
        expiresIn: this.jwtConfig.refreshTtl,
      },
    );

    const expiresAt = this.expiryOf(token);

    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(user.id),
      tokenHash: this.hash(token),
      family,
      expiresAt,
    });

    return { token, expiresAt };
  }

  async rotate(rawToken: string): Promise<RotatedRefreshToken> {
    const payload = this.verify(rawToken);
    const stored = await this.refreshTokenModel
      .findOne({ tokenHash: this.hash(rawToken) })
      .exec();

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      await this.revokeFamily(stored.family);
      throw new UnauthorizedException('Refresh token already used');
    }

    const issued = await this.issue(
      { id: payload.sub, username: payload.username } as UserDocument,
      stored.family,
    );

    stored.revokedAt = new Date();
    stored.replacedBy = this.hash(issued.token);
    await stored.save();

    return {
      ...issued,
      user: { id: payload.sub, username: payload.username },
    };
  }

  async revokeByToken(rawToken: string): Promise<void> {
    const stored = await this.refreshTokenModel
      .findOne({ tokenHash: this.hash(rawToken) })
      .exec();

    if (stored) {
      await this.revokeFamily(stored.family);
    }
  }

  async revokeFamily(family: string): Promise<void> {
    await this.refreshTokenModel
      .updateMany({ family, revokedAt: null }, { revokedAt: new Date() })
      .exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenModel
      .updateMany(
        { userId: new Types.ObjectId(userId), revokedAt: null },
        { revokedAt: new Date() },
      )
      .exec();
  }

  private verify(rawToken: string): RefreshTokenPayload {
    let payload: RefreshTokenPayload;

    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(rawToken, {
        secret: this.jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    return payload;
  }

  private expiryOf(token: string): Date {
    const { exp } = this.jwtService.decode<RefreshTokenPayload>(token);

    return new Date(exp * 1000);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
