// HTTP 错误分类
export enum HttpErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',        // 网络断开/超时
  TIMEOUT = 'TIMEOUT',                    // 请求超时
  UNAUTHORIZED = 'UNAUTHORIZED',          // 401 未授权
  FORBIDDEN = 'FORBIDDEN',               // 403 禁止
  NOT_FOUND = 'NOT_FOUND',               // 404 未找到
  RATE_LIMITED = 'RATE_LIMITED',         // 429 限流
  SERVER_ERROR = 'SERVER_ERROR',           // 5xx 服务器错误
  UNKNOWN = 'UNKNOWN',                   // 未知错误
}

// HTTP 错误类
/**
 * HttpError
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly type: HttpErrorType,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

// 错误码到类型的映射
/**
 * getHttpErrorType
 * @param statusCode
 * @returns HttpErrorType
 */
export function getHttpErrorType(statusCode: number): HttpErrorType {
  if (statusCode === 401) return HttpErrorType.UNAUTHORIZED
  if (statusCode === 403) return HttpErrorType.FORBIDDEN
  if (statusCode === 404) return HttpErrorType.NOT_FOUND
  if (statusCode === 429) return HttpErrorType.RATE_LIMITED
  if (statusCode >= 500) return HttpErrorType.SERVER_ERROR
  return HttpErrorType.UNKNOWN
}
