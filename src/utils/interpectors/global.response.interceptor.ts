import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { SuccessResponse } from '../interfaces/response.interface';
import { Reflector } from '@nestjs/core';

@Injectable()
export class GlobalResponseInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    const reflector = new Reflector();
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const status = ctx.getResponse().statusCode;

    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: req.url,
        message:
          reflector.get<string>('wrapMessage', context.getHandler()) || 'OK',
        data,
      })),
    );
  }
}
