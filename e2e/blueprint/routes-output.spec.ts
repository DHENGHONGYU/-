import { runRouteAudits } from './_audit-helpers'

runRouteAudits('output', [
  { path: '/output', description: '输出舱 OutputApp', category: 'output', inBlueprint: true },
  { path: '/output/hub', description: '输出舱 - 模块首页', category: 'output', inBlueprint: false },
  { path: '/output/research', description: '研究报告', category: 'output', inBlueprint: false },
  { path: '/output/review', description: '交易复盘', category: 'output', inBlueprint: false },
  { path: '/output/export', description: '数据导出', category: 'output', inBlueprint: false },
  { path: '/output/dashboard', description: '仪表盘', category: 'output', inBlueprint: false },
  { path: '/output/wizard', description: '复盘向导', category: 'output', inBlueprint: false },
  { path: '/output/prediction', description: '预测校验', category: 'output', inBlueprint: false },
  { path: '/output/retrospective', description: '周期复盘', category: 'output', inBlueprint: false },
  { path: '/output/factor-dashboard', description: '因子画板', category: 'output', inBlueprint: false },
  { path: '/output/chip-strategy', description: '筹码策略复盘', category: 'output', inBlueprint: false },
  { path: '/output/profile', description: '八域资料浏览', category: 'output', inBlueprint: false },
])
