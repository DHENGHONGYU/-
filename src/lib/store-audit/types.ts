/**
 * Store 依赖分析模块 - 类型定义
 *
 * @module @/lib/store-audit/types
 * @since 2026-07-07
 * @compliance AGENTS.md §一 lib/ 层零依赖约束（纯类型定义，无运行时依赖）
 *
 * 本模块定义 Store 依赖分析所需的全部数据结构，包括：
 *   - StoreMeta：Store 文件元信息
 *   - ConsumerRef：消费者引用记录
 *   - StoreNode：综合状态节点
 *   - BfsDiagnostics：BFS 诊断信息
 *
 * 这些类型被 scripts/audit-mapping-integrity.ts 和 lib/store-audit/analyzer.ts 共享，
 * 确保 Store 依赖分析算法与审计脚本之间的类型契约一致。
 */

/**
 * Store 文件元信息
 */
export interface StoreMeta {
  /** Store 文件名（不含扩展名），如 tradingStore */
  fileName: string
  /** Store 绝对路径 */
  filePath: string
  /** 导出的 hook 名，如 useTradingStore（从源码解析） */
  hookName: string | null
  /** 是否被标记为 @deprecated */
  deprecated: boolean
  /** 是否为 Facade（聚合其他 Store） */
  isFacade: boolean
  /** Facade 聚合的子 Store 列表 */
  aggregates: string[]
}

/**
 * 消费者引用记录
 *
 * 记录某个 Store 在哪个文件、哪一行被引用，以及引用的分类信息。
 * 分类字段（testOnly/isStoreDir/importType）用于 BFS 起点判定和状态判定。
 */
export interface ConsumerRef {
  /** 消费文件路径（相对项目根） */
  file: string
  /** 行号 */
  line: number
  /** 导入类型 */
  importType: 'absolute' | 'relative' | 'hookname' | 'type'
  /** 是否仅在测试文件中引用 */
  testOnly: boolean
  /** 是否为注释引用（非实际导入） */
  commentOnly: boolean
  /**
   * 是否为 store/ 目录内的消费者（Store-to-Store 导入）。
   *
   * v2.1 新增：用于区分 UI 层直接消费者与 Store 层传递消费者。
   * BFS 起点判定仅使用 isStoreDir=false 的消费者。
   *
   * 修复前的 Bug：findStoreConsumers 搜索范围包含 store/ 目录，
   * 导致 Store-to-Store 导入被计为"直接消费者"。当 Store B 仅被
   * Store A 导入时，B 会被错误地加入 BFS 起点队列，被标记为 used
   * （假阳性），即使 Store A 本身未被 UI 使用。
   */
  isStoreDir: boolean
  /** 若通过 Facade 间接使用，记录 Facade Store 名 */
  viaFacade?: string
}

/**
 * Store 综合状态节点
 */
export interface StoreNode {
  meta: StoreMeta
  /** 直接消费者（UI/Services/Core 等非 Store 层） */
  directConsumers: ConsumerRef[]
  /** Store 间依赖（其他 Store 通过相对路径导入此 Store） */
  storeConsumers: string[]
  /** 综合状态 */
  status: 'used' | 'unused' | 'unknown'
  /** 是否通过传递可达性标记为 used */
  transitivelyReachable: boolean
}

/**
 * BFS 诊断信息
 *
 * v2.1 新增：返回 BFS 起点清单和遍历路径，用于 --verbose 输出。
 * 帮助排查"应成为起点却未成为"的污染传播场景。
 */
export interface BfsDiagnostics {
  /** BFS 起点列表（有 UI 层直接消费者的 Store） */
  startingPoints: string[]
  /** BFS 遍历路径（按出队顺序记录，每条记录含 current 与新加入的 reachable） */
  traversalPath: Array<{ current: string; newReachable: string[] }>
  /** 通过传递可达性标记的 Store（非起点，仅通过 Facade 传递） */
  transitiveOnly: string[]
}
