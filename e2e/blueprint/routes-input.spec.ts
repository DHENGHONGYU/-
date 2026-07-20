import { runRouteAudits } from './_audit-helpers'

runRouteAudits('input', [
  { path: '/input', description: '输入舱 InputDashboard', category: 'input', inBlueprint: true },
  { path: '/input/hub', description: '输入舱 - 模块首页', category: 'input', inBlueprint: false },
  { path: '/input/hot-sectors', description: '输入舱 - 热门板块 HotSectorPanel', category: 'input', inBlueprint: true },
  { path: '/input/data-test', description: '输入舱 - 采集测试 DataTestPanel', category: 'input', inBlueprint: true },
  { path: '/input/pool-board', description: '研究候选池总览 PoolBoard', category: 'input', inBlueprint: false },
  { path: '/input/intention-pool', description: '意向候选池（三列看板）', category: 'input', inBlueprint: false },
  { path: '/input/local-knowledge', description: '本地知识库', category: 'input', inBlueprint: false },
  { path: '/input/seven-dim', description: '七维采集策略配置', category: 'input', inBlueprint: false },
  { path: '/input/fetcher-config', description: '抓取引擎配置', category: 'input', inBlueprint: false },
  { path: '/input/collect-tasks', description: '采集任务监控', category: 'input', inBlueprint: false },
])
