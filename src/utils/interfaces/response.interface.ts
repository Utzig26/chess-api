export interface BaseHttpResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
}
export interface ErrorResponse extends BaseHttpResponse {
  success: false;
  error?: any;
}
export interface SuccessResponse<T = any> extends BaseHttpResponse {
  success: true;
  data: T;
}
