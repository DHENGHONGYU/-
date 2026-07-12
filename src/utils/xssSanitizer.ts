/**
 * XSS 净化工具
 *
 * 用途：
 * - 对 LLM 返回的 Markdown / 富文本内容进行净化，防止恶意 HTML/JS 注入
 * - 对用户输入的纯文本进行 HTML 实体转义
 * - 对接 React 已自动转义的 JSX 子节点提供深度防御
 *
 * 设计原则：
 * - 默认安全（deny-by-default）：仅允许白名单标签/属性
 * - 零依赖：不引入 dompurify 等第三方库，避免供应链风险
 * - 性能优先：纯字符串处理，无 DOM 操作
 *
 * @module xssSanitizer
/**
 * 危险的 HTML 实体字符 → 转义映射
 * 用于将纯文本嵌入 HTML 上下文时防止 XSS
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
}

/**
 * 对纯文本进行 HTML 实体转义。
 *
 * 适用场景：
 * - 将用户输入或 LLM 输出嵌入到 HTML 属性、title、tooltip 中
 * - 任何需要将不可信字符串作为 HTML 文本节点使用的场景
 *
 * @param input 原始字符串
 * @returns 转义后的字符串（HTML 实体）
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    return ''
  }
  return input.replace(/[&<>"'`/]/g, (char) => HTML_ESCAPE_MAP[char] ?? char)
}

/**
 * 危险协议黑名单（用于过滤 javascript:、data:、vbscript: 等）
 * 带 g 标志，专门用于全局替换（String.replace 无需关心 lastIndex）。
 */
const DANGEROUS_PROTOCOL_REGEX = /(?:javascript|vbscript|data|file):/gi

/**
 * 危险协议检测（用于 .test() 判断）。
 *
 * 注意：绝不能复用带 g 标志的 DANGEROUS_PROTOCOL_REGEX 进行 .test()，
 * 因为 g 标志会让 lastIndex 在多次 .test() 之间泄漏状态，导致间歇漏检。
 * 此处使用独立的不带 g 的正则，保证每次 .test() 都从 0 开始匹配。
 */
const DANGEROUS_PROTOCOL_TEST = /(?:javascript|vbscript|data|file):/i

/**
 * 净化字符串中的潜在 XSS 攻击载荷。
 *
 * 处理内容：
 * 1. 移除 HTML 标签（<script>、<iframe>、<object>、<embed> 等）
 * 2. 转义 HTML 实体字符
 * 3. 移除危险协议（javascript:、data:、vbscript:）
 * 4. 移除 on* 事件处理器（onclick、onerror 等）
 *
 * @param input 原始字符串
 * @returns 净化后的字符串（仅保留文本内容，所有 HTML 标签被移除）
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    return ''
  }

  let result = input

  // 1. 移除 HTML 注释（防止条件注释攻击）
  result = result.replace(/<!--[\s\S]*?-->/g, '')

  // 2. 移除 <script> 标签及其内容
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // 3. 移除 <style> 标签及其内容（防止 CSS 注入）
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // 4. 移除所有 HTML 标签（白名单策略：默认全部移除）
  //    保留标签内的文本内容
  result = result.replace(/<\/?[^>]+(>|$)/g, '')

  // 5. 移除危险协议
  result = result.replace(DANGEROUS_PROTOCOL_REGEX, '')

  // 6. 转义剩余的特殊字符
  result = escapeHtml(result)

  return result
}

/**
 * 净化 Markdown 文本中的潜在 XSS 载荷。
 *
 * 与 {@link sanitizeHtml} 不同，本函数保留 Markdown 语法符号（#、*、`、>、- 等），
 * 仅移除内嵌的 HTML 标签和危险协议，确保 Markdown 渲染器的输入安全。
 *
 * 处理内容：
 * 1. 移除 HTML 注释
 * 2. 移除 <script>/<style>/<iframe>/<object>/<embed> 等危险标签及其内容
 * 3. 移除行内 HTML 标签（保留文本）
 * 4. 移除危险协议（javascript:、data:、vbscript:）
 * 5. 移除 Markdown 链接中的危险协议（[text](javascript:...)）
 *
 * @param input 原始 Markdown 字符串
 * @returns 净化后的 Markdown 字符串
 */
export function sanitizeMarkdown(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    return ''
  }

  let result = input

  // 1. 移除 HTML 注释
  result = result.replace(/<!--[\s\S]*?-->/g, '')

  // 2. 移除 <script> 标签及其内容
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // 3. 移除 <style> 标签及其内容
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // 4. 移除 <iframe>、<object>、<embed>、<form> 等危险标签及其内容
  result = result.replace(
    /<(iframe|object|embed|form|input|textarea|button|applet)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi,
    '',
  )

  // 5. 移除行内 HTML 标签（保留文本内容）
  //    例如 <b>text</b> → text，<img src=x onerror=alert(1)> → （移除）
  //    白名单策略：所有 HTML 标签统一移除，仅保留 Markdown 语法
  result = result.replace(/<\/?[a-zA-Z][^>]*>/g, '')

  // 6. 净化 Markdown 链接：移除危险协议的 URL
  //    [text](javascript:alert(1)) → [text](#)
  //    [text](data:text/html,...) → [text](#)
  result = result.replace(
    /\[([^\]]*)\]\(([^)]*)\)/g,
    (match, text: string, url: string) => {
      const trimmedUrl = url.trim()
      if (DANGEROUS_PROTOCOL_TEST.test(trimmedUrl)) {
        return `[${text}](#)`
      }
      return match
    },
  )

  // 7. 净化自动链接：<javascript:alert(1)> → 移除
  result = result.replace(/<javascript:[^>]*>/gi, '')
  result = result.replace(/<vbscript:[^>]*>/gi, '')
  result = result.replace(/<data:[^>]*>/gi, '')

  return result
}

/**
 * 净化用户输入的纯文本搜索关键词。
 *
 * 处理内容：
 * 1. 移除控制字符（\x00-\x1F 除 \t \n \r）
 * 2. 移除 HTML 标签
 * 3. 限制最大长度
 *
 * @param input 原始输入
 * @param maxLength 最大长度（默认 100）
 * @returns 净化后的字符串
/**
 * 净化 LLM 输出（Markdown 格式）。
 *
 * 本函数是 {@link sanitizeMarkdown} 的语义化别名，
 * 用于在智能评分解释、思维链展示等场景中统一处理 LLM 返回内容。
 */
export const sanitizeLlmOutput = sanitizeMarkdown

export function sanitizeSearchQuery(input: string, maxLength = 100): string {
  if (typeof input !== 'string' || input.length === 0) {
    return ''
  }

  let result = input

  // 1. 移除控制字符（保留 \t \n \r）
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // 2. 移除 HTML 标签
  result = result.replace(/<\/?[^>]+(>|$)/g, '')

  // 3. 限制最大长度
  if (result.length > maxLength) {
    result = result.slice(0, maxLength)
  }

  return result
}
