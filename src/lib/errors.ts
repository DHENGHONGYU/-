/**
 * V9 统一错误类型定义
 *
 * @description
 * 集中定义 V9 项目中常见的错误子类，避免业务代码直接抛出匿名 Error。
 * 所有错误均以 V9Error 为基类，可通过 `err instanceof V9Error` 统一识别与日志分类。
 *
 * @module lib/errors
 * @created 2026-06-30 - G1 批次低风险优化（错误类型细分）
/**
 * V9 错误基类
 *
 * 业务层、UI 层应当捕获此基类的子类，并通过 `error.category` / `error.code` 路由到
 * 不同的提示与上报通道。
 */
export class V9Error extends Error {
  /** 错误分类，用于日志与 UI 区分 */
  public readonly category: 'data' | 'network' | 'validation' | 'permission' | 'business' | 'system'
  /** 错误码，建议在 docs/explanation/10-glossary.md 维护统一注册表 */
  public readonly code: string
  /** 错误发生时间戳 */
  public readonly timestamp: number

  constructor(
    message: string,
    options: {
      category?: V9Error['category']
      code?: string
      cause?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'V9Error'
    this.category = options.category ?? 'system'
    this.code = options.code ?? 'V9_UNKNOWN'
    this.timestamp = Date.now()
    if (options.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = options.cause
    }
  }
}

/**
 * 数据层错误（IndexedDB / DataBridge 写读失败）
 */
export class DataLayerError extends V9Error {
  constructor(message: string, code = 'DATA_LAYER_ERROR', cause?: unknown) {
    super(message, { category: 'data', code, cause })
    this.name = 'DataLayerError'
  }
}

/**
 * 股票不存在错误（业务层查找）
 */
export class StockNotFoundError extends V9Error {
  constructor(symbol: string) {
    super(`Stock not found: ${symbol}`, { category: 'business', code: 'STOCK_NOT_FOUND' })
    this.name = 'StockNotFoundError'
  }
}

/**
 * 重复股票错误
 */
export class DuplicateStockError extends V9Error {
  constructor(symbol: string) {
    super(`Stock already exists: ${symbol}`, { category: 'business', code: 'DUPLICATE_STOCK' })
    this.name = 'DuplicateStockError'
  }
}

/**
 * 信封/数据桥接错误（DataBridge 校验/分发失败）
 */
export class DataBridgeError extends V9Error {
  constructor(message: string, code = 'DATA_BRIDGE_ERROR', cause?: unknown) {
    super(message, { category: 'data', code, cause })
    this.name = 'DataBridgeError'
  }
}

/**
 * 权限/ACL 错误
 */
export class PermissionError extends V9Error {
  constructor(message: string, code = 'PERMISSION_DENIED') {
    super(message, { category: 'permission', code })
    this.name = 'PermissionError'
  }
}

/**
 * 输入校验错误（表单、payload 校验失败）
 */
export class ValidationError extends V9Error {
  public readonly field?: string
  constructor(message: string, field?: string) {
    super(message, { category: 'validation', code: field ? `INVALID_${field.toUpperCase()}` : 'VALIDATION_ERROR' })
    this.name = 'ValidationError'
    this.field = field
  }
}

/**
 * 网络层错误（fetcher / LLM 调用失败）
 */
export class NetworkError extends V9Error {
  public readonly status?: number
  constructor(message: string, status?: number, cause?: unknown) {
    super(message, { category: 'network', code: status ? `HTTP_${status}` : 'NETWORK_ERROR', cause })
    this.name = 'NetworkError'
    this.status = status
  }
}

/**
 * 业务规则错误（风控阻断、信号过滤等）
 */
export class BusinessRuleError extends V9Error {
  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION') {
    super(message, { category: 'business', code })
    this.name = 'BusinessRuleError'
  }
}

/**
 * 类型守卫：判断对象是否为 V9Error 子类
 */
export function isV9Error(err: unknown): err is V9Error {
  return err instanceof V9Error
}

/**
 * 将任意异常安全转换为 V9Error。
 * - 已为 V9Error 子类 → 原样返回
 * - 已是 Error → 包装为 V9Error
 * - 其余值 → 包装为含 String() 描述的 V9Error
 */
export function toV9Error(err: unknown, fallbackCode = 'V9_UNKNOWN'): V9Error {
  if (isV9Error(err)) return err
  if (err instanceof Error) {
    return new V9Error(err.message, { cause: err, code: fallbackCode })
  }
  return new V9Error(typeof err === 'string' ? err : JSON.stringify(err), { code: fallbackCode })
}
