#!/usr/bin/env tsx
/**
 * @fileoverview 验证 Tushare Pro Token 配置与连通性
 *
 * 运行方式：
 *   1. 命令行（推荐）：npx tsx scripts/verify-tushare-token.ts
 *      不在 Vite 环境时，脚本会读取 .env.local 并尝试直接调用 Tushare API 验证。
 *   2. Vite 环境内：由 Vite 页面/插件调用，自动使用 import.meta.env，
 *      请求经 Vite 代理 /api/proxy/tushare 转发。
 *
 * 验证目标：
 *   - 调用 stock_basic 接口，查询 600519.SH（贵州茅台）
 *   - 期望返回 name 字段为"贵州茅台"
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = resolve(__dirname, '..')

const TUSHARE_DIRECT_API = 'https://api.tushare.pro'
const VITE_PROXY_BASE = 'http://localhost:3000/api/proxy/tushare'

/** Tushare API 请求体 */
interface TushareRequestBody {
  api_name: string
  token: string
  params: Record<string, string | number | string[]>
  fields?: string
}

/** Tushare API 通用响应 */
interface TushareResponse {
  request_id: string
  code: number
  msg: string
  data: {
    fields: string[]
    items: unknown[]
  } | null
}

/** 验证结果 */
interface VerificationResult {
  success: boolean
  records: Record<string, unknown>[]
  code: number
  msg: string
}

declare global {
  // eslint-disable-next-line no-var
  var __TUSHARE_TOKEN__: string | undefined
}

/** 解析 .env.local 中的 KEY=VALUE 行（忽略注释与空行） */
function loadEnvLocal(): Record<string, string> {
  const envPath = resolve(ROOT_DIR, '.env.local')
  const env: Record<string, string> = {}
  if (!existsSync(envPath)) {
    return env
  }
  const content = readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const idx = line.indexOf('=')
    if (idx === -1) {
      continue
    }
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    env[key] = value
  }
  return env
}

/** 按优先级读取 Token：globalThis > import.meta.env > .env.local */
function getToken(): string | null {
  if (typeof globalThis.__TUSHARE_TOKEN__ === 'string' && globalThis.__TUSHARE_TOKEN__) {
    return globalThis.__TUSHARE_TOKEN__
  }
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_TUSHARE_TOKEN === 'string' &&
    import.meta.env.VITE_TUSHARE_TOKEN
  ) {
    return import.meta.env.VITE_TUSHARE_TOKEN
  }
  const env = loadEnvLocal()
  if (env.VITE_TUSHARE_TOKEN) {
    return env.VITE_TUSHARE_TOKEN
  }
  return null
}

/** 判断是否在 Vite 构建/运行环境 */
function isViteEnvironment(): boolean {
  return typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined'
}

/** 带超时的 fetch */
async function safeFetch(input: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** 将 Tushare items 数组映射为对象数组 */
function mapItemsToRecords(fields: string[], items: unknown[]): Record<string, unknown>[] {
  return items.map((row) => {
    const record: Record<string, unknown> = {}
    if (!Array.isArray(row)) {
      return record
    }
    fields.forEach((field, index) => {
      record[field] = row[index]
    })
    return record
  })
}

/**
 * 非 Vite 环境直接调用 Tushare API。
 * 先尝试本地 Vite 代理（需 npm run dev 已启动），失败则直连 Tushare。
 */
async function verifyDirect(token: string): Promise<VerificationResult> {
  const body: TushareRequestBody = {
    api_name: 'stock_basic',
    token,
    params: { ts_code: '600519.SH' },
    fields: 'ts_code,name,industry,list_date',
  }

  const urls = [`${VITE_PROXY_BASE}`, `${TUSHARE_DIRECT_API}`]
  let lastError = ''

  for (const url of urls) {
    try {
      const resp = await safeFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await resp.json()) as TushareResponse
      if (json.code !== 0) {
        return {
          success: false,
          records: [],
          code: json.code,
          msg: json.msg || `Tushare 接口错误 (code=${json.code})`,
        }
      }
      if (!json.data || !Array.isArray(json.data.items)) {
        return { success: true, records: [], code: 0, msg: 'API 返回成功，但无数据' }
      }
      return {
        success: true,
        records: mapItemsToRecords(json.data.fields, json.data.items),
        code: 0,
        msg: 'ok',
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  return { success: false, records: [], code: -1, msg: `所有端点均失败: ${lastError}` }
}

/** Vite 环境内使用 tushareProvider.tushareRequest 经代理验证 */
async function verifyViaTushareRequest(token: string): Promise<VerificationResult> {
  globalThis.__TUSHARE_TOKEN__ = token
  const { tushareRequest } = await import('@/services/data-collector/tushareProvider')
  try {
    const records = await tushareRequest('stock_basic', { ts_code: '600519.SH' })
    return { success: true, records, code: 0, msg: 'ok' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, records: [], code: -1, msg }
  }
}

/** 主入口 */
async function main(): Promise<void> {
  console.log('🔍 Tushare Pro Token 验证脚本')

  const token = getToken()
  if (!token) {
    console.error('\n❌ Tushare Pro Token 未配置')
    console.error('请在 .env.local 中设置 VITE_TUSHARE_TOKEN=your_token_here')
    console.error('docs/reference/tushare-token-setup.md')
    console.error('或在运行本脚本前通过 globalThis.__TUSHARE_TOKEN__ 注入')
    process.exit(1)
  }

  const maskedToken = `${token.slice(0, 4)}****${token.slice(-4)}`
  console.log(`✅ Token 已配置: ${maskedToken} (长度 ${token.length})`)

  const viteEnv = isViteEnvironment()
  let result: VerificationResult

  if (viteEnv) {
    console.log('🌐 检测到 Vite 环境，通过 Vite 代理 /api/proxy/tushare 验证')
    result = await verifyViaTushareRequest(token)
  } else {
    console.log('⚠️  未检测到 Vite 环境（import.meta.env 不可用）')
    console.log('    将尝试通过本地代理 http://localhost:3000/api/proxy/tushare 或直接调用 Tushare API 验证')
    console.log('    如需通过 Vite 代理验证，请先运行 npm run dev，再通过浏览器页面或 vite-node 执行本脚本')
    result = await verifyDirect(token)
  }

  if (!result.success) {
    console.error(`\n❌ 验证失败: ${result.msg}`)
    process.exit(1)
  }

  const record = result.records[0] as Record<string, unknown> | undefined
  const name = record?.name as string | undefined
  const tsCode = record?.ts_code as string | undefined

  console.log('\n✅ Tushare API 连通性验证成功')
  console.log(`   返回状态: code=${result.code}, msg=${result.msg}`)
  console.log(`   股票代码: ${tsCode ?? 'N/A'}`)
  console.log(`   股票名称: ${name ?? 'N/A'}`)
  console.log(`   是否匹配预期（贵州茅台）: ${name === '贵州茅台' ? '是' : '否'}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('💥 脚本执行异常:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
