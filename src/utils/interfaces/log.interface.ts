export interface ErrorLog {
  method: string;
  path: string;
  statusCode: number;
  message: string;
  error?: any;
  stack?: string;
  timestamp?: string;
}
