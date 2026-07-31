import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import { WRAP_MESSAGE_KEY } from '../decorators/wrap-message.decorator';
import { SuccessResponse } from '../interfaces/response.interface';

@Injectable()
export class GlobalResponseInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const message =
      this.reflector.get<string>(WRAP_MESSAGE_KEY, context.getHandler()) ??
      'OK';

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        statusCode: response.statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
        requestId: String(request.id),
        data,
      })),
    );
  }
}
