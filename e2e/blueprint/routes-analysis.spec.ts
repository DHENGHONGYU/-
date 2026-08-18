import { runRouteAudits } from './_audit-helpers'

runRouteAudits('analysis', [
  { path: '/analysis', description: '分析舱 AnalysisApp', category: 'analysis', inBlueprint: true },
  { path: '/analysis/hub', description: '分析舱 - 模块首页', category: 'analysis', inBlueprint: false },
  { path: '/analysis/stock-score', description: '个股九维评分分析', category: 'analysis', inBlueprint: true },
  { path: '/analysis/stock-score/600519.SH', description: '个股九维评分（带代码）', category: 'analysis', inBlueprint: true },
  { path: '/analysis/sector', description: '行业与板块分析', category: 'analysis', inBlueprint: true },
  { path: '/analysis/backtest', description: '策略回测', category: 'analysis', inBlueprint: true },
  { path: '/analysis/industry-score', description: 'V4 行业评分', category: 'analysis', inBlueprint: true },
  { path: '/analysis/intelligent-score', description: 'V6 个股智能评分', category: 'analysis', inBlueprint: true },
  { path: '/analysis/industry-dashboard', description: '行业全景仪表盘', category: 'analysis', inBlueprint: false },
  { path: '/analysis/score-docs', description: '评分文档版本库', category: 'analysis', inBlueprint: false },
  { path: '/analysis/news', description: '智能资讯', category: 'analysis', inBlueprint: false },
  { path: '/analysis/news-v6', description: '智能资讯 V6（newsColors 语义化令牌视觉风格）', category: 'analysis', inBlueprint: true },
  { path: '/analysis/score-comparison', description: '历史评分比对看板', category: 'analysis', inBlueprint: false },
  { path: '/analysis/hot-sector', description: '热门板块策略选股（五维评分）', category: 'analysis', inBlueprint: false },
  { path: '/analysis/value-pit', description: '价值洼地策略选股', category: 'analysis', inBlueprint: false },
  { path: '/analysis/multi-factor', description: '多因子筛选', category: 'analysis', inBlueprint: false },
])
