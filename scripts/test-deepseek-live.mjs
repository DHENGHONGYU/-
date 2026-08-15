#!/usr/bin/env node
/**
 * DeepSeek 真实 API 调用测试脚本
 *
 * 用法: DEEPSEEK_API_KEY=sk-xxx node scripts/test-deepseek-live.mjs
 *
 * 安全约束: 本脚本绝不打印 API Key 值，仅报告是否存在/HTTP 状态码/响应摘要
 */

const API_KEY = process.env.DEEPSEEK_API_KEY
const ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = 'deepseek-chat'

function maskKey(key) {
  if (!key) return 'NOT_SET'
  if (key.length <= 10) return key.slice(0, 2) + '***'
  return key.slice(0, 6) + '***' + key.slice(-4)
}

const message = process.argv[2] || '你好，请用一句话介绍你自己。'

const body = {
  model: MODEL,
  messages: [{ role: 'user', content: message }],
  temperature: 0.2,
  max_tokens: 100,
}

// ===== 安全检查 =====
if (!API_KEY) {
  console.error('[FAIL] DEEPSEEK_API_KEY 环境变量未设置')
  process.exit(1)
}

console.log('══════════════════════════════════════════════')
console.log('  DeepSeek Live API 连接测试')
console.log('══════════════════════════════════════════════')
console.log(`  API Key  : ${maskKey(API_KEY)}`)
console.log(`  Endpoint : ${ENDPOINT}`)
console.log(`  Model    : ${MODEL}`)
console.log(`  Message  : ${message}`)
console.log('──────────────────────────────────────────────')

// ===== 发送请求 =====
const startTime = performance.now()

console.log('[DEBUG] 请求发送中...')
console.log(`[DEBUG] POST ${ENDPOINT}`)
console.log(`[DEBUG] Headers: { Authorization: "Bearer ************", Content-Type: "application/json" }`)
console.log(`[DEBUG] Body: ${JSON.stringify(body, null, 2)}`)

try {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  const latencyMs = Math.round(performance.now() - startTime)

  console.log('──────────────────────────────────────────────')
  console.log(`[DEBUG] 响应接收 | Status: ${response.status} ${response.ok ? 'OK' : 'NOT OK'} | Latency: ${latencyMs}ms`)
  console.log(`[DEBUG] Content-Type: ${response.headers.get('content-type') ?? 'N/A'}`)

  const rawText = await response.text()

  if (!response.ok) {
    console.error(`\n[FAIL] HTTP 错误响应 (${response.status})`)
    console.error(`[DEBUG] 错误响应体: ${rawText.slice(0, 500)}`)
    process.exit(1)
  }

  const data = JSON.parse(rawText)

  console.log(`\n[DEBUG] 完整响应体:\n${JSON.stringify(data, null, 2)}`)

  const content = data?.choices?.[0]?.message?.content ?? '(无内容)'
  const usage = data?.usage ?? {}

  console.log('──────────────────────────────────────────────')
  console.log('  ✅ 测试通过')
  console.log('──────────────────────────────────────────────')
  console.log(`  模型       : ${data?.model ?? MODEL}`)
  console.log(`  延迟       : ${latencyMs}ms`)
  console.log(`  PromptTokens   : ${usage.prompt_tokens ?? 'N/A'}`)
  console.log(`  CompletionTokens: ${usage.completion_tokens ?? 'N/A'}`)
  console.log(`  TotalTokens    : ${usage.total_tokens ?? 'N/A'}`)
  console.log(`  响应内容 (前200字): ${content.slice(0, 200)}`)
  console.log('══════════════════════════════════════════════')
} catch (err) {
  const latencyMs = Math.round(performance.now() - startTime)
  console.error('──────────────────────────────────────────────')
  console.error(`[FAIL] 请求异常 | Latency: ${latencyMs}ms`)
  console.error(`[DEBUG] 错误类型: ${err.constructor.name}`)
  console.error(`[DEBUG] 错误消息: ${err.message}`)
  if (err.cause) {
    console.error(`[DEBUG] Cause: ${err.cause}`)
  }
  console.error('──────────────────────────────────────────────')
  process.exit(1)
}