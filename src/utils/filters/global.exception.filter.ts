import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '../interfaces/response.interface';
import { ErrorLog } from '../interfaces/log.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorResponse: any = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();

      ({ message, errorResponse } = extractMessageAndError(
        responseBody,
        message,
      ));
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorLog: ErrorLog = {
      method: request.method,
      path: request.url,
      statusCode: status,
      message,
      error: errorResponse,
      stack: exception instanceof Error ? exception.stack : undefined,
    };
    const responsePayload: ErrorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    this.logger.error(errorLog);
    response.status(status).json(responsePayload);
  }
}

function extractMessageAndError(
  responseBody: unknown,
  defaultMessage: string,
): { message: string; errorResponse: any } {
  let message = defaultMessage;
  let errorResponse: any = {};

  if (typeof responseBody === 'string') {
    message = responseBody;
  } else if (typeof responseBody === 'object' && responseBody !== null) {
    message = (responseBody as any).message || message;
    errorResponse = responseBody;
  }

  return { message, errorResponse };
}
