import type { WidgetConfig, SectorHeatmapData } from '@/types/modules/widget.types'
import type { HotSector } from '@/services/input/hotSectorService'

/**
 * @fileoverview Widget 组件测试公共辅助函数
 * @description 集中构建 WidgetConfig、SectorHeatmapData、HotSector 等测试数据，
 * 减少跨测试文件重复。
 */

/** 构建 Widget 配置 */
export function buildWidgetConfig(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    instanceId: 'widget-1',
    widgetId: 'widget',
    title: '测试 Widget',
    size: { cols: 2, rows: 2 },
    settings: {},
    visible: true,
    collapsed: false,
    ...overrides,
  }
}

/** 构建板块热力图数据 */
export function buildSectorHeatmapData(
  count: number,
  overrides: Partial<SectorHeatmapData> = {},
): SectorHeatmapData[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `板块${i + 1}`,
    code: `SEC${String(i + 1).padStart(3, '0')}`,
    changePercent: (i + 1) * 0.8 - 2.0,
    ...overrides,
  }))
}

/** 默认热门板块样本，与 hotSectorService 数据形状一致 */
export const DEFAULT_HOT_SECTORS: HotSector[] = [
  {
    code: 'semiconductor',
    name: '半导体',
    score: 82,
    trend: 'up',
    factors: { momentum: 85, fundFlow: 78, valuation: 68, sentiment: 88 },
    stocks: [
      { symbol: '600519.SH', name: '贵州茅台' },
      { symbol: '000001.SZ', name: '平安银行' },
      { symbol: '300750.SZ', name: '宁德时代' },
    ],
  },
  {
    code: 'ai',
    name: '人工智能',
    score: 76,
    trend: 'up',
    factors: { momentum: 80, fundFlow: 72, valuation: 70, sentiment: 82 },
    stocks: [
      { symbol: '002230.SZ', name: '科大讯飞' },
      { symbol: '688256.SH', name: '寒武纪' },
      { symbol: '300418.SZ', name: '昆仑万维' },
    ],
  },
  {
    code: 'new-energy',
    name: '新能源',
    score: 71,
    trend: 'neutral',
    factors: { momentum: 68, fundFlow: 74, valuation: 72, sentiment: 70 },
    stocks: [
      { symbol: '002594.SZ', name: '比亚迪' },
      { symbol: '300014.SZ', name: '亿纬锂能' },
      { symbol: '601012.SH', name: '隆基绿能' },
    ],
  },
]
