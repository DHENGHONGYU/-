import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTestLogger } from './_helpers/test-logger'

/**
 * verify-all-routes.ts 单元测试（v3.0 白盒模式）
 *
 * 改造后的脚本采用"白盒/透明管道"模式：
 * - export scan() / formatReport() / main() 三个函数
 * - scan() 返回 Report 对象（纯数据，无副作用）
 * - 测试直接调用 scan() 验证返回值，无需解析 console.log 字符串
 *
 * 测试覆盖：
 * 1. scan() 重复路径检测（duplicate-path）
 * 2. scan() 缺失路由检测（missing-route）
 * 3. scan() 孤儿路由检测（orphan-route）
 * 4. scan() 报告结构（violations / warnings / summary / coverageRate）
 * 5. formatReport() 人类可读报告格式化
 * 6. 边界条件（routes 加载失败 / 空路由列表）
 *
 * 通过 mock `../src/config/routes.ts` 的 hasRoute/getAllPaths 来控制测试场景。
 */

// mock routes 模块的状态
let mockAllPaths: string[] = []
let mockHasRouteMap = new Map<string, boolean>()
let mockRoutesShouldThrow = false

vi.mock('../../../src/config/routes', () => ({
  hasRoute: (path: string) => {
    if (mockRoutesShouldThrow) {
      throw new Error('mock routes error')
    }
    return mockHasRouteMap.get(path) ?? false
  },
  getAllPaths: () => {
    if (mockRoutesShouldThrow) {
      throw new Error('mock routes error')
    }
    return [...mockAllPaths]
  },
}))

describe('verify-all-routes.ts v3.0（白盒测试）', () => {
  const logger = createTestLogger('verify-all-routes')

  beforeEach(() => {
    logger.info('===== beforeEach 清理开始 =====')
    logger.step('重置 mock 路由状态')
    mockAllPaths = []
    mockHasRouteMap = new Map()
    mockRoutesShouldThrow = false
    logger.step('vi.clearAllMocks()')
    vi.clearAllMocks()
    logger.step('vi.resetModules()')
    vi.resetModules()
    logger.info('===== beforeEach 清理结束 =====')
  })

  afterEach(() => {
    logger.info('===== afterEach 清理开始 =====')
    logger.step('vi.restoreAllMocks()')
    vi.restoreAllMocks()
    logger.info('===== afterEach 清理结束 =====')
  })

  /** 动态导入 scan 函数 */
  async function importScan(): Promise<typeof import('../../../scripts/verify-all-routes')> {
    return await import('../../../scripts/verify-all-routes')
  }

  /**
   * 设置 mock 路由状态
   * @param allPaths ROUTE_REGISTRY 中所有路径列表（可能含重复）
   * @param hasRouteMap 每个路径是否已注册的映射（未列出则视为 false）
   */
  function setupRoutes(allPaths: string[], hasRouteMap: Record<string, boolean> = {}): void {
    mockAllPaths = [...allPaths]
    mockHasRouteMap = new Map(Object.entries(hasRouteMap))
  }

  // ============================================================
  // scan() 重复路径检测
  // ============================================================

  describe('scan() 重复路径检测', () => {
    it('检测 ROUTE_REGISTRY 中的重复路径', async () => {
      logger.testStart('检测 ROUTE_REGISTRY 中的重复路径')
      logger.step('设置重复路径...')
      setupRoutes(
        ['/input', '/input', '/analysis', '/trading'],
        { '/input': true, '/analysis': true, '/trading': true },
      )
      logger.step('动态导入 scan 函数...')
      const { scan } = await importScan()
      logger.step('执行 scan()...')
      const report = scan()
      logger.wrapAssert('violations 包含重复路径', () => {
        expect(report.violations).toContainEqual(
          expect.objectContaining({
            type: 'duplicate-path',
            path: '/input',
            message: expect.stringContaining('重复'),
          }),
        )
      })
      logger.wrapAssert('duplicatePaths 统计正确', () => {
        expect(report.summary.duplicatePaths).toBe(1)
      })
      logger.testEnd('检测 ROUTE_REGISTRY 中的重复路径')
    })

    it('无重复路径时 duplicatePaths === 0', async () => {
      setupRoutes(['/input', '/analysis', '/trading'], {
        '/input': true,
        '/analysis': true,
        '/trading': true,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.summary.duplicatePaths).toBe(0)
      expect(report.violations.filter(v => v.type === 'duplicate-path')).toHaveLength(0)
    })
  })

  // ============================================================
  // scan() 缺失路由检测
  // ============================================================

  describe('scan() 缺失路由检测', () => {
    it('检测预期路径未在 ROUTE_REGISTRY 注册', async () => {
      // 仅注册部分预期路径
      setupRoutes(
        ['/input', '/analysis'],
        {
          '/input': true,
          '/analysis': true,
          // 缺少其他所有预期路径
        },
      )

      const { scan } = await importScan()
      const report = scan()

      const missingRoutes = report.violations.filter(v => v.type === 'missing-route')
      expect(missingRoutes.length).toBeGreaterThan(0)
      // 应该有 missing-route 类型违规，且包含 cabin 信息
      expect(missingRoutes[0]).toHaveProperty('cabin')
      expect(missingRoutes[0]).toHaveProperty('label')
    })

    it('所有预期路径都注册时无 missing-route 违规', async () => {
      // 构造所有预期路径都已注册的场景
      // 必须与 scripts/verify-all-routes.ts 的 EXPECTED_PATHS 完全同步
      const allExpectedPaths = [
        // input
        '/input', '/input/hub', '/input/bulk-import', '/input/hot-sectors',
        '/input/data-test', '/input/local-knowledge', '/input/collect-tasks',
        '/input/seven-dim', '/input/fetcher-config',
        // analysis
        '/analysis', '/analysis/hub', '/analysis/stock-score',
        '/analysis/stock-score/:symbol', '/analysis/sector', '/analysis/backtest',
        '/analysis/industry-score', '/analysis/intelligent-score', '/analysis/score-docs',
        '/analysis/news', '/analysis/hot-sector', '/analysis/value-pit',
        '/analysis/stock-pool', '/analysis/score-comparison', '/analysis/multi-factor',
        // trading
        '/trading', '/trading/strategy-snapshots', '/trading/holdings',
        '/trading/flow', '/trading/execution-plans', '/trading/execution',
        '/trading/portfolio', '/trading/risk',
        // output
        '/output', '/output/hub', '/output/research', '/output/review',
        '/output/export', '/output/dashboard',
        // command
        '/command', '/command/hub', '/command/agents', '/command/agents/registry',
        '/command/agents/registry/:agentId', '/command/agents/trigger',
        '/command/agents/tasks', '/command/agents/custom', '/command/agents/llm',
        '/command/agents/capability-graph', '/command/agents/dag-scheduler',
        '/command/agents/feedback', '/command/agents/model-upgrade',
        '/command/agents/data-labels', '/command/agents/api-config',
        '/command/agents/skill-audit', '/command/agents/optimization',
        '/command/agents/changelog', '/command/mcp-servers', '/command/monitor',
        '/command/config', '/command/showcase', '/command/health',
        // portal
        '/', '/cockpit', '/mock-test',
      ]
      const hasRouteMap: Record<string, boolean> = {}
      for (const p of allExpectedPaths) {
        hasRouteMap[p] = true
      }
      setupRoutes(allExpectedPaths, hasRouteMap)

      const { scan } = await importScan()
      const report = scan()

      const missingRoutes = report.violations.filter(v => v.type === 'missing-route')
      expect(missingRoutes).toHaveLength(0)
    })
  })

  // ============================================================
  // scan() 孤儿路由检测
  // ============================================================

  describe('scan() 孤儿路由检测', () => {
    it('检测未在预期列表中但已注册的孤儿路由', async () => {
      // 注册一个不在预期列表中的路径
      setupRoutes(
        ['/input', '/input/hub', '/unknown/orphan'],
        {
          '/input': true,
          '/input/hub': true,
          // '/unknown/orphan' 是孤儿路由
        },
      )

      const { scan } = await importScan()
      const report = scan()

      const orphanWarnings = report.warnings.filter(w => w.type === 'orphan-route')
      expect(orphanWarnings.some(w => w.path === '/unknown/orphan')).toBe(true)
      expect(report.summary.orphanPaths).toBeGreaterThan(0)
    })

    it('无孤儿路由时 orphanPaths === 0', async () => {
      const allExpectedPaths = ['/input', '/input/hub']
      setupRoutes(allExpectedPaths, {
        '/input': true,
        '/input/hub': true,
      })

      const { scan } = await importScan()
      const report = scan()

      // 注意：当所有路径都是预期路径且都注册时，无孤儿路由
      const orphanWarnings = report.warnings.filter(w => w.type === 'orphan-route')
      expect(orphanWarnings).toHaveLength(0)
    })
  })

  // ============================================================
  // scan() 报告结构
  // ============================================================

  describe('scan() 报告结构', () => {
    it('返回完整 Report 对象，包含 violations/warnings/summary', async () => {
      setupRoutes(['/input'], { '/input': true })

      const { scan } = await importScan()
      const report = scan()

      expect(report).toHaveProperty('violations')
      expect(report).toHaveProperty('warnings')
      expect(report).toHaveProperty('summary')
      expect(Array.isArray(report.violations)).toBe(true)
      expect(Array.isArray(report.warnings)).toBe(true)
      expect(report.summary).toHaveProperty('totalFiles')
      expect(report.summary).toHaveProperty('totalViolations')
      expect(report.summary).toHaveProperty('totalWarnings')
      expect(report.summary).toHaveProperty('totalRoutes')
      expect(report.summary).toHaveProperty('totalExpected')
      expect(report.summary).toHaveProperty('totalCovered')
      expect(report.summary).toHaveProperty('coverageRate')
      expect(report.summary).toHaveProperty('duplicatePaths')
      expect(report.summary).toHaveProperty('orphanPaths')
      expect(report.summary).toHaveProperty('byViolationType')
      expect(report.summary).toHaveProperty('byWarningType')
    })

    it('summary.totalFiles 与 totalRoutes 一致（兼容 AuditReport）', async () => {
      setupRoutes(['/input', '/analysis', '/trading'], {
        '/input': true,
        '/analysis': true,
        '/trading': true,
      })

      const { scan } = await importScan()
      const report = scan()

      expect(report.summary.totalFiles).toBe(report.summary.totalRoutes)
      expect(report.summary.totalRoutes).toBe(3)
    })

    it('summary.coverageRate 是百分比字符串', async () => {
      setupRoutes(['/input'], { '/input': true })

      const { scan } = await importScan()
      const report = scan()

      expect(typeof report.summary.coverageRate).toBe('string')
      expect(report.summary.coverageRate).toMatch(/^\d+\.\d%$/)
    })

    it('summary.byViolationType 按类型分组统计', async () => {
      // 同时存在重复路径和缺失路由
      setupRoutes(
        ['/input', '/input'],  // 重复
        { '/input': true },  // 其他都缺失
      )

      const { scan } = await importScan()
      const report = scan()

      const totalByType = Object.values(report.summary.byViolationType).reduce((a, b) => a + b, 0)
      expect(totalByType).toBe(report.violations.length)
    })
  })

  // ============================================================
  // formatReport() 人类可读报告
  // ============================================================

  describe('formatReport() 格式化', () => {
    it('无违规时显示绿色"路由一致性检查通过"', async () => {
      const { formatReport } = await importScan()
      const allExpectedPaths = [
        '/input', '/input/hub', '/input/bulk-import', '/input/hot-sectors',
        '/input/data-test', '/input/local-knowledge',
        '/analysis', '/analysis/hub', '/analysis/stock-score',
        '/analysis/stock-score/:symbol', '/analysis/sector', '/analysis/backtest',
        '/analysis/industry-score', '/analysis/intelligent-score', '/analysis/score-docs',
        '/analysis/news', '/analysis/news-v6', '/analysis/hot-sector', '/analysis/value-pit',
        '/trading', '/trading/hub', '/trading/strategy-snapshots', '/trading/holdings',
        '/output', '/output/hub', '/output/research', '/output/review', '/output/export',
        '/command', '/command/hub',
        '/', '/cockpit',
      ]
      const emptyReport = {
        violations: [],
        warnings: [],
        summary: {
          totalFiles: allExpectedPaths.length,
          totalViolations: 0,
          totalWarnings: 0,
          totalRoutes: allExpectedPaths.length,
          totalExpected: allExpectedPaths.length,
          totalCovered: allExpectedPaths.length,
          coverageRate: '100.0%',
          duplicatePaths: 0,
          orphanPaths: 0,
          byViolationType: {},
          byWarningType: {},
        },
      }
      const output = formatReport(emptyReport as never)

      expect(output).toContain('无重复路径')
      expect(output).toContain('无孤儿路由')
      expect(output).toContain('路由一致性检查通过')
    })

    it('有重复路径时显示红色错误', async () => {
      const { formatReport } = await importScan()
      const report = {
        violations: [
          {
            path: '/input',
            type: 'duplicate-path',
            message: '路径 "/input" 在 ROUTE_REGISTRY 中重复 2 次',
          },
        ],
        warnings: [],
        summary: {
          totalFiles: 10,
          totalViolations: 1,
          totalWarnings: 0,
          totalRoutes: 10,
          totalExpected: 32,
          totalCovered: 32,
          coverageRate: '100.0%',
          duplicatePaths: 1,
          orphanPaths: 0,
          byViolationType: { 'duplicate-path': 1 },
          byWarningType: {},
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('发现 1 处重复路径')
      expect(output).toContain('路径 "/input" 在 ROUTE_REGISTRY 中重复 2 次')
      expect(output).toContain('路由一致性检查未通过')
    })

    it('有缺失路由时显示红色错误', async () => {
      const { formatReport } = await importScan()
      const report = {
        violations: [
          {
            cabin: 'input',
            path: '/input/hub',
            label: '输入舱首页',
            type: 'missing-route',
            message: '预期路径 /input/hub（输入舱首页）未在 ROUTE_REGISTRY 中注册',
          },
        ],
        warnings: [],
        summary: {
          totalFiles: 31,
          totalViolations: 1,
          totalWarnings: 0,
          totalRoutes: 31,
          totalExpected: 32,
          totalCovered: 31,
          coverageRate: '96.9%',
          duplicatePaths: 0,
          orphanPaths: 0,
          byViolationType: { 'missing-route': 1 },
          byWarningType: {},
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('未注册')
      expect(output).toContain('/input/hub')
      expect(output).toContain('覆盖: 31/32 (96.9%)')
      expect(output).toContain('路由一致性检查未通过')
    })

    it('有孤儿路由时显示黄色警告', async () => {
      const { formatReport } = await importScan()
      const report = {
        violations: [],
        warnings: [
          {
            path: '/unknown/orphan',
            type: 'orphan-route',
            message: '路径 "/unknown/orphan" 已在 ROUTE_REGISTRY 注册但未在预期列表中声明',
          },
        ],
        summary: {
          totalFiles: 33,
          totalViolations: 0,
          totalWarnings: 1,
          totalRoutes: 33,
          totalExpected: 32,
          totalCovered: 32,
          coverageRate: '100.0%',
          duplicatePaths: 0,
          orphanPaths: 1,
          byViolationType: {},
          byWarningType: { 'orphan-route': 1 },
        },
      }
      const output = formatReport(report as never)

      expect(output).toContain('发现 1 条孤儿路由')
      expect(output).toContain('/unknown/orphan')
      // 孤儿路由是 warning，不应阻塞 CI
      expect(output).toContain('路由一致性检查通过')
    })
  })

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('routes 模块加载失败时抛出错误', async () => {
      mockRoutesShouldThrow = true

      const { scan } = await importScan()
      // safeGetAllPaths 内部会 throw，但 scan 不应该捕获这个错误
      // 因为这是脚本级的执行错误（应由管道层处理）
      expect(() => scan()).toThrow(/加载 ROUTE_REGISTRY 失败/)
    })

    it('空路由列表时返回 0 总数', async () => {
      setupRoutes([], {})

      const { scan } = await importScan()
      const report = scan()

      expect(report.summary.totalRoutes).toBe(0)
      expect(report.summary.totalFiles).toBe(0)
      // 所有预期路径都是 missing-route
      const missingRoutes = report.violations.filter(v => v.type === 'missing-route')
      expect(missingRoutes.length).toBe(report.summary.totalExpected)
    })
  })
})
