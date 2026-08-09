#!/usr/bin/env tsx
/**
 * Store 依赖关系图谱生成器
 *
 * 调用 audit-mapping-integrity.ts v2.2 的 export 函数收集数据，
 * 生成完整的 Store 依赖关系图谱 JSON 文件，包含：
 *   - 所有 Store 元信息（hook 名、deprecated 标记）
 *   - Store 间依赖图（每条边的源、目标、行号、导入路径）
 *   - Facade 模式识别结果（聚合的子 Store 列表）
 *   - 直接消费者明细（按 UI/Services/Core 等层级分类）
 *   - 传递可达性分析结果（BFS 起点、遍历路径、可达 Store 列表）
 *   - 最终状态判定（used/unused 及判定依据）
 *
 * @created 2026-07-06
 * @compliance AGENTS.md §一 分层规则
 */

import { join, resolve } from 'path'
import { safeWriteFileSync } from '../../src/lib/safeFs'
import { fileURLToPath } from 'url'

import {
  collectStoreMetas,
  buildStoreDependencyGraph,
  markFacadeStores,
  findStoreConsumers,
  computeTransitiveReachability,
  extractStoreImports,
  type ConsumerRef,
} from './audit-mapping-integrity'

// ═══════════════════════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const ROOT = resolve(__dirname, '..')
const SRC = join(ROOT, 'src')

/** 搜索根目录（与 audit-mapping-integrity.ts main() 一致） */
const SEARCH_ROOTS = ['pages', 'components', 'apps', 'cockpit', 'hooks', 'portal', 'store', 'services', 'core', 'lib', 'agents', 'mcp'].map(
  d => join(SRC, d),
)

/** 输出文件路径 */
const OUTPUT_FILE = join(ROOT, 'docs', 'reports', 'store-dependency-graph.json')

// ═══════════════════════════════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════════════════════════════

interface GraphReport {
  $schema: string
  generatedAt: string
  description: string
  source: string
  stats: {
    totalStores: number
    usedStores: number
    unusedStores: number
    pendingIntegrationStores: number
    facadeStores: number
    storeToStoreEdges: number
    transitivelyReachableViaFacade: number
    directConsumersTotal: number
    bfsStartingPoints: number
  }
  stores: Array<{
    name: string
    file: string
    hookName: string | null
    hookMatchesFileName: boolean
    deprecated: boolean
    isFacade: boolean
    aggregates: string[]
    status: 'used' | 'unused'
    usedReason: string
    directConsumers: {
      total: number
      byLayer: Record<string, number>
      byImportType: Record<string, number>
      testOnly: number
      commentOnly: number
      isStoreDir: number
      uiLayer: ConsumerRef[]
    }
    transitivelyReachable: boolean
    transitiveOnly: boolean
  }>
  storeToStoreDependencies: {
    edges: Array<{
      source: string
      target: string
      sourceFile: string
      line: number
      importPath: string
    }>
  }
  facadeStores: Array<{
    name: string
    file: string
    deprecated: boolean
    aggregates: string[]
    aggregateCount: number
  }>
  transitiveReachability: {
    bfsStartingPoints: string[]
    reachableFromEachRoot: Record<string, string[]>
    allTransitivelyReachable: string[]
    transitiveOnly: string[]
    traversalPath: Array<{
      current: string
      newReachable: string[]
    }>
  }
  unusedStores: Array<{
    name: string
    file: string
    hookName: string | null
    deprecated: boolean
    isFacade: boolean
    commentReferences: string[]
    remediation: string
  }>
  pendingIntegrationStores: Array<{
    name: string
    file: string
    hookName: string | null
    businessDomain: string
    mappedMetrics: string[]
    integrationPlan: string
    directConsumersSummary: {
      total: number
      commentOnly: number
      testOnly: number
    }
    priority: 'P0' | 'P1' | 'P2'
    rationale: string
  }>
  detectionRules: Array<{
    id: string
    name: string
    description: string
  }>
}

function main(): void {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Store 依赖关系图谱生成器 v1.0')
  console.log('  调用 audit-mapping-integrity.ts v2.2 export 函数')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // ─── N1: 收集 Store 元信息 ─────────────────────────────────────────────────
  console.log('[N1] 收集 Store 元信息...')
  const metas = collectStoreMetas()
  console.log(`  发现 ${metas.length} 个 Store 文件\n`)

  // ─── N2: 构建 Store 间依赖图 ──────────────────────────────────────────────
  console.log('[N2] 构建 Store 间依赖图...')
  const graph = buildStoreDependencyGraph(metas)
  let edgeCount = 0
  for (const targets of graph.values()) {
    edgeCount += targets.length
  }
  console.log(`  共 ${edgeCount} 条 Store 间依赖边\n`)

  // ─── N3: 标记 Facade Store ─────────────────────────────────────────────────
  console.log('[N3] 标记 Facade Store...')
  markFacadeStores(metas, graph)
  const facades = metas.filter(m => m.isFacade)
  console.log(`  识别 ${facades.length} 个 Facade Store\n`)

  // ─── N4: 查找直接消费者 ────────────────────────────────────────────────────
  console.log('[N4] 查找每个 Store 的直接消费者...')
  const directConsumersMap = new Map<string, ConsumerRef[]>()
  for (const meta of metas) {
    const consumers = findStoreConsumers(meta, SEARCH_ROOTS)
    directConsumersMap.set(meta.fileName, consumers)
  }
  const totalConsumers = Array.from(directConsumersMap.values()).reduce((sum, arr) => sum + arr.length, 0)
  console.log(`  共 ${totalConsumers} 条消费者引用\n`)

  // ─── N5: 传递可达性分析 ────────────────────────────────────────────────────
  console.log('[N5] 计算传递可达性...')
  const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, directConsumersMap)
  console.log(`  BFS 起点: ${diagnostics.startingPoints.length} 个`)
  console.log(`  传递可达 Store: ${reachable.size} 个`)
  console.log(`  transitiveOnly: ${diagnostics.transitiveOnly.length} 个\n`)

  // ─── N6: 综合状态判定与构建报告 ────────────────────────────────────────────
  console.log('[N6] 构建完整报告...')

  const bfsRootsToReachable: Record<string, string[]> = {}
  for (const root of diagnostics.startingPoints) {
    const reachableFromRoot: string[] = []
    const visited = new Set<string>([root])
    const queue = [root]
    while (queue.length > 0) {
      const current = queue.shift()!
      const targets = graph.get(current) ?? []
      for (const target of targets) {
        if (!visited.has(target)) {
          visited.add(target)
          reachableFromRoot.push(target)
          queue.push(target)
        }
      }
    }
    bfsRootsToReachable[root] = reachableFromRoot
  }

  // 按文件名排序保证稳定的输出
  const sortedMetas = [...metas].sort((a, b) => a.fileName.localeCompare(b.fileName))

  const storesReport = sortedMetas.map(meta => {
    const consumers = directConsumersMap.get(meta.fileName) ?? []
    const hasUiConsumer = consumers.some(c => !c.testOnly && !c.isStoreDir && !c.commentOnly)
    const isReachable = reachable.has(meta.fileName)
    const isTransitiveOnly = diagnostics.transitiveOnly.includes(meta.fileName)
    const isUsed = hasUiConsumer || isReachable

    let usedReason: string
    if (hasUiConsumer) {
      usedReason = 'UI 层直接消费者存在'
    } else if (isReachable) {
      usedReason = '通过 Facade 传递可达'
    } else {
      usedReason = '无 UI 层消费者且未通过传递可达'
    }

    // 按层级分类消费者
    const byLayer: Record<string, number> = {}
    const byImportType: Record<string, number> = {}
    let testOnlyCount = 0
    let commentOnlyCount = 0
    let isStoreDirCount = 0
    const uiLayerConsumers: ConsumerRef[] = []

    for (const c of consumers) {
      // 按层级
      const layer = extractLayer(c.file)
      byLayer[layer] = (byLayer[layer] ?? 0) + 1

      // 按导入类型
      byImportType[c.importType] = (byImportType[c.importType] ?? 0) + 1

      if (c.testOnly) testOnlyCount++
      if (c.commentOnly) commentOnlyCount++
      if (c.isStoreDir) isStoreDirCount++
      if (!c.testOnly && !c.isStoreDir && !c.commentOnly) {
        uiLayerConsumers.push(c)
      }
    }

    return {
      name: meta.fileName,
      file: meta.filePath.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'),
      hookName: meta.hookName,
      hookMatchesFileName: meta.hookName === `use${meta.fileName.charAt(0).toUpperCase()}${meta.fileName.slice(1)}`,
      deprecated: meta.deprecated,
      isFacade: meta.isFacade,
      aggregates: meta.aggregates,
      status: isUsed ? ('used' as const) : ('unused' as const),
      usedReason,
      directConsumers: {
        total: consumers.length,
        byLayer,
        byImportType,
        testOnly: testOnlyCount,
        commentOnly: commentOnlyCount,
        isStoreDir: isStoreDirCount,
        uiLayer: uiLayerConsumers,
      },
      transitivelyReachable: isReachable,
      transitiveOnly: isTransitiveOnly,
    }
  })

  // 提取 Store-to-Store 依赖边明细（含真实行号和导入路径）
  const storeToStoreEdges: Array<{
    source: string
    target: string
    sourceFile: string
    line: number
    importPath: string
  }> = []

  for (const meta of sortedMetas) {
    const targets = graph.get(meta.fileName) ?? []
    if (targets.length === 0) continue
    // 通过 extractStoreImports 重新解析获取真实行号和导入路径
    const imports = extractStoreImports(meta.filePath)
    const sourceFile = meta.filePath.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/')
    for (const target of targets) {
      const matched = imports.find(imp => imp.target === target)
      storeToStoreEdges.push({
        source: meta.fileName,
        target,
        sourceFile,
        line: matched?.line ?? 0,
        importPath: matched?.importPath ?? './' + target,
      })
    }
  }

  // 未使用 Store 明细（已识别业务定位的 5 个 Store，归入 pendingIntegrationStores，不在此列）
  // 此处仅保留既无 UI 消费者、又不在 PENDING_INTEGRATION_META 中的真正"可删除"候选
  const unusedStoresReport = sortedMetas
    .filter(meta => {
      const consumers = directConsumersMap.get(meta.fileName) ?? []
      const hasUiConsumer = consumers.some(c => !c.testOnly && !c.isStoreDir && !c.commentOnly)
      const isReachable = reachable.has(meta.fileName)
      // 已识别为待接入核心数据层的 Store 不计入"可删除"列表
      const isPendingIntegration = meta.fileName in PENDING_INTEGRATION_META
      return !hasUiConsumer && !isReachable && !isPendingIntegration
    })
    .map(meta => {
      const consumers = directConsumersMap.get(meta.fileName) ?? []
      const commentRefs = consumers
        .filter(c => c.commentOnly)
        .map(c => c.file.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'))

      return {
        name: meta.fileName,
        file: meta.filePath.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'),
        hookName: meta.hookName,
        deprecated: meta.deprecated,
        isFacade: meta.isFacade,
        commentReferences: Array.from(new Set(commentRefs)),
        remediation: suggestRemediation(meta.fileName),
      }
    })

  // 待接入 Store 明细（核心业务数据层，UI 尚未映射）
  const pendingIntegrationStoresReport = sortedMetas
    .filter(meta => meta.fileName in PENDING_INTEGRATION_META)
    .map(meta => {
      const meta_info = PENDING_INTEGRATION_META[meta.fileName]!
      const consumers = directConsumersMap.get(meta.fileName) ?? []

      // 优先级判定：基于业务紧迫性
      const priority: 'P0' | 'P1' | 'P2' = (() => {
        // P0：风控相关，影响资金安全
        if (meta.fileName === 'riskStore') return 'P0'
        // P1：直接影响核心投研判断
        if (meta.fileName === 'rotationSignalStore' || meta.fileName === 'signalQualityStore') return 'P1'
        // P2：辅助性/未来规划
        return 'P2'
      })()

      const rationale = (() => {
        switch (meta.fileName) {
          case 'riskStore':
            return '风控数据为资金安全核心因子，AGENTS.md §6.1 要求执行计划提交前展示风险预检，必须优先接入 ExecutionPlanPanel 与 RiskMonitorWidget'
          case 'rotationSignalStore':
            return '板块轮动是行业评分的核心输出，SectorRotationHeatmap 组件已存在但未接入数据源，导致热点图渲染依赖临时数据'
          case 'signalQualityStore':
            return '信号质量影响个股筛选置信度，WatchlistWidget 当前缺少质量分级维度，易误导用户采用低质量信号'
          case 'analysisStore':
            return 'AnalysisApp 重构时需作为状态管理层，替代组件内直接调用 services，符合 AGENTS.md §一 分层规则'
          case 'chatStore':
            return 'AI 投研对话面板尚未规划，可作为 LLM 可增强层（L0/L1/L2/L5/L6）的上下文持久化层'
          default:
            return '待人工补充业务紧迫性说明'
        }
      })()

      return {
        name: meta.fileName,
        file: meta.filePath.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'),
        hookName: meta.hookName,
        businessDomain: meta_info.businessDomain,
        mappedMetrics: meta_info.mappedMetrics,
        integrationPlan: meta_info.integrationPlan,
        directConsumersSummary: {
          total: consumers.length,
          commentOnly: consumers.filter(c => c.commentOnly).length,
          testOnly: consumers.filter(c => c.testOnly).length,
        },
        priority,
        rationale,
      }
    })

  // ─── 构建最终报告 ───────────────────────────────────────────────────────────
  const report: GraphReport = {
    $schema: 'store-dependency-graph/v2',
    generatedAt: new Date().toISOString().split('T')[0]!,
    description: 'Store 依赖关系图谱 v2.1 - 由 generate-store-graph.ts 基于 audit-mapping-integrity.ts v2.2 export 函数生成；v2.1 区分"可删除 unused"与"待接入 pendingIntegration"，5 个核心业务 Store 归入 pendingIntegrationStores',
    source: 'scripts/generate-store-graph.ts (调用 audit-mapping-integrity.ts v2.2 export 函数)',
    stats: {
      totalStores: metas.length,
      usedStores: storesReport.filter(s => s.status === 'used').length,
      unusedStores: unusedStoresReport.length,
      pendingIntegrationStores: pendingIntegrationStoresReport.length,
      facadeStores: facades.length,
      storeToStoreEdges: storeToStoreEdges.length,
      transitivelyReachableViaFacade: diagnostics.transitiveOnly.length,
      directConsumersTotal: totalConsumers,
      bfsStartingPoints: diagnostics.startingPoints.length,
    },
    stores: storesReport,
    storeToStoreDependencies: {
      edges: storeToStoreEdges,
    },
    facadeStores: facades.map(f => ({
      name: f.fileName,
      file: f.filePath.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'),
      deprecated: f.deprecated,
      aggregates: f.aggregates,
      aggregateCount: f.aggregates.length,
    })),
    transitiveReachability: {
      bfsStartingPoints: diagnostics.startingPoints,
      reachableFromEachRoot: bfsRootsToReachable,
      allTransitivelyReachable: Array.from(reachable).sort(),
      transitiveOnly: diagnostics.transitiveOnly,
      traversalPath: diagnostics.traversalPath,
    },
    unusedStores: unusedStoresReport,
    pendingIntegrationStores: pendingIntegrationStoresReport,
    detectionRules: [
      {
        id: 'R1',
        name: '全目录搜索',
        description: '搜索 pages/components/apps/cockpit/hooks/portal/store/services/core/lib/agents/mcp 共 12 个目录',
      },
      {
        id: 'R2',
        name: '多模式导入检测',
        description: '支持绝对路径(@/store/X)、相对路径(./X, ../X)、hook名引用三种模式',
      },
      {
        id: 'R3',
        name: 'Store 间依赖图构建',
        description: '扫描 store/ 目录下所有 Store 文件的相对/绝对导入，建立有向依赖图',
      },
      {
        id: 'R4',
        name: '传递可达性分析',
        description: '从 UI 层直接消费的 Store 出发，沿 Store 间依赖图正向 BFS，所有可达 Store 标记为 used',
      },
      {
        id: 'R5',
        name: '注释过滤',
        description: '逐行解析时排除以 ///*/ 开头的行，避免注释中的 Store 名引用造成反向假阳性',
      },
      {
        id: 'R6',
        name: '测试文件识别',
        description: '仅 .test.ts/.test.tsx 文件中的引用标记为 testOnly，不计入 used 判定',
      },
      {
        id: 'R7',
        name: '业务定位区分（v2.1 新增）',
        description: '"未使用"≠"应删除"。已识别业务定位的 Store（rotationSignalStore/signalQualityStore/riskStore/analysisStore/chatStore）归入 pendingIntegrationStores，作为待 UI 接入的核心数据层，禁止删除',
      },
    ],
  }

  // ─── 写入文件 ───────────────────────────────────────────────────────────────
  console.log(`[写入] 输出文件: ${OUTPUT_FILE.replace(/\\/g, '/')}`)
  safeWriteFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2))

  console.log(`\n═══════════════════════════════════════════════════════════════`)
  console.log(`  生成完成`)
  console.log(`═══════════════════════════════════════════════════════════════`)
  console.log(`  总 Store 数:       ${report.stats.totalStores}`)
  console.log(`  used Store:        ${report.stats.usedStores}`)
  console.log(`  unused Store:      ${report.stats.unusedStores} (可删除候选)`)
  console.log(`  pendingIntegration: ${report.stats.pendingIntegrationStores} (待 UI 接入，禁止删除)`)
  console.log(`  Facade Store:      ${report.stats.facadeStores}`)
  console.log(`  Store 间依赖边:    ${report.stats.storeToStoreEdges}`)
  console.log(`  BFS 起点:          ${report.stats.bfsStartingPoints}`)
  console.log(`  传递可达 Store:    ${report.stats.transitivelyReachableViaFacade}`)
  console.log(`  直接消费者引用:    ${report.stats.directConsumersTotal}`)
  console.log(`\n  待接入 Store 优先级分布:`)
  const p0Count = pendingIntegrationStoresReport.filter(s => s.priority === 'P0').length
  const p1Count = pendingIntegrationStoresReport.filter(s => s.priority === 'P1').length
  const p2Count = pendingIntegrationStoresReport.filter(s => s.priority === 'P2').length
  console.log(`    P0 (资金安全):   ${p0Count}`)
  console.log(`    P1 (核心投研):   ${p1Count}`)
  console.log(`    P2 (辅助/规划):  ${p2Count}`)
  console.log(`═══════════════════════════════════════════════════════════════\n`)
}

/** 从文件路径提取层级名称 */
function extractLayer(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  // 匹配 src/开头的下一级目录（如 src/pages/、src/store/、src/services/）
  const match = normalized.match(/(?:^|\/)src\/([^/]+)\//)
  return match ? match[1]! : 'unknown'
}

/** 待接入 Store 的业务定位映射 */
const PENDING_INTEGRATION_META: Record<string, { businessDomain: string; mappedMetrics: string[]; integrationPlan: string }> = {
  rotationSignalStore: {
    businessDomain: '板块轮动分析',
    mappedMetrics: ['轮动因子得分', '板块强度排序', '轮动信号触发时机'],
    integrationPlan: '接入 SectorRotationHeatmap 组件，作为热点轮动图的底层数据源；同时在 IndustryScorePage 中展示轮动信号列表',
  },
  signalQualityStore: {
    businessDomain: '股票异常波动监测',
    mappedMetrics: ['信号可信度评分', '异常波动识别', '噪声过滤等级'],
    integrationPlan: '接入 WatchlistWidget 和 StockPoolWidget，对个股信号质量做分级展示；在 RiskMonitorWidget 中作为风险预警维度之一',
  },
  riskStore: {
    businessDomain: '持仓风控',
    mappedMetrics: ['持仓风险评分', '回撤风险', '集中度风险', '止损距离'],
    integrationPlan: '接入 RiskMonitorWidget（驾驶舱已存在组件骨架），作为风控面板的核心数据源；在 ExecutionPlanPanel 提交执行计划前展示风险预检结果',
  },
  analysisStore: {
    businessDomain: '分析数据聚合',
    mappedMetrics: ['V6 批量评分汇总', '个股分析列表', '分析加载状态'],
    integrationPlan: '在 AnalysisApp 重构时作为状态管理层接入，替代组件内直接调用 services（runV6Score/listStocks/listV6Scores）',
  },
  chatStore: {
    businessDomain: 'AI 投研对话',
    mappedMetrics: ['对话上下文', '消息历史', 'AI 模型选择状态'],
    integrationPlan: '接入未来的 AI 投研对话面板，作为对话上下文与消息历史的持久化层',
  },
}

/** 根据文件名给出处置建议（待 UI 接入，不删除） */
function suggestRemediation(fileName: string): string {
  const meta = PENDING_INTEGRATION_META[fileName]
  if (meta) {
    return `待 UI 接入 [${meta.businessDomain}] - ${meta.integrationPlan}`
  }
  return '待人工核查业务定位后规划 UI 接入路径（非删除候选）'
}

main()
