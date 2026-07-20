import { runRouteAudits } from './_audit-helpers'

runRouteAudits('trading', [
  { path: '/trading', description: '交易舱 TradingApp', category: 'trading', inBlueprint: true },
  { path: '/trading/flow', description: '交易流程', category: 'trading', inBlueprint: false },
  { path: '/trading/holdings', description: '交易持仓管理 HoldingsPage', category: 'trading', inBlueprint: false },
  { path: '/trading/execution-plans', description: '执行计划管理', category: 'trading', inBlueprint: false },
  { path: '/trading/execution', description: '执行管理（别名）', category: 'trading', inBlueprint: false },
  { path: '/trading/portfolio', description: '投资组合管理', category: 'trading', inBlueprint: false },
  { path: '/trading/risk', description: '风险控制管理', category: 'trading', inBlueprint: false },
  { path: '/trading/strategy-snapshots', description: '策略快照', category: 'trading', inBlueprint: false },
])
