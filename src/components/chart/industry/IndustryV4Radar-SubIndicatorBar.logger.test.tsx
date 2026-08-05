/**
 * IndustryV4Radar + SubIndicatorBar logger.info 验证测试
 * 参考 IndustryV4Panel.test.tsx 模式：mock usePerfTrace + mock recharts
 * 不 mock logger，保持真实控制台输出，通过捕获 console.log 断言。
 *
 * 运行:
 *   npx vitest run src/components/chart/industry/IndustryV4Radar-SubIndicatorBar.logger.test.tsx --no-coverage
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import {
  IndustryV4RadarChart,
  type IndustryV4RadarDataItem,
  type IndustryV4RadarSeries,
} from './IndustryV4Radar'
import {
  SubIndicatorBarChart,
  type SubIndicatorBarDataItem,
} from './SubIndicatorBar'

// ─── Mock usePerfTrace / recharts（与 IndustryV4Panel.test.tsx 一致）─────────

vi.mock('@/hooks/usePerfTrace', () => ({
  usePerfTrace: vi.fn(),
}))

vi.mock('recharts', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    RadarChart: vi.fn((props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': 'recharts-radar-chart' }, props.children),
    ),
    Radar: vi.fn((_props: Record<string, unknown>) =>
      React.createElement('polygon', { 'data-testid': 'recharts-radar' }),
    ),
    PolarGrid: vi.fn(() => React.createElement('g', { 'data-testid': 'recharts-polar-grid' })),
    PolarAngleAxis: vi.fn(() => React.createElement('g', { 'data-testid': 'recharts-polar-angle-axis' })),
    PolarRadiusAxis: vi.fn(() => React.createElement('g', { 'data-testid': 'recharts-polar-radius-axis' })),
    BarChart: vi.fn((props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': 'recharts-bar-chart' }, props.children),
    ),
    Bar: vi.fn((_props: Record<string, unknown>) =>
      React.createElement('rect', { 'data-testid': 'recharts-bar' }),
    ),
    XAxis: vi.fn(() => React.createElement('g', { 'data-testid': 'recharts-x-axis' })),
    YAxis: vi.fn(() => React.createElement('g', { 'data-testid': 'recharts-y-axis' })),
    CartesianGrid: vi.fn(() => React.createElement('g', { 'data-testid': 'recharts-cartesian-grid' })),
    Tooltip: vi.fn(() => null),
    ResponsiveContainer: vi.fn((props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': 'recharts-container' }, props.children),
    ),
    Legend: vi.fn(() => null),
    Cell: vi.fn(() => null),
  }
})

// ─── 捕获 console.log 中的 logger 输出 ─────────────────────────────────────

let origLog: typeof console.log
let capturedLogs: string[] = []

beforeEach(() => {
  capturedLogs = []
  origLog = console.log.bind(console)
  console.log = (...args: unknown[]) => {
    // 合并所有参数为一个字符串（第一个是[INFO]标记，第二个通常是 context 对象 JSON）
    const merged = args
      .map((a) => {
        if (typeof a === 'string') return a
        if (a === null || a === undefined) return String(a)
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      })
      .join(' ')
    capturedLogs.push(merged)
    origLog(...args)
  }
})

afterEach(() => {
  console.log = origLog
})

function hasLog(mark: string): boolean {
  return capturedLogs.some((l) => l.includes(mark))
}

// ─── Mock 数据工厂 ─────────────────────────────────────────────────────────

function createRadarData(): IndustryV4RadarDataItem[] {
  return [
    { dimension: 'prosperity', label: '景气度', score: 4.2, fullMark: 5 },
    { dimension: 'competition', label: '竞争格局', score: 3.8, fullMark: 5 },
    { dimension: 'policy', label: '政策环境', score: 3.5, fullMark: 5 },
    { dimension: 'technology', label: '技术跃迁', score: 4.0, fullMark: 5 },
    { dimension: 'downstream', label: '下游需求', score: 3.7, fullMark: 5 },
  ]
}

function createRadarSeries(): IndustryV4RadarSeries[] {
  return [
    { name: '半导体行业', dataKey: 'score', color: '#3b82f6', fillOpacity: 0.3 },
  ]
}

function createBarData(): SubIndicatorBarDataItem[] {
  return [
    { name: 'pe', label: '市盈率', value: 18.5, maxValue: 50, unit: 'x', category: '估值' },
    { name: 'pb', label: '市净率', value: 2.3, maxValue: 10, unit: 'x', category: '估值' },
    { name: 'roe', label: 'ROE', value: 12.5, maxValue: 30, unit: '%', category: '盈利' },
    { name: 'growth', label: '营收增速', value: 8.3, maxValue: 40, unit: '%', category: '增长' },
    { name: 'gross', label: '毛利率', value: 35.7, maxValue: 100, unit: '%', category: '盈利' },
  ]
}

// ─── 测试 ─────────────────────────────────────────────────────────────────

describe('验证 IndustryV4Radar + SubIndicatorBar 的 logger 打印', () => {
  it('[logger] IndustryV4Radar 渲染时打印 [IndustryV4Radar] 渲染', () => {
    const { container, getByTestId } = render(
      <IndustryV4RadarChart
        data={createRadarData()}
        series={createRadarSeries()}
        height={300}
        maxValue={5}
      />,
    )

    // 组件确实被渲染（recharts container 存在）
    expect(getByTestId('recharts-container')).toBeTruthy()
    expect(container.querySelector('[data-testid]')).toBeTruthy()

    // 关键断言：logger.info 真实打印
    expect(hasLog('IndustryV4Radar] 渲染')).toBe(true)

    // 可选：验证日志内容片段
    const line = capturedLogs.find((l) => l.includes('IndustryV4Radar] 渲染')) ?? ''
    expect(line).toContain('dataPoints')
    expect(line).toContain('seriesCount')
  })

  it('[logger] SubIndicatorBar 渲染时打印 [SubIndicatorBar] 渲染', () => {
    const { getByTestId } = render(
      <SubIndicatorBarChart
        data={createBarData()}
        height={300}
        layout="horizontal"
        showGrid
        showTooltip
        barColor="#10b981"
        sortByValue="desc"
        labelPosition="top"
      />,
    )

    expect(getByTestId('recharts-container')).toBeTruthy()

    expect(hasLog('SubIndicatorBar] 渲染')).toBe(true)

    const line = capturedLogs.find((l) => l.includes('SubIndicatorBar] 渲染')) ?? ''
    expect(line).toContain('dataPoints')
    expect(line).toContain('layout')
  })
})
