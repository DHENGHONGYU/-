/**
 * @fileoverview LLM JSON 响应解析工具。
 *
 * 处理 LLM 常见的"JSON 被 Markdown 代码块包裹/前后有自然语言/截断"等非严格输出：
 *   1. 优先尝试直接 JSON.parse
 *   2. 失败则提取首对最外层大括号 / 中括号
 *   3. 再失败则执行宽松修复（未转义引号/尾随逗号/单行注释）
 *   4. 全部失败返回 undefined，由调用方决定降级策略
 *
 * @module services/llm/jsonParser
 */

import type { LogContext } from '@/lib/logger'

interface MinimalLogger {
  warn?(message: string, context?: LogContext): void
  debug?(message: string, context?: LogContext): void
  error?(message: string, context?: LogContext): void
}

/**
 * 宽松 JSON 解析 —— 容错 LLM 非严格输出。
 *
 * @param raw       LLM 返回的原始字符串（允许含 Markdown 代码块/前后叙述）
 * @param _schema   预留参数（当前未实现 schema 校验，保持签名稳定供后续扩展）
 * @param logger    可选；传入时会记录 warn 级解析告警，便于排查 LLM 输出质量
 * @returns 解析成功返回 T；解析失败返回 undefined
 */
export function parseLlmJson<T = unknown>(
  raw: string,
  _schema?: undefined,
  logger?: MinimalLogger,
): T | undefined {
  if (raw === null || raw === undefined) {
    logger?.warn?.('[parseLlmJson] 输入为空')
    return undefined
  }

  let input = String(raw).trim()
  if (!input) {
    logger?.warn?.('[parseLlmJson] 输入为空白字符串')
    return undefined
  }

  // 1) 剥离 Markdown ```json ... ``` 代码块
  const fenceMatch = input.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fenceMatch && fenceMatch[1]) {
    input = fenceMatch[1].trim()
  }

  // 2) 原始 parse（绝大多数正常场景走这里，最快路径）
  const try1 = tryParse<T>(input)
  if (try1.success) return try1.value

  // 3) 提取最外层大括号/中括号，应对 "好的，给你：{ ... } 其他废话"
  const extracted = extractOuterJson(input)
  if (extracted && extracted !== input) {
    const try2 = tryParse<T>(extracted)
    if (try2.success) {
      logger?.warn?.(`[parseLlmJson] 通过边界提取成功解析 (len=${extracted.length})`)
      return try2.value
    }
  }

  // 4) 宽松修复：针对常见 LLM 坏 JSON 模式
  const relaxed = relaxJson(input)
  const try3 = tryParse<T>(relaxed)
  if (try3.success) {
    logger?.warn?.('[parseLlmJson] 通过宽松修复成功解析')
    return try3.value
  }
  if (extracted && extracted !== input) {
    const try4 = tryParse<T>(relaxJson(extracted))
    if (try4.success) {
      logger?.warn?.('[parseLlmJson] 通过边界提取+宽松修复成功解析')
      return try4.value
    }
  }

  logger?.error?.(`[parseLlmJson] 所有解析策略失败。首 200 字: ${input.slice(0, 200)}`)
  return undefined
}

// ============================================================
// 内部工具
// ============================================================

function tryParse<T>(text: string): { success: true; value: T } | { success: false } {
  try {
    return { success: true, value: JSON.parse(text) as T }
  } catch {
    return { success: false }
  }
}

/** 从文本中提取第一对平衡的大括号/中括号（取更长者） */
function extractOuterJson(text: string): string | null {
  const brace = balancedSlice(text, '{', '}')
  const bracket = balancedSlice(text, '[', ']')
  if (brace && bracket) return brace.length >= bracket.length ? brace : bracket
  return brace ?? bracket ?? null
}

function balancedSlice(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open)
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let strChar = ''
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (ch === '\\') { i++; continue }
      if (ch === strChar) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * 宽松 JSON 修复（仅覆盖 LLM 常见 4 类失败）：
 *   - 尾随逗号（数组/对象末尾多余逗号）
 *   - 键缺少双引号（{ foo: 1 } → { "foo": 1 }，有限支持）
 *   - 单行 // 注释
 *   - 单引号代替双引号（尽力而为）
 */
function relaxJson(src: string): string {
  // 去掉 // 单行注释（不在字符串中），再处理尾随逗号 + 单引号键值
  const withoutComments = stripLineComments(src)
  return withoutComments
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, body) => `"${body.replace(/"/g, '\\"')}"`)   // 单引号 → 双引号
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')                                   // 裸键加双引号
    .replace(/,(\s*[}\]])/g, '$1')                                                             // 去尾随逗号
}

function stripLineComments(src: string): string {
  let out = ''
  let inStr = false
  let strCh = ''
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inStr) {
      out += ch
      if (ch === '\\') { out += src[++i] ?? ''; continue }
      if (ch === strCh) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") {
      inStr = true; strCh = ch; out += ch; continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      out += '\n'
      continue
    }
    out += ch
  }
  return out
}
