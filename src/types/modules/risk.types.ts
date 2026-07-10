/**
 * @module types/modules/risk.types
 * @description 风控模块基础类型（零依赖）
 *
 * 仅包含纯字符串联合类型，供 store / services / pages 共享引用，
 * 保持 types/ 层零依赖约定。
 */

/** 风控三态 */
export type RiskTriState = 'normal' | 'warning' | 'blocked'

/** 熔断回路状态 */
export type CircuitState = 'closed' | 'open' | 'half-open'
