import { runRouteAudits } from './_audit-helpers'

runRouteAudits('portal', [
  { path: '/', description: '首页 HomePage', category: 'portal', inBlueprint: true },
  { path: '/cockpit', description: '驾驶舱 CockpitShell（Widget 引擎）', category: 'portal', inBlueprint: true },
])
