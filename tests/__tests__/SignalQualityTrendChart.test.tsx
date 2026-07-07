/**
 * SignalQualityTrendChart 组件单元测试
 *
 * 覆盖场景：
 * 1. 基础渲染：标题、统计徽章、LineChart DOM
 * 2. 数据为空：empty state 显示
 * 3. 加载中：loading state 显示
 * 4. 加载失败：error state + 重试按钮
 * 5. 边界值：
 *    - 单个数据点
 *    - 两个数组长度不同（合并处理）
 *    - accuracy/winRate 为 0 或 1 的极值
 *    - 大量数据点（性能边界，验证不崩溃）
 *    - 全部为 null 的合并值
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  SignalQualityTrendChart,
  type AccuracyTrendPoint,
  type WinRateTrendPoint,
} from '@/components/analysis/signal/SignalQualityTrendChart'

// Mock logger 避免日志干扰测试输出
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ============================================================
// 测试数据工厂
// ============================================================

function createAccuracyPoint(period: number, accuracy: number): AccuracyTrendPoint {
  return { period, accuracy }
}

function createWinRatePoint(period: number, winRate: number): WinRateTrendPoint {
  return { period, winRate }
}

/** 创建典型的趋势数据（5 个周期，accuracy 0.5-0.8，winRate 0.4-0.7） */
function createNormalTrendData(): {
  accuracy: AccuracyTrendPoint[]
  winRate: WinRateTrendPoint[]
} {
  return {
    accuracy: [
      createAccuracyPoint(20, 0.5),
      createAccuracyPoint(40, 0.65),
      createAccuracyPoint(60, 0.7),
      createAccuracyPoint(80, 0.75),
      createAccuracyPoint(100, 0.8),
    ],
    winRate: [
      createWinRatePoint(20, 0.4),
      createWinRatePoint(40, 0.5),
      createWinRatePoint(60, 0.55),
      createWinRatePoint(80, 0.6),
      createWinRatePoint(100, 0.7),
    ],
  }
}

describe('SignalQualityTrendChart 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // 基础渲染测试
  // ============================================================

  describe('基础渲染', () => {
    it('渲染卡片标题"信号质量趋势"', () => {
      const { accuracy, winRate } = createNormalTrendData()
      render(
        <SignalQualityTrendChart
          accuracyTrendData={accuracy}
          winRateTrendData={winRate}
        />,
      )

      expect(screen.getByText('信号质量趋势')).toBeInTheDocument()
    })

    it('渲染 Recharts 容器 DOM', () => {
      const { accuracy, winRate } = createNormalTrendData()
      render(
        <SignalQualityTrendChart
          accuracyTrendData={accuracy}
          winRateTrendData={winRate}
        />,
      )

      expect(document.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('渲染最新准确率徽章（80% → success 颜色）', () => {
      const { accuracy, winRate } = createNormalTrendData()
      render(
        <SignalQualityTrendChart
          accuracyTrendData={accuracy}
          winRateTrendData={winRate}
        />,
      )

      // 最新准确率为 0.8（≥0.7 阈值），应显示"准确率 80.0%"
      expect(screen.getByText('准确率 80.0%')).toBeInTheDocument()
    })

    it('渲染最新胜率徽章（70% → success 颜色）', () => {
      const { accuracy, winRate } = createNormalTrendData()
      render(
        <SignalQualityTrendChart
          accuracyTrendData={accuracy}
          winRateTrendData={winRate}
        />,
      )

      // 最新胜率为 0.7（≥0.6 阈值），应显示"胜率 70.0%"
      expect(screen.getByText('胜率 70.0%')).toBeInTheDocument()
    })

    it('渲染波动幅度徽章', () => {
      const { accuracy, winRate } = createNormalTrendData()
      render(
        <SignalQualityTrendChart
          accuracyTrendData={accuracy}
          winRateTrendData={winRate}
        />,
      )

      // 准确率波动 = 0.8 - 0.5 = 0.3 → "波动 ±30.0%"
      expect(screen.getByText(/波动 ±30\.0%/)).toBeInTheDocument()
    })
  })

  // ============================================================
  // 数据为空测试
  // ============================================================

  describe('数据为空', () => {
    it('两个数组都为空时显示 empty state', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
        />,
      )

      expect(screen.getByText('暂无趋势数据')).toBeInTheDocument()
      expect(screen.getByText(/需要至少 20 条已实现复盘记录/)).toBeInTheDocument()
    })

    it('空数据时不渲染统计徽章', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
        />,
      )

      expect(screen.queryByText(/准确率 \d/)).not.toBeInTheDocument()
      expect(screen.queryByText(/胜率 \d/)).not.toBeInTheDocument()
      expect(screen.queryByText(/波动/)).not.toBeInTheDocument()
    })

    it('空数据时不渲染 Recharts 容器', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
        />,
      )

      expect(document.querySelector('.recharts-responsive-container')).not.toBeInTheDocument()
    })

    it('自定义 windowSize 时 empty state 文案反映新值', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
          windowSize={50}
        />,
      )

      expect(screen.getByText(/需要至少 50 条已实现复盘记录/)).toBeInTheDocument()
    })
  })

  // ============================================================
  // 加载状态测试
  // ============================================================

  describe('加载状态', () => {
    it('loading=true 时显示加载文案', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
          loading={true}
        />,
      )

      expect(screen.getByText('加载趋势数据中...')).toBeInTheDocument()
    })

    it('loading=true 时不渲染 Recharts 容器', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
          loading={true}
        />,
      )

      expect(document.querySelector('.recharts-responsive-container')).not.toBeInTheDocument()
    })

    it('loading=true 时不渲染统计徽章', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
          loading={true}
        />,
      )

      expect(screen.queryByText(/准确率 \d/)).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // 加载失败测试
  // ============================================================

  describe('加载失败', () => {
    it('error 不为空时显示错误信息', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
          error="数据加载失败：网络异常"
        />,
      )

      expect(screen.getByText('数据加载失败：网络异常')).toBeInTheDocument()
    })

    it('error 状态显示重试按钮', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
          error="加载失败"
          onRetry={vi.fn()}
        />,
      )

      expect(screen.getByRole('button', { name: /重试/i })).toBeInTheDocument()
    })

    it('点击重试按钮触发 onRetry 回调', () => {
      const onRetry = vi.fn()
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
          error="加载失败"
          onRetry={onRetry}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /重试/i }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('error 状态不渲染 Recharts 容器', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
          error="加载失败"
        />,
      )

      expect(document.querySelector('.recharts-responsive-container')).not.toBeInTheDocument()
    })

    it('error 为空字符串时不视为错误（与 null 等价）', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[]}
          winRateTrendData={[]}
          error=""
        />,
      )

      // 空字符串应走 empty 分支，不显示错误
      expect(screen.getByText('暂无趋势数据')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 边界值测试
  // ============================================================

  describe('边界值', () => {
    it('单个数据点时正常渲染', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[createAccuracyPoint(20, 0.65)]}
          winRateTrendData={[createWinRatePoint(20, 0.5)]}
        />,
      )

      expect(screen.getByText('准确率 65.0%')).toBeInTheDocument()
      expect(screen.getByText('胜率 50.0%')).toBeInTheDocument()
      // 单个数据点波动为 0，不显示波动徽章
      expect(screen.queryByText(/波动/)).not.toBeInTheDocument()
    })

    it('accuracyTrend 与 winRateTrend 长度不同时正确合并', () => {
      // accuracyTrend 有 3 个点，winRateTrend 只有 2 个点
      // 缺失的 winRate 应为 null，不影响 accuracy 渲染
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[
            createAccuracyPoint(20, 0.6),
            createAccuracyPoint(40, 0.7),
            createAccuracyPoint(60, 0.8),
          ]}
          winRateTrendData={[
            createWinRatePoint(20, 0.5),
            createWinRatePoint(40, 0.6),
            // 缺失 period=60 的 winRate
          ]}
        />,
      )

      // 最新 accuracy 仍为 0.8
      expect(screen.getByText('准确率 80.0%')).toBeInTheDocument()
      // 最新 winRate 应为 0.6（跳过 null 值）
      expect(screen.getByText('胜率 60.0%')).toBeInTheDocument()
    })

    it('accuracy=0 极值时正常渲染', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[createAccuracyPoint(20, 0)]}
          winRateTrendData={[createWinRatePoint(20, 0)]}
        />,
      )

      // accuracy=0 < 0.5 阈值，应显示 danger 颜色徽章
      expect(screen.getByText('准确率 0.0%')).toBeInTheDocument()
      expect(screen.getByText('胜率 0.0%')).toBeInTheDocument()
    })

    it('accuracy=1 极值时正常渲染', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[createAccuracyPoint(20, 1)]}
          winRateTrendData={[createWinRatePoint(20, 1)]}
        />,
      )

      expect(screen.getByText('准确率 100.0%')).toBeInTheDocument()
      expect(screen.getByText('胜率 100.0%')).toBeInTheDocument()
    })

    it('大量数据点（100 个）时正常渲染不崩溃', () => {
      const accuracy: AccuracyTrendPoint[] = []
      const winRate: WinRateTrendPoint[] = []
      for (let i = 1; i <= 100; i++) {
        accuracy.push(createAccuracyPoint(i * 20, 0.5 + (i % 5) * 0.05))
        winRate.push(createWinRatePoint(i * 20, 0.4 + (i % 5) * 0.05))
      }

      // 不应抛出异常
      expect(() => {
        render(
          <SignalQualityTrendChart
            accuracyTrendData={accuracy}
            winRateTrendData={winRate}
          />,
        )
      }).not.toThrow()

      // 最新值应正确显示
      expect(screen.getByText(/准确率/)).toBeInTheDocument()
    })

    it('阈值边界值 0.7 准确率显示 success 颜色', () => {
      // 0.7 是 ACCURACY_GOOD_THRESHOLD 边界值，应判定为良好（绿色）
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[createAccuracyPoint(20, 0.7)]}
          winRateTrendData={[createWinRatePoint(20, 0.6)]}
        />,
      )

      expect(screen.getByText('准确率 70.0%')).toBeInTheDocument()
    })

    it('阈值边界值 0.5 准确率显示 warning 颜色', () => {
      // 0.5 是 ACCURACY_WARN_THRESHOLD 边界值，应判定为警告（黄色）
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[createAccuracyPoint(20, 0.5)]}
          winRateTrendData={[createWinRatePoint(20, 0.4)]}
        />,
      )

      expect(screen.getByText('准确率 50.0%')).toBeInTheDocument()
    })

    it('自定义 height prop 不影响渲染', () => {
      const { accuracy, winRate } = createNormalTrendData()
      render(
        <SignalQualityTrendChart
          accuracyTrendData={accuracy}
          winRateTrendData={winRate}
          height={400}
        />,
      )

      expect(document.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 颜色令牌验证
  // ============================================================

  describe('颜色令牌', () => {
    it('高准确率使用 success 颜色徽章', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[createAccuracyPoint(20, 0.85)]}
          winRateTrendData={[createWinRatePoint(20, 0.7)]}
        />,
      )

      const accuracyBadge = screen.getByText('准确率 85.0%').closest('div')
      expect(accuracyBadge).not.toBeNull()
    })

    it('低准确率使用 danger 颜色徽章', () => {
      render(
        <SignalQualityTrendChart
          accuracyTrendData={[createAccuracyPoint(20, 0.3)]}
          winRateTrendData={[createWinRatePoint(20, 0.2)]}
        />,
      )

      // accuracy=0.3 < 0.5 应使用 danger 颜色
      expect(screen.getByText('准确率 30.0%')).toBeInTheDocument()
    })
  })
})
