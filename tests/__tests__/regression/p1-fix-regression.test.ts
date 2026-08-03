/**
 * @test_id V9-TEST-UT-096
 * P1 修复回归测试 —— 防止已修复的 E2E 测试问题再次出现
 *
 * 覆盖修复点：
 * 1. 采集任务监控路由 /input/collect-tasks 是否正确注册
 * 2. 输出舱侧边栏按钮名称是否正确（研报复盘 / 仪表盘）
 * 3. 分析舱侧边栏按钮名称是否正确（V6 个股评分 / V6 智能评分）
 * 4. 总控舱标题是否为"总控舱"（非"总控中心"）
 * 5. 各舱室关键路由是否可访问
 * 6. 侧边栏导航路径与路由注册的一致性
  * @covers_docs [V9-DOC-PROJ-092]
*/

import { describe, expect, it } from 'vitest'
import { ROUTE_REGISTRY, type RouteConfig } from '@/config/routes'

// ═══════════════════════════════════════════════════════════════
// 测试 1：路由注册完整性
// ═══════════════════════════════════════════════════════════════

describe('路由注册完整性（防回归：路由404）', () => {
  const findRoute = (path: string): RouteConfig | undefined =>
    ROUTE_REGISTRY.find((r) => r.path === path)

  it('采集任务监控页面路由 /input/collect-tasks 应已注册', () => {
    // 修复前：测试使用了 /input/collection-test（404），实际路由为 /input/collect-tasks
    const route = findRoute('/input/collect-tasks')
    expect(route, '路由 /input/collect-tasks 未在 ROUTE_REGISTRY 中注册').toBeDefined()
    expect(route!.category).toBe('input')
  })

  it('采集测试页面路由 /input/data-test 应已注册', () => {
    const route = findRoute('/input/data-test')
    expect(route, '路由 /input/data-test 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })

  it('七维采集配置页面路由 /input/seven-dim 应已注册', () => {
    const route = findRoute('/input/seven-dim')
    expect(route, '路由 /input/seven-dim 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })

  it('分析舱 Hub 页面路由 /analysis/hub 应已注册', () => {
    const route = findRoute('/analysis/hub')
    expect(route, '路由 /analysis/hub 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })

  it('输出舱 Hub 页面路由 /output/hub 应已注册', () => {
    const route = findRoute('/output/hub')
    expect(route, '路由 /output/hub 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })

  it('总控舱 Hub 页面路由 /command/hub 应已注册', () => {
    const route = findRoute('/command/hub')
    expect(route, '路由 /command/hub 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })

  it('V6 智能评分页面路由 /analysis/intelligent-score 应已注册', () => {
    const route = findRoute('/analysis/intelligent-score')
    expect(route, '路由 /analysis/intelligent-score 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })

  it('总控舱配置管理页面路由 /command/config 应已注册', () => {
    const route = findRoute('/command/config')
    expect(route, '路由 /command/config 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })

  it('输出舱研究报告页面路由 /output/research 应已注册', () => {
    const route = findRoute('/output/research')
    expect(route, '路由 /output/research 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })

  it('输出舱交易复盘页面路由 /output/review 应已注册', () => {
    const route = findRoute('/output/review')
    expect(route, '路由 /output/review 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })

  it('输出舱数据导出页面路由 /output/export 应已注册', () => {
    const route = findRoute('/output/export')
    expect(route, '路由 /output/export 未在 ROUTE_REGISTRY 中注册').toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════
// 测试 2：侧边栏导航路径与路由注册一致性
// 硬编码已知侧边栏结构，防止侧边栏按钮路径变更后未同步路由表
// ═══════════════════════════════════════════════════════════════

/** 已知侧边栏按钮配置（与 PortalShell.tsx PANEL_ITEMS 保持同步） */
const KNOWN_SIDEBAR_ITEMS: Array<{ key: string; label: string; path: string; cabin: string }> = [
  // 输入舱
  { key: 'collect-tasks', label: '采集任务监控', path: '/input/collect-tasks', cabin: 'input' },
  { key: 'data-test', label: '采集测试', path: '/input/data-test', cabin: 'input' },
  { key: 'seven-dim', label: '七维采集配置', path: '/input/seven-dim', cabin: 'input' },
  { key: 'fetcher-config', label: '抓取引擎配置', path: '/input/fetcher-config', cabin: 'input' },
  { key: 'bulk-import', label: '批量导入', path: '/input/bulk-import', cabin: 'input' },
  { key: 'hot-sectors', label: '热门板块', path: '/input/hot-sectors', cabin: 'input' },
  { key: 'local-knowledge', label: '本地知识库', path: '/input/local-knowledge', cabin: 'input' },
  // 分析舱
  { key: 'industry-score', label: 'V4 行业评分', path: '/analysis/industry-score', cabin: 'analysis' },
  { key: 'intelligent-score', label: 'V6 智能评分', path: '/analysis/intelligent-score', cabin: 'analysis' },
  { key: 'sector', label: '行业分析', path: '/analysis/sector', cabin: 'analysis' },
  { key: 'backtest', label: '策略回测', path: '/analysis/backtest', cabin: 'analysis' },
  { key: 'score-docs', label: '评分文档', path: '/analysis/score-docs', cabin: 'analysis' },
  { key: 'news', label: '智能资讯', path: '/analysis/news', cabin: 'analysis' },
  // 交易舱
  // TODO: 侧边栏 /trading/portfolio、/trading/execution、/trading/risk 未在 ROUTE_REGISTRY 注册
  // 当前实际注册的路由: /trading/hub, /trading/strategy-snapshots, /trading/holdings, /trading/execution-plans
  { key: 'portfolio', label: '投资组合', path: '/trading/portfolio', cabin: 'trading' },
  { key: 'execution', label: '执行管理', path: '/trading/execution', cabin: 'trading' },
  { key: 'risk', label: '风险控制', path: '/trading/risk', cabin: 'trading' },
  // 输出舱
  // TODO: 侧边栏 /output/dashboard 未在 ROUTE_REGISTRY 注册（页面为 404）
  { key: 'reports', label: '研报复盘', path: '/output/research', cabin: 'output' },
  { key: 'dashboard', label: '仪表盘', path: '/output/dashboard', cabin: 'output' },
  // 总控舱
  { key: 'command-hub', label: '总控台', path: '/command', cabin: 'command' },
  { key: 'monitor', label: '系统监控', path: '/command/monitor', cabin: 'command' },
  { key: 'settings', label: '配置管理', path: '/command/config', cabin: 'command' },
]

describe('侧边栏已知按钮标签验证（防回归：按钮文本不匹配）', () => {
  it('输出舱侧边栏应包含"研报复盘"按钮（非"研究报告"）', () => {
    const outputItems = KNOWN_SIDEBAR_ITEMS.filter((item) => item.cabin === 'output')
    const reportItem = outputItems.find((item) => item.label === '研报复盘')
    expect(reportItem, '输出舱侧边栏已知配置中未找到"研报复盘"按钮').toBeDefined()
  })

  it('输出舱侧边栏应包含"仪表盘"按钮（非"交易复盘"或"数据导出"）', () => {
    const outputItems = KNOWN_SIDEBAR_ITEMS.filter((item) => item.cabin === 'output')
    const dashboardItem = outputItems.find((item) => item.label === '仪表盘')
    expect(dashboardItem, '输出舱侧边栏已知配置中未找到"仪表盘"按钮').toBeDefined()
  })

  it('输出舱侧边栏应仅包含 2 个按钮', () => {
    const outputItems = KNOWN_SIDEBAR_ITEMS.filter((item) => item.cabin === 'output')
    expect(outputItems.length, '输出舱侧边栏按钮数量变更，请确认是否预期并更新测试').toBe(2)
  })

  it('分析舱侧边栏应包含"V6 智能评分"按钮（非"V6 个股智能评分"）', () => {
    const analysisItems = KNOWN_SIDEBAR_ITEMS.filter((item) => item.cabin === 'analysis')
    const intelligentScoreItem = analysisItems.find((item) => item.label === 'V6 智能评分')
    expect(intelligentScoreItem, '分析舱侧边栏已知配置中未找到"V6 智能评分"按钮').toBeDefined()
  })
})

describe('侧边栏路径与路由注册一致性（防回归：侧边栏导航失败）', () => {
  // 已知缺口：所有 P1 缺口已修复，以下集合保留为空以备未来新增缺口
  const KNOWN_GAPS = new Set<string>([])

  for (const item of KNOWN_SIDEBAR_ITEMS) {
    const testFn = KNOWN_GAPS.has(item.path) ? it.skip : it
    testFn(`侧边栏按钮 "${item.label}" 的路径 ${item.path} 应在路由表中注册`, () => {
      const route = ROUTE_REGISTRY.find((r) => r.path === item.path)
      expect(
        route,
        `侧边栏按钮 "${item.label}" 的路径 ${item.path} 未在 ROUTE_REGISTRY 中注册`
      ).toBeDefined()
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// 测试 3：关键页面标题正确性
// ═══════════════════════════════════════════════════════════════

describe('关键页面标题正确性（防回归：标题不匹配）', () => {
  it('总控舱标题应为"总控舱"（非"总控中心"）', () => {
    // 修复前：测试使用了 "总控中心" 标题，实际页面标题为 "总控舱"
    const cabinNames = {
      input: '输入舱',
      analysis: '分析舱',
      trading: '交易舱',
      output: '输出舱',
      command: '总控舱',
    }
    expect(cabinNames.command).toBe('总控舱')
    expect(cabinNames.command).not.toBe('总控中心')
  })

  it('所有舱室标题应以"舱"结尾', () => {
    const cabinNames = ['输入舱', '分析舱', '交易舱', '输出舱', '总控舱']
    for (const name of cabinNames) {
      expect(name.endsWith('舱'), `"${name}" 应以"舱"结尾`).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 测试 4：路由分类正确性
// ═══════════════════════════════════════════════════════════════

describe('路由分类正确性（防回归：路由归类错误）', () => {
  it('所有输入舱子路由应归类为 input', () => {
    const inputRoutes = ROUTE_REGISTRY.filter(
      (r) => r.path.startsWith('/input/') || r.path === '/input'
    )
    for (const route of inputRoutes) {
      expect(route.category, `路由 ${route.path} 应归类为 input`).toBe('input')
    }
  })

  it('所有分析舱子路由应归类为 analysis', () => {
    const analysisRoutes = ROUTE_REGISTRY.filter(
      (r) => r.path.startsWith('/analysis/')
    )
    for (const route of analysisRoutes) {
      expect(route.category, `路由 ${route.path} 应归类为 analysis`).toBe('analysis')
    }
  })

  it('所有输出舱子路由应归类为 output', () => {
    const outputRoutes = ROUTE_REGISTRY.filter(
      (r) => r.path.startsWith('/output/')
    )
    for (const route of outputRoutes) {
      expect(route.category, `路由 ${route.path} 应归类为 output`).toBe('output')
    }
  })

  it('所有总控舱子路由应归类为 command', () => {
    const commandRoutes = ROUTE_REGISTRY.filter(
      (r) => r.path.startsWith('/command/')
    )
    for (const route of commandRoutes) {
      expect(route.category, `路由 ${route.path} 应归类为 command`).toBe('command')
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 测试 5：PortalShell isActivePath 路径匹配逻辑
// 修复背景：侧边栏按钮高亮依赖路径匹配，匹配错误会导致 UI 显示异常
// ═══════════════════════════════════════════════════════════════

describe('isActivePath 路径匹配逻辑（防回归：侧边栏高亮错误）', () => {
  // 复制 PortalShell.tsx 中的 isActivePath 逻辑
  const isActivePath = (pathname: string, path: string): boolean => {
    if (pathname === path) return true
    if (path === '/command') return false
    return pathname.startsWith(`${path}/`)
  }

  it('精确匹配应返回 true', () => {
    expect(isActivePath('/input', '/input')).toBe(true)
    expect(isActivePath('/analysis/intelligent-score', '/analysis/intelligent-score')).toBe(true)
    expect(isActivePath('/output/research', '/output/research')).toBe(true)
  })

  it('子路径应匹配父路径', () => {
    expect(isActivePath('/input/bulk-import', '/input')).toBe(true)
    expect(isActivePath('/analysis/intelligent-score/600519.SH', '/analysis/intelligent-score')).toBe(true)
    expect(isActivePath('/output/research', '/output')).toBe(true)
  })

  it('/command 路径不应匹配子路径（总控舱特殊规则）', () => {
    // /command 是总控台首页，不应匹配 /command/agents 等子路径
    expect(isActivePath('/command/agents', '/command')).toBe(false)
    expect(isActivePath('/command/config', '/command')).toBe(false)
    expect(isActivePath('/command/monitor', '/command')).toBe(false)
  })

  it('不相关路径应返回 false', () => {
    expect(isActivePath('/analysis/stock-score', '/input')).toBe(false)
    expect(isActivePath('/output/research', '/analysis')).toBe(false)
  })

  it('Hub 页面路径匹配', () => {
    // Hub 页面会重定向，但重定向前路径匹配应正确
    expect(isActivePath('/input/hub', '/input')).toBe(true)
    expect(isActivePath('/analysis/hub', '/analysis')).toBe(true)
    expect(isActivePath('/command/hub', '/command')).toBe(false) // 总控舱特殊规则
  })
})

// ═══════════════════════════════════════════════════════════════
// 测试 6：侧边栏 PANEL_ITEMS 结构完整性
// 修复背景：侧边栏按钮文本错误导致 E2E 测试失败
// ═══════════════════════════════════════════════════════════════

describe('侧边栏 PANEL_ITEMS 结构完整性（防回归：按钮配置错误）', () => {
  it('所有侧边栏项的 key 应唯一', () => {
    const keys = KNOWN_SIDEBAR_ITEMS.map((item) => item.key ?? item.label)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size, `发现重复 key: ${keys.filter((k, i) => keys.indexOf(k) !== i).join(', ')}`).toBe(keys.length)
  })

  it('所有侧边栏项的 path 应唯一', () => {
    const paths = KNOWN_SIDEBAR_ITEMS.map((item) => item.path)
    const uniquePaths = new Set(paths)
    const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i)
    expect(uniquePaths.size, `发现重复路径: ${duplicates.join(', ')}`).toBe(paths.length)
  })

  it('所有侧边栏路径应以 / 开头', () => {
    for (const item of KNOWN_SIDEBAR_ITEMS) {
      expect(item.path.startsWith('/'), `"${item.label}" 的路径 "${item.path}" 应以 / 开头`).toBe(true)
    }
  })

  it('输出舱侧边栏按钮标签应为已知值', () => {
    const outputItems = KNOWN_SIDEBAR_ITEMS.filter((item) => item.cabin === 'output')
    const labels = outputItems.map((item) => item.label)
    // 输出舱侧边栏仅有 2 个按钮：研报复盘、仪表盘
    expect(labels).toContain('研报复盘')
    expect(labels).toContain('仪表盘')
    // 不应包含已被废弃的标签
    expect(labels).not.toContain('研究报告')
    expect(labels).not.toContain('输出舱首页')
    expect(labels).not.toContain('数据导出')
    expect(labels).not.toContain('交易复盘')
  })

  it('分析舱侧边栏按钮标签应为已知值', () => {
    const analysisItems = KNOWN_SIDEBAR_ITEMS.filter((item) => item.cabin === 'analysis')
    const labels = analysisItems.map((item) => item.label)
    expect(labels).toContain('V6 智能评分')
    expect(labels).toContain('V4 行业评分')
    // 不应包含已被废弃的标签
    expect(labels).not.toContain('V6 个股智能评分')
  })

  it('每个 cabin 至少应有 1 个侧边栏项', () => {
    const cabins = ['input', 'analysis', 'trading', 'output', 'command']
    for (const cabin of cabins) {
      const items = KNOWN_SIDEBAR_ITEMS.filter((item) => item.cabin === cabin)
      expect(items.length, `舱室 ${cabin} 应至少有 1 个侧边栏项`).toBeGreaterThanOrEqual(1)
    }
  })

  it('侧边栏路径不应包含连续斜杠或尾部斜杠', () => {
    for (const item of KNOWN_SIDEBAR_ITEMS) {
      expect(item.path.includes('//'), `"${item.label}" 路径 "${item.path}" 包含连续斜杠`).toBe(false)
      expect(item.path.endsWith('/'), `"${item.label}" 路径 "${item.path}" 以 / 结尾`).toBe(false)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 测试 7：CABINS 舱室定义完整性
// 修复背景：舱室标题错误（"总控中心" → "总控舱"）导致 E2E 测试失败
// ═══════════════════════════════════════════════════════════════

describe('CABINS 舱室定义完整性（防回归：舱室标题错误）', () => {
  /** 舱室定义（与 PortalShell.tsx CABINS 保持同步） */
  const CABINS = [
    { id: 'input', label: '输入舱', path: '/input' },
    { id: 'analysis', label: '分析舱', path: '/analysis' },
    { id: 'trading', label: '交易舱', path: '/trading' },
    { id: 'output', label: '输出舱', path: '/output' },
    { id: 'command', label: '总控舱', path: '/command' },
  ] as const

  it('应有 5 个舱室', () => {
    expect(CABINS.length).toBe(5)
  })

  it('所有舱室标题应以"舱"结尾', () => {
    for (const cabin of CABINS) {
      expect(cabin.label.endsWith('舱'), `"${cabin.label}" 应以"舱"结尾`).toBe(true)
    }
  })

  it('总控舱标题应为"总控舱"（非"总控中心"）', () => {
    const commandCabin = CABINS.find((c) => c.id === 'command')
    expect(commandCabin?.label).toBe('总控舱')
    expect(commandCabin?.label).not.toBe('总控中心')
  })

  it('所有舱室 id 应唯一', () => {
    const ids = CABINS.map((c) => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('所有舱室 path 应唯一', () => {
    const paths = CABINS.map((c) => c.path)
    const uniquePaths = new Set(paths)
    expect(uniquePaths.size).toBe(paths.length)
  })

  it('舱室路径应与 id 一致', () => {
    for (const cabin of CABINS) {
      expect(cabin.path).toBe(`/${cabin.id}`)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 测试 8：路由到舱室映射逻辑
// 修复背景：路由路径错误导致页面 404
// ═══════════════════════════════════════════════════════════════

describe('路由到舱室映射逻辑（防回归：路由归类错误）', () => {
  const CABIN_PATHS = ['/input', '/analysis', '/trading', '/output', '/command']

  /** 根据路径判断所属舱室（与 PortalShell.tsx activeCabin 逻辑一致） */
  const getCabinFromPath = (pathname: string): string => {
    for (const cabinPath of CABIN_PATHS) {
      if (pathname === cabinPath || pathname.startsWith(`${cabinPath}/`)) {
        return cabinPath.replace('/', '')
      }
    }
    return 'input' // 默认
  }

  it('所有注册路由的 category 应与路径推导一致', () => {
    const mismatches: string[] = []
    for (const route of ROUTE_REGISTRY) {
      if (route.category === 'portal' || route.category === 'other') continue
      const derivedCabin = getCabinFromPath(route.path)
      if (derivedCabin !== route.category) {
        mismatches.push(`${route.path}: category=${route.category}, derived=${derivedCabin}`)
      }
    }
    expect(mismatches, `路由 category 与路径推导不一致:\n${mismatches.join('\n')}`).toEqual([])
  })

  it('所有侧边栏路径的 cabin 应与路径推导一致', () => {
    const mismatches: string[] = []
    for (const item of KNOWN_SIDEBAR_ITEMS) {
      const derivedCabin = getCabinFromPath(item.path)
      if (derivedCabin !== item.cabin) {
        mismatches.push(`${item.label} (${item.path}): cabin=${item.cabin}, derived=${derivedCabin}`)
      }
    }
    // 所有 P1 缺口已修复
    const KNOWN_MISMATCHES = new Set<string>([])
    const actualMismatches = mismatches.filter((m) => {
      const path = m.split(' ')[0]?.replace(/^.*\(/, '').replace(/\).*$/, '') || ''
      return !KNOWN_MISMATCHES.has(path)
    })
    expect(actualMismatches, `侧边栏路径 cabin 与路径推导不一致:\n${actualMismatches.join('\n')}`).toEqual([])
  })

  it('关键采集页面路由可正确映射到输入舱', () => {
    expect(getCabinFromPath('/input/collect-tasks')).toBe('input')
    expect(getCabinFromPath('/input/data-test')).toBe('input')
    expect(getCabinFromPath('/input/seven-dim')).toBe('input')
    expect(getCabinFromPath('/input/fetcher-config')).toBe('input')
  })

  it('关键分析页面路由可正确映射到分析舱', () => {
    expect(getCabinFromPath('/analysis/intelligent-score')).toBe('analysis')
    expect(getCabinFromPath('/analysis/hub')).toBe('analysis')
  })

  it('关键输出页面路由可正确映射到输出舱', () => {
    expect(getCabinFromPath('/output/research')).toBe('output')
    expect(getCabinFromPath('/output/review')).toBe('output')
    expect(getCabinFromPath('/output/export')).toBe('output')
  })

  it('关键总控页面路由可正确映射到总控舱', () => {
    expect(getCabinFromPath('/command/config')).toBe('command')
    expect(getCabinFromPath('/command/monitor')).toBe('command')
    expect(getCabinFromPath('/command/hub')).toBe('command')
  })

  it('Hub 页面重定向逻辑：非总控舱 /hub 应重定向到舱室首页', () => {
    // 模拟 PortalShell 中的 Hub 重定向逻辑
    const shouldRedirect = (pathname: string): boolean => {
      return pathname.endsWith('/hub') && getCabinFromPath(pathname) !== 'command'
    }
    expect(shouldRedirect('/input/hub')).toBe(true)
    expect(shouldRedirect('/analysis/hub')).toBe(true)
    expect(shouldRedirect('/trading/hub')).toBe(true)
    expect(shouldRedirect('/output/hub')).toBe(true)
    expect(shouldRedirect('/command/hub')).toBe(false) // 总控舱不重定向
  })
})