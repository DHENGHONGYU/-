/**
 * StockQuoteDashboard 单元测试
 *
 * ⚠️ FROZEN 2026-08-04 — 全文件 describe.skip
 *
 * 冻结原因（类型契约漂移三重错位）：
 * 1. 路径漂移：原测试从 `@/components/organisms/trading/StockQuoteDashboard` 导入，
 *    但 trading/ 目录下从未存在该组件，实际组件位于 market/StockQuoteDashboard.tsx。
 * 2. API 契约错位：原测试期望 `<StockQuoteDashboard stocks={UnifiedStockData[]} />`
 *    + 命名导出 `formatPrice`、`isValidPrice`；但 market/StockQuoteDashboard 的实际
 *    签名是 `<StockQuoteDashboard symbol?: string adjust?: ... className?: string />`，
 *    且不导出 formatPrice/isValidPrice——测试与组件完全是两个不同的东西。
 * 3. 历史幽灵：2026-07-22 报告显示组件曾"不存在"（tsc 缓存幽灵），测试却长期存在。
 *
 * 决策（用户 2026-08-04 确认）：
 * - API 契约：按原始组件恢复（symbol + K 线图版本），不重写为 stocks 数组型。
 * - 本测试文件整体 describe.skip，待后续按 market/StockQuoteDashboard 真实 API 重写。
 *
 * 还款计划（DEBT-FROZEN-P3）：
 * - 优先级：P3（不阻塞门禁，但属于类型契约债务）
 * - 还款动作：重写本文件，覆盖 symbol 属性、K 线图渲染、价格摘要格式化等真实分支
 * - 触发条件：下次重构 market/StockQuoteDashboard 时一并处理
 * - 监控：husky pre-commit 的 tsc:test 门禁会在取消 skip 后立即暴露真实 API 不匹配
 *
 * @see src/components/organisms/market/StockQuoteDashboard.tsx（实际路径）
 * @see src/data/types/types.sevenDimensions.ts
 * @see docs/reports/fix-summary-2026-07-22-types-stash-cleanup.md（历史幽灵证据）
 */

import { describe, expect, it } from 'vitest'

// 占位断言：确保 vitest 不报"文件无测试"警告；真实用例将在还款计划中重写。
describe.skip('StockQuoteDashboard [FROZEN 2026-08-04] — 待按 market/StockQuoteDashboard 真实 API 重写', () => {
  it('placeholder until DEBT-FROZEN-P3 repayment', () => {
    expect(true).toBe(true)
  })
})
