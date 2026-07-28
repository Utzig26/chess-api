import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MongoServerError } from 'mongodb';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ErrorResponse } from '../interfaces/response.interface';

const DUPLICATE_KEY_ERROR = 11000;

interface NormalizedException {
  status: number;
  message: string;
  errors?: string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, message, errors } = this.normalize(exception);

    const payload: ErrorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      requestId: String(request.id),
      ...(errors ? { errors } : {}),
    };

    this.log(status, message, exception);

    response.status(status).json(payload);
  }

  private normalize(exception: unknown): NormalizedException {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (this.isDuplicateKeyError(exception)) {
      return {
        status: HttpStatus.CONFLICT,
        message: 'Resource already exists',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private fromHttpException(exception: HttpException): NormalizedException {
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'string') {
      return { status, message: body };
    }

    const { message } = body as { message?: string | string[] };

    if (Array.isArray(message)) {
      return { status, message: 'Validation failed', errors: message };
    }

    return { status, message: message ?? exception.message };
  }

  private isDuplicateKeyError(exception: unknown): boolean {
    return (
      exception instanceof MongoServerError &&
      exception.code === DUPLICATE_KEY_ERROR
    );
  }

  private log(status: number, message: string, exception: unknown): void {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error({ statusCode: status, stack }, message);
      return;
    }

    this.logger.warn({ statusCode: status }, message);
  }
}
