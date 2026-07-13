/**
 * Store 依赖分析模块 - 公开 API
 *
 * @module @/lib/store-audit
 * @since 2026-07-07
 * @compliance AGENTS.md §一 lib/ 层零依赖约束
 *
 * 本模块提供 Store 依赖分析的核心算法和类型定义，可供以下场景复用：
 *   1. scripts/audit-mapping-integrity.ts 审计脚本
 *   2. 未来其他需要分析 Store 依赖关系的工具（如 VS Code 插件、CLI 工具）
 *   3. 单元测试（直接 import 纯算法函数进行测试）
 *
 * 使用示例：
 * ```typescript
 * import {
 *   computeTransitiveReachability,
 *   markFacadeStores,
 *   isTestFile,
 *   classifyConsumers,
 *   type StoreMeta,
 *   type ConsumerRef,
 * } from '@/lib/store-audit'
 *
 * // 构建 Store 元信息和依赖图（文件系统访问由调用方实现）
 * const metas: StoreMeta[] = collectStoreMetas() // 调用方实现
 * const graph = buildDependencyGraph(metas)       // 调用方实现
 * const directConsumersMap = findConsumers(metas) // 调用方实现
 *
 * // 标记 Facade Store（按引用修改 metas）
 * markFacadeStores(metas, graph)
 *
 * // 计算传递可达性
 * const { reachable, diagnostics } = computeTransitiveReachability(
 *   metas, graph, directConsumersMap
 * )
 *
 * // 输出诊断信息
 * console.log('BFS 起点:', diagnostics.startingPoints)
 * console.log('传递可达:', diagnostics.transitiveOnly)
 * console.log('全部可达:', Array.from(reachable))
 * ```
 *
 * 架构说明：
 *   - 本模块仅包含纯算法和类型定义，不依赖文件系统/网络/IO
 *   - 文件系统访问（collectStoreMetas/buildStoreDependencyGraph/findStoreConsumers）
 *     由调用方实现，本模块通过参数接收已构建的数据结构
 *   - 这种分离使算法可在任何环境运行（Node/浏览器/Worker），便于复用和测试
 */

// 类型导出
export type {
  StoreMeta,
  ConsumerRef,
  StoreNode,
  BfsDiagnostics,
} from './types'

// 算法函数导出
export {
  computeTransitiveReachability,
  markFacadeStores,
  isTestFile,
  classifyConsumers,
} from './analyzer'
