/**
 * safeCoerce — 类型安全强制转换工具
 *
 * 用于在 DataBridge/分析器入口对 API 脏数据进行防御性转换，
 * 防止 NaN/undefined/非法字符串流入下游评分逻辑。
 *
 * 设计原则：
 * - 永不抛异常，脏数据一律返回 defaultValue
 * - 拦截 null/undefined/''/NaN/Infinity/非数字字符串
 * - 枚举校验值域，布尔校验 0/1/'true'/'false'
 *
 * @module safeCoerce
 */

/**
 * 将任意值强制转为 number，无效值返回 defaultValue。
 *
 * @example
 *   toSafeNumber(42)              // 42
 *   toSafeNumber('4.5')           // 4.5
 *   toSafeNumber('abc')           // 0
 *   toSafeNumber(NaN)             // 0
 *   toSafeNumber(null, 50)        // 50
 *   toSafeNumber(Infinity)        // 0
 */
export function toSafeNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue
  const num = Number(value)
  return Number.isFinite(num) ? num : defaultValue
}

/**
 * 将任意值强制转为 number，并校验是否在 [min, max] 范围内。
 * 无效值(NaN/Infinity/非数字字符串/null/undefined/空串)或越界值均返回 defaultValue。
 *
 * 用于表单 controlled input 的 onChange 守卫，避免 HTML5 min/max 属性
 * 被绕过(键盘输入、JS 注入、剪贴板粘贴)导致脏数据流入 state。
 *
 * @example
 *   toSafeNumberInRange(50, 0, 100, 0)        // 50
 *   toSafeNumberInRange(-1, 0, 100, 0)        // 0(越界 → 默认值)
 *   toSafeNumberInRange(150, 0, 100, 0)       // 0(越界 → 默认值)
 *   toSafeNumberInRange('abc', 0, 100, 0)     // 0(NaN → 默认值)
 *   toSafeNumberInRange(Infinity, 0, 100, 0) // 0(Infinity → 默认值)
 *   toSafeNumberInRange('50', 0, 100, 0)      // 50(字符串数字 → 解析)
 */
export function toSafeNumberInRange(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number,
): number {
  // 步骤 1:先做 NaN/Infinity/非数字 守卫(复用 toSafeNumber)
  const num = toSafeNumber(value, Number.NaN)
  if (!Number.isFinite(num)) return defaultValue

  // 步骤 2:范围校验
  if (num < min || num > max) return defaultValue

  return num
}

/**
 * 将任意值强制转为 number | undefined，用于可选数值字段。
 * null/undefined/空串/非数字字符串均返回 undefined（而非 0），
 * 防止 0 被下游误判为"有值"。
 *
 * @example
 *   toSafeOptionalNumber(42)      // 42
 *   toSafeOptionalNumber('4.5')   // 4.5
 *   toSafeOptionalNumber('停牌')    // undefined
 *   toSafeOptionalNumber(null)    // undefined
 *   toSafeOptionalNumber('')      // undefined
 */
export function toSafeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

/**
 * 将任意值强制转为指定枚举值，无效值返回 defaultValue。
 * 大小写敏感：'Bullish' 不匹配 'bullish'。
 *
 * @example
 *   toSafeEnum('bullish', ['bullish','bearish','neutral'], 'neutral')  // 'bullish'
 *   toSafeEnum('invalid', ['bullish','bearish','neutral'], 'neutral')  // 'neutral'
 *   toSafeEnum(null, ['bullish','bearish','neutral'], 'neutral')       // 'neutral'
 */
export function toSafeEnum<T extends string>(value: unknown, allowed: readonly T[], defaultValue: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  return defaultValue
}

/**
 * 将任意值强制转为 boolean，无效值返回 defaultValue。
 * 仅识别：true/false（布尔）、1/0（数字）、'true'/'false'（字符串）。
 *
 * @example
 *   toSafeBoolean(true)           // true
 *   toSafeBoolean(1)              // true
 *   toSafeBoolean('true')         // true
 *   toSafeBoolean('yes')          // false（不识别，返回默认值）
 *   toSafeBoolean(null, true)     // true
 */
export function toSafeBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 'true' || value === 1) return true
  if (value === 0 || value === 'false' || value === 0) return false
  return defaultValue
}

/**
 * 将任意值强制转为数组，非数组返回空数组。
 *
 * @example
 *   toSafeArray([1,2,3])          // [1,2,3]
 *   toSafeArray(null)             // []
 *   toSafeArray('abc')            // []
 */
export function toSafeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

/**
 * 将任意值强制转为 string，非字符串返回 defaultValue。
 * 注意：null/undefined 返回 defaultValue，而非 'null'/'undefined'。
 *
 * @example
 *   toSafeString('hello')         // 'hello'
 *   toSafeString(42)              // '42'
 *   toSafeString(null, 'unknown') // 'unknown'
 */
export function toSafeString(value: unknown, defaultValue = ''): string {
  if (value === null || value === undefined) return defaultValue
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString()
  if (typeof value === 'symbol') return value.toString()
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- 回退分支：value 已经过所有基本类型检查，此处为 object，调用 String() 是合理的最后手段
  return String(value)
}
