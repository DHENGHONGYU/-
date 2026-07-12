/**
 * @module analysisTemplatesConfig
 * @description 分析舱快捷入口模板配置。
 * @remarks 所有路径、标题、默认参数均来自配置，组件中禁止硬编码。
 */

export type AnalysisTemplateId = 'quick-score' | 'industry-compare' | 'backtest-wizard'

export interface AnalysisTemplate {
  id: AnalysisTemplateId
  title: string
  description: string
  path: string
  params: Record<string, string>
  iconName: 'Zap' | 'Scale' | 'FlaskConical'
  badge?: string
}

export const ANALYSIS_TEMPLATES: AnalysisTemplate[] = [
  {
    id: 'quick-score',
    title: '快速个股评分',
    description: '输入股票代码，一键生成 V6 九层漏斗综合评分与投资建议。',
    path: '/analysis/stock-score',
    params: { template: 'quick-score' },
    iconName: 'Zap',
    badge: '常用',
  },
  {
    id: 'industry-compare',
    title: '行业对比分析',
    description: '选择多个行业，横向对比护城河、财务健康与估值评分。',
    path: '/analysis/industry-score',
    params: { template: 'industry-compare' },
    iconName: 'Scale',
  },
  {
    id: 'backtest-wizard',
    title: '策略回测向导',
    description: '基于历史数据对选股策略进行回测与绩效归因。',
    path: '/analysis/backtest',
    params: { template: 'wizard' },
    iconName: 'FlaskConical',
    badge: 'Beta',
  },
]

/** 模板卡片布局列数 */
export const ANALYSIS_TEMPLATE_GRID_COLUMNS = 3
