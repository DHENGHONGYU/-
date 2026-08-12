/**
 * 非LLM密钥的安全配置服务
 *
 * 管理数据源 Token（Tushare）和辅助 LLM Key（Qwen）的加密存储。
 * 采用与 {@link llmConfig.ts} 相同的 AES-GCM 256 加密方案，
 * 不再从 VITE_ 环境变量读取（VITE_ 前缀会暴露到前端 bundle）。
 *
 * v2 新增：密钥轮换机制
 * - 每个密钥维护独立的元数据（setAt / lastVerifiedAt）
 * - 默认 TTL 30 天，超期后 UI 层可提示用户轮换
 * - 提供 isExpired / getAge / markVerified API
 *
 * @doc [V9-DOC-BACK-012, V9-DOC-AI-006]
 */

import { defaultStorage } from '@/lib/localStorageManager'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 密钥轮换常量
// ============================================================

/** 默认密钥 TTL：30 天（毫秒） */
const SECRET_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** 密钥元数据接口 */
export interface SecretMeta {
  /** 密钥写入时间戳 (ms) */
  setAt: number
  /** 最后一次验证时间戳 (ms)，用于记录用户确认密钥仍然有效的时间 */
  lastVerifiedAt: number
}

// ============================================================
// 元数据读写工具
// ============================================================

function getMetaStorageKey(secretKey: string): string {
  return `${secretKey}_meta`
}

function readMeta(secretKey: string): SecretMeta | null {
  try {
    const fullKey = `app:${getMetaStorageKey(secretKey)}`
    const raw = localStorage.getItem(fullKey)
    if (!raw) return null
    return JSON.parse(raw) as SecretMeta
  } catch {
    return null
  }
}

function writeMeta(secretKey: string, meta: SecretMeta): void {
  const fullKey = `app:${getMetaStorageKey(secretKey)}`
  localStorage.setItem(fullKey, JSON.stringify(meta))
}

function removeMeta(secretKey: string): void {
  try {
    const fullKey = `app:${getMetaStorageKey(secretKey)}`
    localStorage.removeItem(fullKey)
  } catch {
    // silent
  }
}

// ============================================================
// Tushare Token
// ============================================================

const TUSHARE_TOKEN_STORAGE = 'tushare_token'

/**
 * 异步读取加密存储的 Tushare Token。
 */
export async function getTushareTokenAsync(): Promise<string> {
  try {
    const token = await defaultStorage.getEncrypted<string>(TUSHARE_TOKEN_STORAGE)
    const result = token ? token : ''
    if (!result) {
      logger.debug('[secretConfig] Tushare Token 为空或未配置')
    } else {
      logger.info(`[secretConfig] Tushare Token 读取成功, 长度=${result.length}`)
    }
    return result
  } catch (err) {
    logger.warn('[secretConfig] 读取加密 Tushare Token 失败', { error: err })
    return ''
  }
}

/**
 * 异步保存 Tushare Token 到加密存储，同时记录元数据。
 */
export async function setTushareToken(token: string): Promise<void> {
  if (!token.trim()) {
    await defaultStorage.remove(TUSHARE_TOKEN_STORAGE)
    removeMeta(TUSHARE_TOKEN_STORAGE)
    logger.info('[secretConfig] 已清除 Tushare Token')
    return
  }
  const now = Date.now()
  await defaultStorage.setEncrypted(TUSHARE_TOKEN_STORAGE, token.trim())
  writeMeta(TUSHARE_TOKEN_STORAGE, { setAt: now, lastVerifiedAt: now })
  logger.info('[secretConfig] Tushare Token 已加密保存')
}

/**
 * 检查 Tushare Token 是否已配置（同步，仅检查条目是否存在）。
 */
export function isTushareTokenConfigured(): boolean {
  try {
    const fullKey = `app:${TUSHARE_TOKEN_STORAGE}`
    const raw = localStorage.getItem(fullKey)
    return !!(raw && raw.includes('__encrypted'))
  } catch {
    return false
  }
}

/**
 * 检查 Tushare Token 是否已超过 TTL（默认 30 天），建议轮换。
 * 未配置时返回 false（未配置不算过期，由 isConfigured 判断）。
 */
export function isTushareTokenExpired(ttlMs: number = SECRET_TTL_MS): boolean {
  if (!isTushareTokenConfigured()) return false
  const meta = readMeta(TUSHARE_TOKEN_STORAGE)
  if (!meta) return false
  return Date.now() - meta.setAt > ttlMs
}

/**
 * 获取 Tushare Token 的存活天数（自写入起）。
 * 未配置或无元数据时返回 0。
 */
export function getTushareTokenAgeDays(): number {
  const meta = readMeta(TUSHARE_TOKEN_STORAGE)
  if (!meta) return 0
  return Math.floor((Date.now() - meta.setAt) / (24 * 60 * 60 * 1000))
}

/**
 * 获取 Tushare Token 距离上次验证的天数。
 * 未验证过返回 -1。
 */
export function getTushareTokenDaysSinceVerification(): number {
  const meta = readMeta(TUSHARE_TOKEN_STORAGE)
  if (!meta || meta.lastVerifiedAt === meta.setAt) return -1
  return Math.floor((Date.now() - meta.lastVerifiedAt) / (24 * 60 * 60 * 1000))
}

/**
 * 标记 Tushare Token 已验证（用户确认密钥仍然有效）。
 */
export function markTushareTokenVerified(): void {
  const meta = readMeta(TUSHARE_TOKEN_STORAGE)
  if (!meta) return
  meta.lastVerifiedAt = Date.now()
  writeMeta(TUSHARE_TOKEN_STORAGE, meta)
  logger.info('[secretConfig] Tushare Token 已标记为已验证')
}

// ============================================================
// Qwen API Key
// ============================================================

const QWEN_API_KEY_STORAGE = 'qwen_api_key'

/**
 * 异步读取加密存储的 Qwen API Key。
 */
export async function getQwenApiKeyAsync(): Promise<string> {
  try {
    const key = await defaultStorage.getEncrypted<string>(QWEN_API_KEY_STORAGE)
    const result = key ? key : ''
    if (!result) {
      logger.debug('[secretConfig] Qwen API Key 为空或未配置')
    } else {
      logger.info(`[secretConfig] Qwen API Key 读取成功, 长度=${result.length}`)
    }
    return result
  } catch (err) {
    logger.warn('[secretConfig] 读取加密 Qwen API Key 失败', { error: err })
    return ''
  }
}

/**
 * 异步保存 Qwen API Key 到加密存储，同时记录元数据。
 */
export async function setQwenApiKey(key: string): Promise<void> {
  if (!key.trim()) {
    await defaultStorage.remove(QWEN_API_KEY_STORAGE)
    removeMeta(QWEN_API_KEY_STORAGE)
    logger.info('[secretConfig] 已清除 Qwen API Key')
    return
  }
  const now = Date.now()
  await defaultStorage.setEncrypted(QWEN_API_KEY_STORAGE, key.trim())
  writeMeta(QWEN_API_KEY_STORAGE, { setAt: now, lastVerifiedAt: now })
  logger.info('[secretConfig] Qwen API Key 已加密保存')
}

/**
 * 检查 Qwen API Key 是否已配置（同步，仅检查条目是否存在）。
 */
export function isQwenApiKeyConfigured(): boolean {
  try {
    const fullKey = `app:${QWEN_API_KEY_STORAGE}`
    const raw = localStorage.getItem(fullKey)
    return !!(raw && raw.includes('__encrypted'))
  } catch {
    return false
  }
}

/**
 * 检查 Qwen API Key 是否已超过 TTL（默认 30 天），建议轮换。
 */
export function isQwenApiKeyExpired(ttlMs: number = SECRET_TTL_MS): boolean {
  if (!isQwenApiKeyConfigured()) return false
  const meta = readMeta(QWEN_API_KEY_STORAGE)
  if (!meta) return false
  return Date.now() - meta.setAt > ttlMs
}

/**
 * 获取 Qwen API Key 的存活天数。
 */
export function getQwenApiKeyAgeDays(): number {
  const meta = readMeta(QWEN_API_KEY_STORAGE)
  if (!meta) return 0
  return Math.floor((Date.now() - meta.setAt) / (24 * 60 * 60 * 1000))
}

/**
 * 获取 Qwen API Key 距离上次验证的天数。
 */
export function getQwenApiKeyDaysSinceVerification(): number {
  const meta = readMeta(QWEN_API_KEY_STORAGE)
  if (!meta || meta.lastVerifiedAt === meta.setAt) return -1
  return Math.floor((Date.now() - meta.lastVerifiedAt) / (24 * 60 * 60 * 1000))
}

/**
 * 标记 Qwen API Key 已验证。
 */
export function markQwenApiKeyVerified(): void {
  const meta = readMeta(QWEN_API_KEY_STORAGE)
  if (!meta) return
  meta.lastVerifiedAt = Date.now()
  writeMeta(QWEN_API_KEY_STORAGE, meta)
  logger.info('[secretConfig] Qwen API Key 已标记为已验证')
}

// ============================================================
// 密钥健康总览（供 bootstrapService / UI 调用）
// ============================================================

export interface SecretHealthItem {
  name: string
  configured: boolean
  expired: boolean
  ageDays: number
  daysSinceVerification: number
}

/**
 * 获取所有非LLM密钥的健康状态快照。
 */
export function getSecretHealthSnapshot(): SecretHealthItem[] {
  return [
    {
      name: 'Tushare Token',
      configured: isTushareTokenConfigured(),
      expired: isTushareTokenExpired(),
      ageDays: getTushareTokenAgeDays(),
      daysSinceVerification: getTushareTokenDaysSinceVerification(),
    },
    {
      name: 'Qwen API Key',
      configured: isQwenApiKeyConfigured(),
      expired: isQwenApiKeyExpired(),
      ageDays: getQwenApiKeyAgeDays(),
      daysSinceVerification: getQwenApiKeyDaysSinceVerification(),
    },
  ]
}
