/**
 * @fileoverview RiskControlPanel 单元测试（双向验证）
 * @description 验证风控面板在「有真实风险数据」与「无真实数据」两种状态下的渲染意图。
 *
 * 覆盖关键点（与 PortfolioOverviewWidget「无数据显式『数据不足』」约定一致）：
 * - 正向：传入真实 riskMetrics → 三指标渲染真实数值（toFixed），不出现「数据不足」。
 * - 逆向：不传 riskMetrics（生产构建未接入实时风控源）→ 三指标均渲染「数据不足」，
 *   不再以硬编码兜底值（如 15.3% / 1.2）或 0 值伪装成真实 KPI。
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

// 延迟导入被测组件（lucide 图标在 jsdom 下渲染为 SVG，无需 mock）
const { RiskControlPanel } = await import('./RiskControlPanel')

describe('RiskControlPanel 双向验证', () => {
  // ── 正向：输入真实风险数据 → 输出真实指标 ──
  describe('正向：有真实风险数据', () => {
    it('渲染 VaR / 最大回撤 / 夏普比率的真实数值，不出现「数据不足」', () => {
      render(
        <RiskControlPanel
          riskMetrics={{ var: 2.5, maxDrawdown: 15.3, sharpeRatio: 1.2 }}
          riskAlerts={['持仓集中度偏高']}
        />,
      )

      // 真实数值按 toFixed(2) 渲染
      expect(screen.getByText('2.50%')).toBeInTheDocument() // VaR(95%)
      expect(screen.getByText('15.30%')).toBeInTheDocument() // 最大回撤
      expect(screen.getByText('1.20')).toBeInTheDocument() // 夏普比率
      // 有真实数据时不得出现「数据不足」占位
      expect(screen.queryByText('数据不足')).not.toBeInTheDocument()
      // 风险预警应渲染
      expect(screen.getByText('持仓集中度偏高')).toBeInTheDocument()
    })
  })

  // ── 逆向：无真实数据 → 显式「数据不足」 ──
  describe('逆向：无真实风险数据（生产未接入实时风控源）', () => {
    it('三指标均渲染「数据不足」，不渲染伪造的 0 值', () => {
      render(<RiskControlPanel riskMetrics={undefined} riskAlerts={[]} />)

      // 三处「数据不足」占位
      const placeholders = screen.getAllByText('数据不足')
      expect(placeholders).toHaveLength(3)

      // 不得出现以 0 值伪装的 KPI（VaR 0.00% / 回撤 0.00% / 夏普 0.00）
      expect(screen.queryByText('0.00%')).not.toBeInTheDocument()
      expect(screen.queryByText('0.00')).not.toBeInTheDocument()
    })

    it('缺失 riskMetrics 入参（undefined 默认）同样降级为「数据不足」', () => {
      render(<RiskControlPanel />)

      expect(screen.getAllByText('数据不足')).toHaveLength(3)
      expect(screen.queryByText('0.00%')).not.toBeInTheDocument()
    })
  })
})
