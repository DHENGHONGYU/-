import { describe, it, expect } from 'vitest'
import {
  V9Error,
  DataLayerError,
  StockNotFoundError,
  DuplicateStockError,
  DataBridgeError,
  PermissionError,
  ValidationError,
  NetworkError,
  BusinessRuleError,
  isV9Error,
  toV9Error,
} from './errors'

describe('errors', () => {
  describe('V9Error', () => {
    it('基本构造', () => {
      const err = new V9Error('test message')
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(V9Error)
      expect(err.message).toBe('test message')
      expect(err.name).toBe('V9Error')
      expect(err.category).toBe('system')
      expect(err.code).toBe('V9_UNKNOWN')
      expect(typeof err.timestamp).toBe('number')
    })

    it('支持自定义 category 和 code', () => {
      const err = new V9Error('custom', { category: 'data', code: 'CUSTOM_CODE' })
      expect(err.category).toBe('data')
      expect(err.code).toBe('CUSTOM_CODE')
    })

    it('支持 cause', () => {
      const cause = new Error('root cause')
      const err = new V9Error('wrapped', { cause })
      expect((err as Error & { cause?: unknown }).cause).toBe(cause)
    })
  })

  describe('子类', () => {
    it('DataLayerError', () => {
      const err = new DataLayerError('db failed')
      expect(err).toBeInstanceOf(V9Error)
      expect(err.name).toBe('DataLayerError')
      expect(err.category).toBe('data')
      expect(err.code).toBe('DATA_LAYER_ERROR')
    })

    it('DataLayerError 支持自定义 code 和 cause', () => {
      const cause = new Error('io error')
      const err = new DataLayerError('failed', 'CUSTOM_DATA_ERR', cause)
      expect(err.code).toBe('CUSTOM_DATA_ERR')
      expect((err as Error & { cause?: unknown }).cause).toBe(cause)
    })

    it('StockNotFoundError', () => {
      const err = new StockNotFoundError('600519')
      expect(err).toBeInstanceOf(V9Error)
      expect(err.name).toBe('StockNotFoundError')
      expect(err.category).toBe('business')
      expect(err.code).toBe('STOCK_NOT_FOUND')
      expect(err.message).toContain('600519')
    })

    it('DuplicateStockError', () => {
      const err = new DuplicateStockError('AAPL')
      expect(err.name).toBe('DuplicateStockError')
      expect(err.code).toBe('DUPLICATE_STOCK')
      expect(err.message).toContain('AAPL')
    })

    it('DataBridgeError', () => {
      const err = new DataBridgeError('bridge failed')
      expect(err.name).toBe('DataBridgeError')
      expect(err.category).toBe('data')
      expect(err.code).toBe('DATA_BRIDGE_ERROR')
    })

    it('PermissionError', () => {
      const err = new PermissionError('denied')
      expect(err.name).toBe('PermissionError')
      expect(err.category).toBe('permission')
      expect(err.code).toBe('PERMISSION_DENIED')
    })

    it('ValidationError - 无字段', () => {
      const err = new ValidationError('invalid input')
      expect(err.name).toBe('ValidationError')
      expect(err.category).toBe('validation')
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.field).toBeUndefined()
    })

    it('ValidationError - 有字段', () => {
      const err = new ValidationError('bad email', 'email')
      expect(err.field).toBe('email')
      expect(err.code).toBe('INVALID_EMAIL')
    })

    it('NetworkError - 无状态码', () => {
      const err = new NetworkError('timeout')
      expect(err.name).toBe('NetworkError')
      expect(err.category).toBe('network')
      expect(err.code).toBe('NETWORK_ERROR')
      expect(err.status).toBeUndefined()
    })

    it('NetworkError - 有状态码', () => {
      const err = new NetworkError('not found', 404)
      expect(err.status).toBe(404)
      expect(err.code).toBe('HTTP_404')
    })

    it('NetworkError - 有 cause', () => {
      const cause = new TypeError('fetch failed')
      const err = new NetworkError('fail', undefined, cause)
      expect((err as Error & { cause?: unknown }).cause).toBe(cause)
    })

    it('BusinessRuleError', () => {
      const err = new BusinessRuleError('rule violated')
      expect(err.name).toBe('BusinessRuleError')
      expect(err.category).toBe('business')
      expect(err.code).toBe('BUSINESS_RULE_VIOLATION')
    })

    it('BusinessRuleError 支持自定义 code', () => {
      const err = new BusinessRuleError('custom', 'CUSTOM_RULE')
      expect(err.code).toBe('CUSTOM_RULE')
    })
  })

  describe('isV9Error()', () => {
    it('V9Error 及其子类返回 true', () => {
      expect(isV9Error(new V9Error('test'))).toBe(true)
      expect(isV9Error(new DataLayerError('x'))).toBe(true)
      expect(isV9Error(new ValidationError('x'))).toBe(true)
    })

    it('普通 Error 返回 false', () => {
      expect(isV9Error(new Error('plain'))).toBe(false)
    })

    it('非 Error 值返回 false', () => {
      expect(isV9Error('string')).toBe(false)
      expect(isV9Error(null)).toBe(false)
      expect(isV9Error(undefined)).toBe(false)
      expect(isV9Error(42)).toBe(false)
      expect(isV9Error({})).toBe(false)
    })
  })

  describe('toV9Error()', () => {
    it('已是 V9Error 则原样返回', () => {
      const err = new DataLayerError('db fail')
      const result = toV9Error(err)
      expect(result).toBe(err)
    })

    it('普通 Error 包装为 V9Error', () => {
      const plain = new Error('plain error')
      const result = toV9Error(plain)
      expect(result).toBeInstanceOf(V9Error)
      expect(result.message).toBe('plain error')
      expect((result as Error & { cause?: unknown }).cause).toBe(plain)
    })

    it('字符串包装为 V9Error', () => {
      const result = toV9Error('string error')
      expect(result).toBeInstanceOf(V9Error)
      expect(result.message).toBe('string error')
    })

    it('对象通过 JSON.stringify 描述', () => {
      const result = toV9Error({ key: 'value' })
      expect(result.message).toBe('{"key":"value"}')
    })

    it('支持自定义 fallback code', () => {
      const result = toV9Error('x', 'CUSTOM_FALLBACK')
      expect(result.code).toBe('CUSTOM_FALLBACK')
    })

    it('null 值安全处理', () => {
      const result = toV9Error(null)
      expect(result).toBeInstanceOf(V9Error)
    })
  })
})
