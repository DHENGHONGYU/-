/**
 * @module components/organisms/shared
 * @description 共享 organisms 组件 barrel export
 *
 * 从 components/molecules/ 重导出标准状态组件：
 * - EmptyState: 空数据状态展示
 * - ErrorState: 错误状态展示
 * - LoadingState: 加载状态展示
 */

export { EmptyState } from '@/components/molecules/EmptyState'
export type { EmptyStateProps, EmptyStateAction } from '@/components/molecules/EmptyState'
export { ErrorState } from '@/components/molecules/states/ErrorState'
export type { ErrorStateProps } from '@/components/molecules/states/ErrorState'
export { LoadingState } from '@/components/molecules/LoadingState'
export type { LoadingStateProps } from '@/components/molecules/LoadingState'