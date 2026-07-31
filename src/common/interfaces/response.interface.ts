export interface BaseHttpResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  requestId: string;
}

export interface ErrorResponse extends BaseHttpResponse {
  success: false;
  errors?: string[];
}

export interface SuccessResponse<T = unknown> extends BaseHttpResponse {
  success: true;
  data: T;
}
