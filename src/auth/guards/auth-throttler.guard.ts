import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerStorage,
  getStorageToken,
} from '@nestjs/throttler';
import { ThrottleConfig } from '../../config/configuration';

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected errorMessage = 'Too many attempts, try again later';

  constructor(
    @Inject(getStorageToken()) storage: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
    @Inject(ConfigService) config: ConfigService,
  ) {
    const { ttl, authLimit } = config.getOrThrow<ThrottleConfig>('throttle');

    super(
      { throttlers: [{ name: 'auth', ttl, limit: authLimit }] },
      storage,
      reflector,
    );
  }
}
