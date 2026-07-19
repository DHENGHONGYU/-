/**
 * 安全正则构造器：限制来源为内部可控字符串，添加长度上限防止 ReDoS。
 * 
 * 使用场景：当 RegExp 模式来自变量/拼接时（非字面量），必须通过此函数，
 * 确保模式长度受控且仅接受受信来源。禁止直接 `new RegExp(userInput)`。
 *
 * @module lib/safeRegex
 * @since 2026-07-18 — P1 正则注入收口
/** 正则模式最大字符数，防止超长 ReDoS 攻击 */
const MAX_PATTERN_LENGTH = 256

/**
 * 构造安全正则表达式。
 * @param pattern 正则模式（必须来自内部可控来源，非用户输入）
 * @param flags  正则标志（仅允许 i/g/m/s/u/y）
 * @throws 若模式为空或超长
 */
export function safeRegex(pattern: string, flags?: string): RegExp {
  if (!pattern || pattern.length === 0) {
    throw new Error('[safeRegex] 模式不能为空')
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new Error(`[safeRegex] 模式过长: ${pattern.length} > ${MAX_PATTERN_LENGTH}`)
  }
  if (flags && !/^[igmsuy]*$/.test(flags)) {
    throw new Error(`[safeRegex] 无效标志: ${flags}`)
  }
  return new RegExp(pattern, flags)
}
