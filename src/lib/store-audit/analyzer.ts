/**
 * Store 依赖分析模块 - 纯算法实现
 *
 * @module @/lib/store-audit/analyzer
 * @since 2026-07-07
 * @compliance AGENTS.md §一 lib/ 层零依赖约束（纯函数，无文件系统/网络/IO 依赖）
 *
 * 本模块包含 Store 依赖分析的核心算法，全部为纯函数：
 *   - computeTransitiveReachability：基于 BFS 的传递可达性分析
 *   - markFacadeStores：标记 Facade Store（聚合其他 Store 的 Store）
 *   - isTestFile：判断文件是否为测试文件
 *   - classifyConsumers：分类统计消费者（UI/Store层/测试）
 *
 * 设计原则：
 *   1. 纯函数：所有数据通过参数传入，无副作用（markFacadeStores 除外，按引用修改 metas，与原脚本保持一致）
 *   2. 零 IO 依赖：不读取文件系统、不访问网络，可在任何环境（浏览器/Node/Worker）运行
 *   3. 可测试：每个函数都有明确的输入输出契约，支持单元测试
 *   4. 可复用：算法与具体的文件系统实现解耦，其他项目可复用
 *
 * 与 scripts/audit-mapping-integrity.ts 的关系：
 *   - 脚本负责文件系统访问（collectStoreMetas/buildStoreDependencyGraph/findStoreConsumers）
 *   - 本模块负责纯算法计算（BFS/Facade 标记/分类统计）
 *   - 脚本通过 import 从本模块获取算法实现，避免代码重复
 */

import type { StoreMeta, ConsumerRef, BfsDiagnostics } from './types'

/**
 * 判断文件是否为测试文件
 *
 * 规则：文件名包含 .test.ts/.test.tsx，或路径包含 __tests__/ 目录
 *
 * @param filePath 文件路径
 * @returns 是否为测试文件
 */
export function isTestFile(filePath: string): boolean {
  return /\.test\.(ts|tsx)$/.test(filePath) || /__tests__[/\\]/.test(filePath)
}

/**
 * 标记 Facade Store：聚合了其他 Store 的 Store
 *
 * Facade 模式：一个 Store 导入了其他 Store（通过相对路径或绝对路径），
 * 将子 Store 的状态聚合并对外暴露。常见的 @deprecated 标注的 Store
 * 通常是 Facade，用于向后兼容。
 *
 * 注意：此函数按引用修改 metas（与原脚本保持一致），调用后 metas 中的
 * isFacade 和 aggregates 字段会被更新。
 *
 * @param metas Store 元信息数组（会被按引用修改）
 * @param graph Store 间依赖图（fileName → 它导入的 Store 列表）
 */
export function markFacadeStores(metas: StoreMeta[], graph: Map<string, string[]>): void {
  for (const meta of metas) {
    const deps = graph.get(meta.fileName) ?? []
    if (deps.length > 0) {
      meta.isFacade = true
      meta.aggregates = deps
    }
  }
}

/**
 * 计算传递可达性（BFS 算法）
 *
 * 算法原理：
 *   1. 起点：有 UI 层直接消费者的 Store（isStoreDir=false 且 testOnly=false）
 *   2. 遍历：沿 Store 间依赖图正向 BFS（current 导入了哪些 Store → 它们也可达）
 *   3. 结果：所有可达的 Store 标记为 used（transitivelyReachable = true）
 *
 * v2.1 关键修复 — BFS 起点判定：
 *   修复前：findStoreConsumers 搜索范围包含 store/ 目录，导致 Store-to-Store
 *   导入被计为"直接消费者"。当 Store B 仅被 Store A 导入时，B 会被错误地
 *   加入 BFS 起点队列，被标记为 used（假阳性），即使 Store A 本身未被 UI 使用。
 *
 *   修复后：仅 UI 层消费者（pages/components/apps/services 等非 store/ 目录）
 *   才作为 BFS 起点。Store-to-Store 导入仅用于 BFS 沿正向图遍历的边。
 *
 * 边界场景处理（已通过单元测试验证）：
 *   - 钻石依赖：leafStore 只入队一次（通过 reachable.has 去重）
 *   - 自环依赖：A→A，BFS 不会死循环（A 已在 reachable 中，跳过）
 *   - 双向循环：A→B→A，BFS 不会死循环（A/B 已在 reachable 中，跳过）
 *   - 多 Facade 聚合同一子 Store：多路径汇聚，子 Store 只入队一次
 *   - 5 层深度链：BFS 按层级顺序遍历，每层节点全部出队后才进入下一层
 *
 * @param metas Store 元信息数组
 * @param graph Store 间依赖图（fileName → 它导入的 Store 列表）
 * @param directConsumersMap 每个 Store 的直接消费者列表
 * @returns 可达 Store 集合 + BFS 诊断信息（起点、遍历路径、传递可达列表）
 */
export function computeTransitiveReachability(
  metas: StoreMeta[],
  graph: Map<string, string[]>,
  directConsumersMap: Map<string, ConsumerRef[]>
): { reachable: Set<string>; diagnostics: BfsDiagnostics } {
  const reachable = new Set<string>()
  const queue: string[] = []
  const startingPoints: string[] = []
  const traversalPath: Array<{ current: string; newReachable: string[] }> = []

  // BFS 起点：仅"有 UI 层直接消费者"的 Store
  // UI 层消费者定义：isStoreDir=false（非 store/ 目录）且 testOnly=false（非测试文件）
  for (const meta of metas) {
    const consumers = directConsumersMap.get(meta.fileName) ?? []
    const hasUiConsumer = consumers.some(c => !c.testOnly && !c.isStoreDir)

    if (hasUiConsumer) {
      reachable.add(meta.fileName)
      queue.push(meta.fileName)
      startingPoints.push(meta.fileName)
    }
  }

  // BFS：沿正向图遍历（current 导入了哪些 Store → 它们也可达）
  while (queue.length > 0) {
    const current = queue.shift()!
    const imports = graph.get(current) ?? [] // current 导入的 Store 列表

    const newReachable: string[] = []
    for (const imported of imports) {
      if (!reachable.has(imported)) {
        reachable.add(imported)
        queue.push(imported)
        newReachable.push(imported)
      }
    }
    if (newReachable.length > 0) {
      traversalPath.push({ current, newReachable })
    }
  }

  const transitiveOnly = Array.from(reachable).filter(name => !startingPoints.includes(name))

  return {
    reachable,
    diagnostics: { startingPoints, traversalPath, transitiveOnly },
  }
}

/**
 * 消费者分类统计
 *
 * 将消费者列表按 UI 层/Store 层/测试文件三类分类统计，
 * 用于状态判定和诊断日志。
 *
 * @param consumers 消费者列表
 * @returns 分类统计结果
 */
export function classifyConsumers(consumers: ConsumerRef[]): {
  /** UI 层消费者（非 store/ 目录、非测试文件） */
  ui: ConsumerRef[]
  /** Store 层消费者（store/ 目录内、非测试文件） */
  storeDir: ConsumerRef[]
  /** 测试文件消费者 */
  testOnly: ConsumerRef[]
  /** 是否有 UI 层消费者 */
  hasUiConsumer: boolean
} {
  const ui = consumers.filter(c => !c.testOnly && !c.isStoreDir)
  const storeDir = consumers.filter(c => c.isStoreDir && !c.testOnly)
  const testOnly = consumers.filter(c => c.testOnly)
  return {
    ui,
    storeDir,
    testOnly,
    hasUiConsumer: ui.length > 0,
  }
}
