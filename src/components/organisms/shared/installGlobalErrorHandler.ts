/**
 * @module components/installGlobalErrorHandler
 * @description A-03：全局运行时异常监听
 *
 * 将两类「逃逸出 React 错误边界」的运行时异常统一上报到错误总线：
 * 1. `window` 上的未捕获 JS 错误（`error` 事件）
 * 2. 未处理的 Promise 拒绝（`unhandledrejection` 事件）
 *
 * 经 `captureError()`（S-02）收敛为 V9Error 并发布到 `ERROR_CAPTURED_EVENT`，
 * 与 React 错误边界（ErrorBoundary / WidgetErrorBoundary / RouteErrorBoundary）
 * 共用同一条错误总线，形成端到端异常闭环。
 *
 * 仅依赖 services/errorBus（→ lib 基础设施），符合 AGENTS.md 分层白名单。
  * @doc [V9-DOC-FRONT-046]
*/

import { captureError } from '@/services/errorBus'

/**
 * 安装全局错误监听。
 * @returns 清理函数，调用后移除监听（供 HMR / 测试清理）。
 */
export function installGlobalErrorHandler(): () => void {
  const handleError = (event: ErrorEvent): void => {
    captureError(event.error ?? event.message, {
      source: 'window',
      operation: 'onerror',
      meta: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  }

  const handleRejection = (event: PromiseRejectionEvent): void => {
    captureError(event.reason, {
      source: 'window',
      operation: 'unhandledrejection',
    })
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}
