/**
 * 数据验证工具
 * v0.9.11 P2-DATA
 * 用途：确保数据流入符合数据类型和范围约束
 *
 * v0.9.16 安全增强（audit-b4-4-security）：
 * - 新增 LLM 配置字段格式校验（VAL-001）
 * - 新增股票代码严格校验（A股/港股/美股）（VAL-003）
 * - 新增 URL 协议白名单校验（XSS-003）
 * - 新增 API Key 脱敏函数（LEAK-004）
  * @doc [V9-DOC-FRONT-037]
*/

import { safeRegex } from './safeRegex'

// ============================================================
// 配置名称验证
// ============================================================

/** 配置名称最大长度 */
const CONFIG_NAME_MAX_LENGTH = 50

/** 配置名称禁止的字符（文件系统敏感字符 + XSS 相关字符） */
const CONFIG_NAME_FORBIDDEN_CHARS = /[<>{}[\]|\\:*?"`]/

/** 配置名称禁止的控制字符 */
function containsControlChars(name: string): boolean {
  return name.split('').some((char) => {
    const code = char.charCodeAt(0)
    return (code >= 0x00 && code <= 0x1f) || code === 0x7f
  })
}

/**
 * 配置名称校验结果
 */
export interface ConfigNameValidationResult {
  valid: boolean
  error?: string
}

/**
 * 校验配置模板名称的合法性。
 *
 * 规则：
 * 1. 不能为空或纯空格
 * 2. 长度在 1-50 字符之间
 * 3. 禁止文件系统敏感字符（<>{}[]|\\:*?"`）
 * 4. 禁止控制字符
 * 5. 禁止 HTML 标签注入（<script>、<img> 等）
 * 6. 禁止危险协议（javascript:、data: 等）
 *
 * @param name 待校验的配置名称
 * @returns 校验结果（valid + 可选 error 信息）
 */
export function validateConfigName(name: string): ConfigNameValidationResult {
  if (typeof name !== 'string') {
    return { valid: false, error: '名称必须为字符串' }
  }

  const trimmed = name.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: '名称不能为空' }
  }

  if (trimmed.length > CONFIG_NAME_MAX_LENGTH) {
    return { valid: false, error: `名称长度不能超过 ${CONFIG_NAME_MAX_LENGTH} 个字符` }
  }

  if (containsControlChars(trimmed)) {
    return { valid: false, error: '名称不能包含控制字符' }
  }

  // XSS 防护：检测危险协议（在 forbidden chars 之前，避免 : 被先拦截）
  if (/^(javascript|vbscript|data|file):/i.test(trimmed)) {
    return { valid: false, error: '名称不能以危险协议开头' }
  }

  // XSS 防护：检测 HTML 标签（在 forbidden chars 之前，避免 < > 被先拦截）
  if (/<[a-zA-Z][^>]*>/.test(trimmed)) {
    return { valid: false, error: '名称不能包含 HTML 标签' }
  }

  if (CONFIG_NAME_FORBIDDEN_CHARS.test(trimmed)) {
    return { valid: false, error: '名称不能包含特殊字符（<>{}[]|\\:*?"`）' }
  }

  return { valid: true }
}

// ============================================================
// 股票代码相关验证
// ============================================================

/** A股代码：6位数字（含 SH/SZ/BJ 交易所） */
const A_SHARE_CODE_REGEX = /^\d{6}$/

/** 港股代码：5位数字 */
const HK_SHARE_CODE_REGEX = /^\d{5}$/

/** 美股代码：1-5 位字母，可选 .交易所后缀（1-2 位，如 AAPL.US） */
const US_SHARE_CODE_REGEX = /^[A-Z]{1,5}(?:\.[A-Z]{1,2})?$/

/** 股票代码格式验证（6位数字，兼容 A 股） */
export function isValidStockCode(code: string): boolean {
  return A_SHARE_CODE_REGEX.test(code)
}

/** 股票代码格式化（补零，仅适用于 A 股纯数字代码） */
export function formatStockCode(code: string | number): string {
  const str = String(code)
  // 非纯数字（如港股 00700.HK、美股 AAPL）原样返回，避免被错误补零成 '0AAPL'
  if (!/^\d+$/.test(str)) return str
  return str.padStart(6, '0')
}

/**
 * 严格的股票代码格式校验，支持 A 股 / 港股 / 美股。
 *
 * @param code 股票代码
 * @param market 市场类型，未指定时仅校验 A 股 6 位数字
 * @returns 是否合法
 */
export function isValidStockCodeStrict(
  code: string,
  market?: 'A' | 'HK' | 'US',
): boolean {
  if (typeof code !== 'string' || code.length === 0) return false
  const trimmed = code.trim()

  switch (market) {
    case 'A':
      return A_SHARE_CODE_REGEX.test(trimmed)
    case 'HK':
      return HK_SHARE_CODE_REGEX.test(trimmed)
    case 'US':
      return US_SHARE_CODE_REGEX.test(trimmed.toUpperCase())
    default:
      // 默认仅校验 A 股 6 位数字
      return A_SHARE_CODE_REGEX.test(trimmed)
  }
}

/**
 * 验证带交易所后缀的股票代码（如 600519.SH、00700.HK、AAPL.US）。
 */
export function isValidSymbolWithExchange(symbol: string): boolean {
  if (typeof symbol !== 'string' || symbol.length === 0) return false
  // 格式：CODE.EXCHANGE，如 600519.SH、000001.SZ、00700.HK
  return /^\d{6}\.(SH|SZ|BJ)$/i.test(symbol.trim())
}

// ============================================================
// 数值范围验证
// ============================================================

/** 百分比范围验证（0-100） */
export function isValidPercent(value: number): boolean {
  if (typeof value !== 'number' || isNaN(value)) return false
  return value >= 0 && value <= 100
}

/** 评分范围验证（0-100） */
export function isValidScore(value: number): boolean {
  if (typeof value !== 'number' || isNaN(value)) return false
  return value >= 0 && value <= 100
}

/** 价格正数验证 */
export function isValidPrice(value: number): boolean {
  if (typeof value !== 'number' || isNaN(value)) return false
  return value > 0 && isFinite(value)
}

/** 空值处理 */
export function safeValue<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback
}

/**
 * 安全数字解析：返回有效数字或默认值，过滤 NaN/Infinity。
 *
 * @param value 原始值（string/number）
 * @param fallback 默认值
 * @param min 最小值（可选）
 * @param max 最大值（可选）
 */
export function safeParseNumber(
  value: unknown,
  fallback: number,
  min?: number,
  max?: number,
): number {
  if (value === null || value === undefined || value === '') return fallback
  const num = typeof value === 'number' ? value : Number(value)
  if (!isFinite(num) || isNaN(num)) return fallback
  if (min !== undefined && num < min) return min
  if (max !== undefined && num > max) return max
  return num
}

// ============================================================
// LLM 配置校验（VAL-001 / XSS-003）
// ============================================================

/** 允许的 URL 协议白名单 */
const ALLOWED_URL_PROTOCOLS = ['http:', 'https:']

/** 危险的 URL 协议黑名单（明确禁止） */
const DANGEROUS_URL_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:']

/**
 * 验证 LLM baseURL 是否为合法 URL 且协议在白名单内。
 *
 * - 必须是合法 URL
 * - 协议必须为 http: 或 https:
 * - 禁止 javascript:、data:、vbscript: 等危险协议
 * - 开发环境允许 http://localhost
 *
 * @param baseURL 待校验的 baseURL
 */
export function isValidLlmBaseURL(baseURL: string): boolean {
  if (typeof baseURL !== 'string' || baseURL.trim().length === 0) return false

  const trimmed = baseURL.trim()

  // 明确拒绝危险协议
  const lower = trimmed.toLowerCase()
  if (DANGEROUS_URL_PROTOCOLS.some((p) => lower.startsWith(p))) {
    return false
  }

  try {
    const url = new URL(trimmed)
    if (!ALLOWED_URL_PROTOCOLS.includes(url.protocol)) {
      return false
    }
    return true
  } catch (err) { console.warn('[validation.ts]', err);
    return false
  }
}

/**
 * 验证 LLM API Key 格式。
 *
 * 规则：
 * - 长度 8-256
 * - 仅允许字母、数字、连字符、下划线、点
 * - 不包含空白字符、引号、尖括号
 *
 * @param apiKey 待校验的 API Key
 */
export function isValidLlmApiKey(apiKey: string): boolean {
  if (typeof apiKey !== 'string' || apiKey.length === 0) return false
  const trimmed = apiKey.trim()
  if (trimmed.length < 8 || trimmed.length > 256) return false
  // 仅允许字母、数字、连字符、下划线、点、斜杠（部分厂商 key 包含）
  return /^[A-Za-z0-9._\-/]+$/.test(trimmed)
}

/**
 * 验证 LLM 模型名称格式。
 *
 * 规则：
 * - 长度 1-128
 * - 仅允许字母、数字、连字符、下划线、点、斜杠、冒号
 *
 * @param model 待校验的模型名称
 */
export function isValidLlmModel(model: string): boolean {
  if (typeof model !== 'string' || model.length === 0) return false
  const trimmed = model.trim()
  if (trimmed.length < 1 || trimmed.length > 128) return false
  return /^[A-Za-z0-9._\-/:]+$/.test(trimmed)
}

// ============================================================
// 敏感信息脱敏（LEAK-004）
// ============================================================

/**
 * 对 API Key 进行脱敏显示。
 *
 * 规则：
 * - 长度 ≤ 8：全部替换为 ****
 * - 长度 > 8：保留前 4 位 + **** + 后 4 位
 *
 * @param apiKey 原 API Key
 * @returns 脱敏后的字符串
/**
 * 脱敏通用实现：长度 ≤ 8 全替换，否则保留前 4 后 4。
 */
function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****'
  return `${secret.slice(0, 4)}****${secret.slice(-4)}`
}

/**
 * 脱敏 API Key：仅保留首尾 4 位，中间替换为 ****。
 * @param apiKey 原始 API Key
 * @returns 脱敏后的字符串
 */
export function maskApiKey(apiKey: string): string {
  if (typeof apiKey !== 'string' || apiKey.length === 0) return '(empty)'
  return maskSecret(apiKey)
}

/**
 * 对 token 进行脱敏显示。
 *
 * @param token 原 token
 * @returns 脱敏后的字符串
 */
export function maskToken(token: string): string {
  if (typeof token !== 'string' || token.length === 0) return '(empty)'
  return maskSecret(token)
}

/**
 * 敏感字段名集合（小写匹配）。
 * 用于日志上下文的自动脱敏。
 */
export const SENSITIVE_FIELD_NAMES = [
  'apikey',
  'api_key',
  'api-key',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'password',
  'passwd',
  'pwd',
  'secret',
  'authorization',
  'auth',
  'cookie',
  'session',
  'sessionid',
  'session_id',
] as const

/**
 * 判断字段名是否为敏感字段（大小写不敏感）。
 */
export function isSensitiveField(fieldName: string): boolean {
  if (typeof fieldName !== 'string') return false
  const lower = fieldName.toLowerCase()
  return SENSITIVE_FIELD_NAMES.some((sensitive) => {
    // 精确匹配
    if (lower === sensitive) return true
    // 词边界匹配，避免 "author" 误判为 "auth"、"tokenize" 误判为 "token"
    return safeRegex(`(^|[^a-z0-9_])${sensitive}([^a-z0-9_]|$)`, 'i').test(lower)
  })
}

function sanitizeValue(key: string, value: unknown, maxDepth: number, seen: WeakSet<object>): unknown {
  if (isSensitiveField(key) && typeof value === 'string') {
    return maskApiKey(value)
  }
  if (typeof value === 'object' && value !== null) {
    return sanitizeObject(value, maxDepth - 1, seen)
  }
  return value
}

/**
 * 对任意对象进行脱敏处理，递归遍历所有字段。
 *
 * 使用 WeakSet 记录已访问对象，防止循环引用导致无限递归 / 栈溢出
 * （日志上下文对象常含环引用，如事件对象互指）。
 *
 * @param obj 原始对象
 * @param maxDepth 最大递归深度（默认 5）
 * @param seen 内部使用：已访问对象集合（循环引用保护）
 * @returns 脱敏后的新对象（不修改原对象）
 */
export function sanitizeObject<T>(
  obj: T,
  maxDepth = 5,
  seen: WeakSet<object> = new WeakSet<object>(),
): T {
  if (maxDepth < 0 || obj === null || obj === undefined || typeof obj !== 'object') return obj

  // 循环引用保护：已访问过则直接返回原引用，避免栈溢出
  if (seen.has(obj)) return obj
  seen.add(obj)

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, maxDepth - 1, seen)) as unknown as T
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = sanitizeValue(key, value, maxDepth, seen)
  }
  return result as unknown as T
}
