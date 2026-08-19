/**
 * ErrorState 组件（兼容旧引用）
 * cockpit-redesign 时把实现下沉为 molecules/states/ErrorState.tsx（注册名 ErrorStateBase），
 * 旧页面 import 的 "molecules/ErrorState" 在此做等价转出口，避免 5 个页面断链。
 *
 * Props 与 ErrorStateBase 完全一致：支持 error / variant / title / description / onRetry 等。
 */
export { ErrorState } from './states/ErrorState'
export type { ErrorStateProps } from './states/ErrorState'
