/**
 * @module execution.types
 * @description 执行链路模块类型定义
 */

/**
 * 执行计划阶段枚举
 * 与 src/constants/execution.constants.ts 的 EXECUTION_PHASE 值保持一致
 */
export type ExecutionPhase = 'plan' | 'confirmed' | 'pending' | 'executed' | 'cancelled' | 'reviewed'
