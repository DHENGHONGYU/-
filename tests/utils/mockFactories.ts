/**
 * 测试辅助工具：类型安全的 Mock 工厂函数
 * @description 提供类型安全的测试数据创建函数，避免使用 any 类型
 */

// ============================================================
// 通用工厂函数
// ============================================================

/**
 * 创建类型安全的回调 Map
 * @example
 * const callbacks = createMockCallbackMap<Envelope>()
 * callbacks.set('channel', (envelope) => { ... })
 */
export function createMockCallbackMap<T>(): Map<string, (envelope: T) => void> {
  return new Map<string, (envelope: T) => void>()
}

/**
 * 创建类型安全的回调引用对象
 * @example
 * const ref = createMockCallbackRef<Envelope>()
 * ref.callback = (envelope) => { ... }
 */
export function createMockCallbackRef<T>(): { callback: ((envelope: T) => void) | null } {
  return { callback: null }
}

// ============================================================
// 业务类型工厂函数
// ============================================================