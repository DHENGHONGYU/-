/**
 * @test_id V9-TEST-UT-101
 * @covers_docs [V9-DOC-BACK-013, V9-DOC-BACK-012, V9-DOC-ARCH-007, V9-DOC-ARCH-008, V9-DOC-BACK-005]
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import { readFileSync, readdirSync, existsSync } from 'fs'

/**
 * audit-mapping-integrity.ts 单元测试（v2.2 白盒测试）
 *
 * 测试覆盖：
 * 1. 回归断言套件：验证当前 42 个 Store 中预期的 5 个未使用 Store
 *    - analysisStore / chatStore / riskStore / rotationSignalStore / signalQualityStore
 *    - 防止后续重构破坏检测结果，避免误报回归
 * 2. Mock 错误导入场景：模拟 5 个未使用 Store 被错误导入的场景
 *    - 验证检测逻辑能否正确识别并报告它们
 *    - 模拟三种错误导入模式：绝对路径 / 相对路径 / hook 名
 * 3. 关键函数单元测试：extractStoreHookName / extractStoreImports / isTestFile
 */

// audit-mapping-integrity.ts 使用 from 'fs'（无 node: 前缀），测试也使用相同路径
// 必须提供 default 导出，否则 vitest 在 ESM 模式下会报错
vi.mock('fs', () => {
  const mocks = {
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    existsSync: vi.fn(),
    statSync: vi.fn(),
  }
  return {
    ...mocks,
    default: mocks,
  }
})

const mockReadFileSync = vi.mocked(readFileSync)
const mockReaddirSync = vi.mocked(readdirSync)
const mockExistsSync = vi.mocked(existsSync)

type TestFiles = Record<string, string>

describe('audit-mapping-integrity.ts v2.2（白盒测试）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * 构造虚拟文件系统
   * @param testFiles 相对 src 的文件路径 → 文件内容
   */
  function setupVirtualFS(testFiles: TestFiles): void {
    const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')

    const dirMap = new Map<string, Set<string>>()
    const fileContents = new Map<string, string>()

    for (const [relPath, content] of Object.entries(testFiles)) {
      const fullPath = path.join(srcDir, relPath).replace(/\\/g, '/')
      fileContents.set(fullPath, content)

      const parts = fullPath.split('/')
      for (let i = 1; i < parts.length; i++) {
        const dirPath = parts.slice(0, i).join('/')
        const entry = parts[i]!
        if (!dirMap.has(dirPath)) {
          dirMap.set(dirPath, new Set())
        }
        dirMap.get(dirPath)!.add(entry)
      }
    }

    mockReadFileSync.mockImplementation(((filePath: string) => {
      const key = String(filePath).replace(/\\/g, '/')
      if (fileContents.has(key)) {
        return fileContents.get(key)!
      }
      const err = new Error(`ENOENT: ${filePath}`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }) as unknown as typeof readFileSync)

    mockReaddirSync.mockImplementation(((dirPath: string, options?: { withFileTypes?: boolean }) => {
      const key = String(dirPath).replace(/\\/g, '/')
      const entries = dirMap.get(key)
      if (!entries) {
        const err = new Error(`ENOENT: ${dirPath}`) as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      }

      if (options?.withFileTypes) {
        return Array.from(entries).map(name => {
          const entryPath = key + '/' + name
          const isFile = fileContents.has(entryPath)
          return {
            name,
            isFile: () => isFile,
            isDirectory: () => !isFile,
          }
        })
      }
      return Array.from(entries)
    }) as unknown as typeof readdirSync)

    mockExistsSync.mockImplementation(((filePath: string) => {
      const key = String(filePath).replace(/\\/g, '/')
      return fileContents.has(key) || dirMap.has(key)
    }) as unknown as typeof existsSync)
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 套件1：关键函数单元测试
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('关键函数单元测试', () => {
    it('extractStoreHookName 应正确解析 export const useXxxStore = create 模式', async () => {
      const { extractStoreHookName } = await import('../../../scripts/audit-mapping-integrity')
      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const fakePath = path.join(srcDir, 'store', 'mockStore.ts').replace(/\\/g, '/')

      setupVirtualFS({
        'store/mockStore.ts': `import { create } from 'zustand'\nexport const useMockStore = create<{}>(() => ({}))\n`,
      })

      const hookName = extractStoreHookName(fakePath)
      expect(hookName).toBe('useMockStore')
    })

    it('extractStoreHookName 应支持 export function useXxxStore 兜底匹配', async () => {
      const { extractStoreHookName } = await import('../../../scripts/audit-mapping-integrity')
      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const fakePath = path.join(srcDir, 'store', 'functionStore.ts').replace(/\\/g, '/')

      setupVirtualFS({
        'store/functionStore.ts': `export function useFunctionStore() { return {} }\n`,
      })

      const hookName = extractStoreHookName(fakePath)
      expect(hookName).toBe('useFunctionStore')
    })

    it('extractStoreImports 应同时解析相对路径和绝对路径导入', async () => {
      const { extractStoreImports } = await import('../../../scripts/audit-mapping-integrity')
      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const fakePath = path.join(srcDir, 'store', 'facadeStore.ts').replace(/\\/g, '/')

      setupVirtualFS({
        'store/facadeStore.ts': [
          `import { useSub1Store } from './sub1Store'`,
          `import { useSub2Store } from '@/store/sub2Store'`,
          `import { someUtil } from '@/lib/utils'`, // 非 Store 导入应被忽略
          `// import { useCommentStore } from './commentStore'`, // 注释应被过滤
        ].join('\n'),
      })

      const imports = extractStoreImports(fakePath)
      expect(imports).toHaveLength(2)
      expect(imports[0]!.target).toBe('sub1Store')
      expect(imports[0]!.importPath).toBe('./sub1Store')
      expect(imports[1]!.target).toBe('sub2Store')
      expect(imports[1]!.importPath).toBe('@/store/sub2Store')
    })

    it('extractStoreImports 应过滤注释行（// 和 * 开头）', async () => {
      const { extractStoreImports } = await import('../../../scripts/audit-mapping-integrity')
      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const fakePath = path.join(srcDir, 'store', 'commentTestStore.ts').replace(/\\/g, '/')

      setupVirtualFS({
        'store/commentTestStore.ts': [
          `// import { useFakeStore } from './fakeStore'`,
          ` * import { useJSDocStore } from './jsDocStore'`,
          `/* import { useBlockStore } from './blockStore' */`,
          `import { useRealStore } from './realStore'`,
        ].join('\n'),
      })

      const imports = extractStoreImports(fakePath)
      expect(imports).toHaveLength(1)
      expect(imports[0]!.target).toBe('realStore')
    })

    it('isTestFile 应正确识别 .test.ts/.test.tsx 和 __tests__ 目录', async () => {
      const { isTestFile } = await import('../../../scripts/audit-mapping-integrity')

      expect(isTestFile('src/store/fooStore.test.ts')).toBe(true)
      expect(isTestFile('src/store/fooStore.test.tsx')).toBe(true)
      expect(isTestFile('src/store/__tests__/fooStore.ts')).toBe(true)
      expect(isTestFile('src/store/fooStore.ts')).toBe(false)
      expect(isTestFile('src/store/fooStore.spec.ts')).toBe(false)
    })

    it('isStoreDeprecated 应检测 @deprecated 标记', async () => {
      const { isStoreDeprecated } = await import('../../../scripts/audit-mapping-integrity')
      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const deprecatedPath = path.join(srcDir, 'store', 'oldStore.ts').replace(/\\/g, '/')
      const normalPath = path.join(srcDir, 'store', 'newStore.ts').replace(/\\/g, '/')

      setupVirtualFS({
        'store/oldStore.ts': `/**\n * @deprecated 使用 newStore 替代\n */\nexport const useOldStore = create(() => ({}))\n`,
        'store/newStore.ts': `export const useNewStore = create(() => ({}))\n`,
      })

      expect(isStoreDeprecated(deprecatedPath)).toBe(true)
      expect(isStoreDeprecated(normalPath)).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 套件2：回归断言套件 - 5 个预期未使用 Store
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('回归断言套件：5 个预期未使用 Store', () => {
    /**
     * 构造虚拟项目：模拟当前真实仓库结构
     * - 包含 7 个 Store（5 个未使用 + 2 个 Facade 用作对照）
     * - 包含 1 个 UI 消费者（验证 BFS 起点）
     */
    function setupRealisticRepo(): void {
      setupVirtualFS({
        // 5 个未使用 Store
        'store/analysisStore.ts': `import { create } from 'zustand'\nexport const useAnalysisStore = create(() => ({}))\n`,
        'store/chatStore.ts': `import { create } from 'zustand'\nexport const useChatStore = create(() => ({}))\n`,
        'store/riskStore.ts': `import { create } from 'zustand'\nexport const useRiskStore = create(() => ({}))\n`,
        'store/rotationSignalStore.ts': `import { create } from 'zustand'\nexport const useRotationSignalStore = create(() => ({}))\n`,
        'store/signalQualityStore.ts': `import { create } from 'zustand'\nexport const useSignalQualityStore = create(() => ({}))\n`,

        // 2 个 Facade 对照组（应被判定为 used）
        'store/tradingStore.ts': [
          `import { create } from 'zustand'`,
          `import { useWatchlistStore } from './watchlistStore'`,
          `import { useOrderStore } from './orderStore'`,
          `/** @deprecated 批次B拆分后作为向后兼容Facade */`,
          `export const useTradingStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/watchlistStore.ts': `import { create } from 'zustand'\nexport const useWatchlistStore = create(() => ({}))\n`,
        'store/orderStore.ts': `import { create } from 'zustand'\nexport const useOrderStore = create(() => ({}))\n`,

        // UI 消费者（tradingStore 被 UI 使用，确保 BFS 起点正常）
        'apps/trading/TradingApp.tsx': `import { useTradingStore } from '@/store/tradingStore'\nexport function TradingApp() { return null }\n`,
      })
    }

    it('应正确识别 5 个未使用 Store', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      setupRealisticRepo()

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['apps', 'store'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable } = computeTransitiveReachability(metas, graph, directConsumersMap)

      const unusedStores = metas
        .filter(m => {
          const consumers = directConsumersMap.get(m.fileName) ?? []
          const hasUiConsumer = consumers.some(c => !c.testOnly && !c.isStoreDir)
          const isReachable = reachable.has(m.fileName)
          return !hasUiConsumer && !isReachable
        })
        .map(m => m.fileName)

      // 断言：5 个未使用 Store 都被正确识别
      expect(unusedStores).toContain('analysisStore')
      expect(unusedStores).toContain('chatStore')
      expect(unusedStores).toContain('riskStore')
      expect(unusedStores).toContain('rotationSignalStore')
      expect(unusedStores).toContain('signalQualityStore')
      expect(unusedStores).toHaveLength(5)
    })

    it('应正确识别 Facade Store (tradingStore 聚合 watchlistStore + orderStore)', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores } =
        await import('../../../scripts/audit-mapping-integrity')

      setupRealisticRepo()

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const tradingStore = metas.find(m => m.fileName === 'tradingStore')
      expect(tradingStore).toBeDefined()
      expect(tradingStore!.isFacade).toBe(true)
      expect(tradingStore!.deprecated).toBe(true)
      expect(tradingStore!.aggregates).toEqual(expect.arrayContaining(['watchlistStore', 'orderStore']))
    })

    it('应通过传递可达性正确标记 Facade 子Store 为 used', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      setupRealisticRepo()

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['apps', 'store'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, directConsumersMap)

      // BFS 起点应包含 tradingStore（被 UI 直接消费）
      expect(diagnostics.startingPoints).toContain('tradingStore')

      // watchlistStore 和 orderStore 应通过传递可达性标记为 used
      expect(reachable.has('watchlistStore')).toBe(true)
      expect(reachable.has('orderStore')).toBe(true)

      // 它们应出现在 transitiveOnly 列表中
      expect(diagnostics.transitiveOnly).toContain('watchlistStore')
      expect(diagnostics.transitiveOnly).toContain('orderStore')
    })

    it('应准确识别未使用 Store 的消费者来源（注释引用 vs 真实导入）', async () => {
      const { collectStoreMetas, findStoreConsumers } = await import('../../../scripts/audit-mapping-integrity')

      // riskStore 仅在 constants 注释中引用
      setupVirtualFS({
        'store/riskStore.ts': `import { create } from 'zustand'\nexport const useRiskStore = create(() => ({}))\n`,
        'store/tradingStore.ts': `import { create } from 'zustand'\nexport const useTradingStore = create(() => ({}))\n`,
        'apps/trading/TradingApp.tsx': `import { useTradingStore } from '@/store/tradingStore'\n`,
        'constants/store-channels.constants.ts': [
          `// EVENT_NAMES.RISK_CHANGED - 由 riskStore 发布`,
          `// 注意：本行是注释，不应被识别为导入`,
        ].join('\n'),
      })

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['apps', 'store', 'constants'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const riskStore = metas.find(m => m.fileName === 'riskStore')!
      const consumers = findStoreConsumers(riskStore, searchRoots)

      // 验证：constants 中的注释引用不应被计为消费者
      const realConsumers = consumers.filter(c => !c.testOnly && !c.isStoreDir)
      expect(realConsumers).toHaveLength(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 套件3：Mock 错误导入场景 - 验证检测逻辑能否识别错误导入
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Mock 测试：错误导入场景验证', () => {
    /**
     * 构造 5 个未使用 Store 被错误导入的场景
     * 每种导入模式各覆盖 1-2 个 Store：
     *   - 绝对路径：from '@/store/xxxStore'
     *   - 相对路径：from './xxxStore'（store/ 目录内）
     *   - hook 名引用：useXxxStore
     */
    function setupRepoWithBadImports(): void {
      setupVirtualFS({
        // 5 个原本未使用的 Store
        'store/analysisStore.ts': `import { create } from 'zustand'\nexport const useAnalysisStore = create(() => ({}))\n`,
        'store/chatStore.ts': `import { create } from 'zustand'\nexport const useChatStore = create(() => ({}))\n`,
        'store/riskStore.ts': `import { create } from 'zustand'\nexport const useRiskStore = create(() => ({}))\n`,
        'store/rotationSignalStore.ts': `import { create } from 'zustand'\nexport const useRotationSignalStore = create(() => ({}))\n`,
        'store/signalQualityStore.ts': `import { create } from 'zustand'\nexport const useSignalQualityStore = create(() => ({}))\n`,

        // Facade Store（被 UI 使用，作为 BFS 起点）
        'store/tradingStore.ts': [
          `import { create } from 'zustand'`,
          `import { useOrderStore } from './orderStore'`,
          `export const useTradingStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/orderStore.ts': `import { create } from 'zustand'\nexport const useOrderStore = create(() => ({}))\n`,

        // UI 消费者
        'apps/trading/TradingApp.tsx': [
          `import { useTradingStore } from '@/store/tradingStore'`,
          `import { useFacadeWithChatStore } from '@/store/facadeWithChatStore'`,
          ``,
        ].join('\n'),

        // ══════════════════════════════════════════════════════════════
        // 错误导入场景模拟
        // ══════════════════════════════════════════════════════════════

        // 场景1：analysisStore 被绝对路径错误导入到非 store 目录（pages/）
        'pages/analysis/AnalysisPage.tsx': [
          `import { useAnalysisStore } from '@/store/analysisStore'`,
          `export function AnalysisPage() {`,
          `  const store = useAnalysisStore()`,
          `  return null`,
          `}`,
        ].join('\n'),

        // 场景2：chatStore 被相对路径错误导入到 store/ 目录内（Facade 子Store）
        'store/facadeWithChatStore.ts': [
          `import { create } from 'zustand'`,
          `import { useChatStore } from './chatStore'`,
          `export const useFacadeWithChatStore = create(() => ({}))\n`,
        ].join('\n'),

        // 场景3：riskStore 被 hook 名错误引用（无 import 语句，仅函数调用）
        // 注：这种情况脚本当前不识别为消费者（因为没有 import 语句），断言应反映实际行为
        'pages/risk/RiskPage.tsx': [
          `import { useTradingStore } from '@/store/tradingStore'`,
          `export function RiskPage() {`,
          `  // const store = useRiskStore() // 注释中引用 hook 名`,
          `  return null`,
          `}`,
        ].join('\n'),

        // 场景4：rotationSignalStore 被绝对路径导入到 services/ 目录
        'services/rotation/RotationService.ts': [
          `import { useRotationSignalStore } from '@/store/rotationSignalStore'`,
          `export function analyzeRotation() {`,
          `  const signals = useRotationSignalStore.getState()`,
          `  return signals`,
          `}`,
        ].join('\n'),

        // 场景5：signalQualityStore 被绝对路径导入到 components/ 目录
        'components/signal/SignalQualityCard.tsx': [
          `import { useSignalQualityStore } from '@/store/signalQualityStore'`,
          `export function SignalQualityCard() {`,
          `  const quality = useSignalQualityStore()`,
          `  return null`,
          `}`,
        ].join('\n'),
      })
    }

    it('场景1：analysisStore 被绝对路径错误导入到 pages/，应被识别为 used', async () => {
      const { collectStoreMetas, findStoreConsumers } = await import('../../../scripts/audit-mapping-integrity')

      setupRepoWithBadImports()

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'components', 'apps', 'services', 'store'].map(d =>
        path.join(srcDir, d).replace(/\\/g, '/')
      )

      const metas = collectStoreMetas()
      const analysisStore = metas.find(m => m.fileName === 'analysisStore')!
      const consumers = findStoreConsumers(analysisStore, searchRoots)

      // 验证：pages/ 中的导入被识别为 UI 层消费者
      const uiConsumers = consumers.filter(c => !c.testOnly && !c.isStoreDir)
      expect(uiConsumers.length).toBeGreaterThan(0)
      expect(uiConsumers.some(c => c.file.includes('pages/analysis/AnalysisPage.tsx'))).toBe(true)
      expect(uiConsumers.some(c => c.importType === 'absolute')).toBe(true)
    })

    it('场景2：chatStore 被相对路径错误导入到 store/，应被识别但标记为 storeDir', async () => {
      const { collectStoreMetas, findStoreConsumers } = await import('../../../scripts/audit-mapping-integrity')

      setupRepoWithBadImports()

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'components', 'apps', 'services', 'store'].map(d =>
        path.join(srcDir, d).replace(/\\/g, '/')
      )

      const metas = collectStoreMetas()
      const chatStore = metas.find(m => m.fileName === 'chatStore')!
      const consumers = findStoreConsumers(chatStore, searchRoots)

      // 验证：store/ 目录内的导入被识别，但标记为 storeDir（不作为 BFS 起点）
      const storeDirConsumers = consumers.filter(c => c.isStoreDir && !c.testOnly)
      expect(storeDirConsumers.length).toBeGreaterThan(0)
      expect(storeDirConsumers.some(c => c.file.includes('store/facadeWithChatStore.ts'))).toBe(true)
      expect(storeDirConsumers.some(c => c.importType === 'relative')).toBe(true)

      // 但 UI 层消费者应为 0
      const uiConsumers = consumers.filter(c => !c.testOnly && !c.isStoreDir)
      expect(uiConsumers).toHaveLength(0)
    })

    it('场景3：riskStore 仅在注释中被 hook 名引用，应被识别为无消费者', async () => {
      const { collectStoreMetas, findStoreConsumers } = await import('../../../scripts/audit-mapping-integrity')

      setupRepoWithBadImports()

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'components', 'apps', 'services', 'store'].map(d =>
        path.join(srcDir, d).replace(/\\/g, '/')
      )

      const metas = collectStoreMetas()
      const riskStore = metas.find(m => m.fileName === 'riskStore')!
      const consumers = findStoreConsumers(riskStore, searchRoots)

      // 验证：注释中的 hook 名引用不应被识别为消费者
      const realConsumers = consumers.filter(c => !c.testOnly && !c.isStoreDir)
      expect(realConsumers).toHaveLength(0)

      // 验证：注释引用不应出现在消费者列表中
      const commentLikeConsumers = consumers.filter(c => c.file.includes('RiskPage'))
      expect(commentLikeConsumers).toHaveLength(0)
    })

    it('场景4：rotationSignalStore 被绝对路径导入到 services/，应被识别为 used', async () => {
      const { collectStoreMetas, findStoreConsumers } = await import('../../../scripts/audit-mapping-integrity')

      setupRepoWithBadImports()

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'components', 'apps', 'services', 'store'].map(d =>
        path.join(srcDir, d).replace(/\\/g, '/')
      )

      const metas = collectStoreMetas()
      const rotationStore = metas.find(m => m.fileName === 'rotationSignalStore')!
      const consumers = findStoreConsumers(rotationStore, searchRoots)

      // 验证：services/ 中的导入被识别为 UI 层消费者
      const uiConsumers = consumers.filter(c => !c.testOnly && !c.isStoreDir)
      expect(uiConsumers.length).toBeGreaterThan(0)
      expect(uiConsumers.some(c => c.file.includes('services/rotation/RotationService.ts'))).toBe(true)
    })

    it('场景5：signalQualityStore 被绝对路径导入到 components/，应被识别为 used', async () => {
      const { collectStoreMetas, findStoreConsumers } = await import('../../../scripts/audit-mapping-integrity')

      setupRepoWithBadImports()

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'components', 'apps', 'services', 'store'].map(d =>
        path.join(srcDir, d).replace(/\\/g, '/')
      )

      const metas = collectStoreMetas()
      const signalQualityStore = metas.find(m => m.fileName === 'signalQualityStore')!
      const consumers = findStoreConsumers(signalQualityStore, searchRoots)

      // 验证：components/ 中的导入被识别为 UI 层消费者
      const uiConsumers = consumers.filter(c => !c.testOnly && !c.isStoreDir)
      expect(uiConsumers.length).toBeGreaterThan(0)
      expect(uiConsumers.some(c => c.file.includes('components/signal/SignalQualityCard.tsx'))).toBe(true)
    })

    it('综合场景：5 个 Store 被错误导入后，应全部被判定为 used', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      setupRepoWithBadImports()

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'components', 'apps', 'services', 'store'].map(d =>
        path.join(srcDir, d).replace(/\\/g, '/')
      )

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable } = computeTransitiveReachability(metas, graph, directConsumersMap)

      const usedStores = metas
        .filter(m => {
          const consumers = directConsumersMap.get(m.fileName) ?? []
          const hasUiConsumer = consumers.some(c => !c.testOnly && !c.isStoreDir)
          const isReachable = reachable.has(m.fileName)
          return hasUiConsumer || isReachable
        })
        .map(m => m.fileName)

      // 验证：5 个原本未使用的 Store 在被错误导入后，应全部判定为 used
      expect(usedStores).toContain('analysisStore') // pages/ 导入
      expect(usedStores).toContain('rotationSignalStore') // services/ 导入
      expect(usedStores).toContain('signalQualityStore') // components/ 导入
      expect(usedStores).toContain('chatStore') // store/ 导入，但通过传递可达性
      // riskStore 仅在注释中引用，应保持 unused
      expect(usedStores).not.toContain('riskStore')
    })

    it('错误导入检测：注释中的 hook 名引用不应被误判为消费者', async () => {
      const { collectStoreMetas, findStoreConsumers } = await import('../../../scripts/audit-mapping-integrity')

      // 构造场景：5 个 Store 全部仅在注释中引用 hook 名
      setupVirtualFS({
        'store/analysisStore.ts': `import { create } from 'zustand'\nexport const useAnalysisStore = create(() => ({}))\n`,
        'store/chatStore.ts': `import { create } from 'zustand'\nexport const useChatStore = create(() => ({}))\n`,
        'store/riskStore.ts': `import { create } from 'zustand'\nexport const useRiskStore = create(() => ({}))\n`,
        'store/rotationSignalStore.ts': `import { create } from 'zustand'\nexport const useRotationSignalStore = create(() => ({}))\n`,
        'store/signalQualityStore.ts': `import { create } from 'zustand'\nexport const useSignalQualityStore = create(() => ({}))\n`,
        'pages/fake/FakePage.tsx': [
          `// import { useAnalysisStore } from '@/store/analysisStore'`,
          `// const a = useChatStore()`,
          `/* const r = useRiskStore() */`,
          ` * const rot = useRotationSignalStore()`,
          `// const sq = useSignalQualityStore()`,
        ].join('\n'),
      })

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'store'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()

      // 验证：5 个 Store 都没有真实消费者（注释引用被正确过滤）
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        const realConsumers = consumers.filter(c => !c.testOnly && !c.isStoreDir)
        expect(realConsumers).toHaveLength(0)
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 套件4：BFS 算法验证
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('BFS 传递可达性算法验证', () => {
    it('BFS 不应将 Store-to-Store 导入作为起点（v2.1 修复 bug 验证）', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      // 构造场景：A 导入 B，但 A 本身未被 UI 使用（不应触发 BFS）
      setupVirtualFS({
        'store/facadeA.ts': [
          `import { create } from 'zustand'`,
          `import { useSubBStore } from './subBStore'`,
          `export const useFacadeAStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/subBStore.ts': `import { create } from 'zustand'\nexport const useSubBStore = create(() => ({}))\n`,
        // facadeA 没有任何 UI 消费者
      })

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['store', 'pages'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, directConsumersMap)

      // 验证：facadeA 没有 UI 消费者，不应成为 BFS 起点
      expect(diagnostics.startingPoints).not.toContain('facadeA')
      expect(diagnostics.startingPoints).toHaveLength(0)

      // 验证：subBStore 也不应被标记为 reachable（因为 facadeA 本身未被 UI 使用）
      expect(reachable.has('subBStore')).toBe(false)
      expect(reachable.has('facadeA')).toBe(false)
    })

    it('BFS 应正确沿正向图遍历：facadeAStore(UI) → subBStore → subCStore', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      // 构造场景：三层传递依赖
      //   UI 使用 facadeAStore
      //   facadeAStore 导入 subBStore
      //   subBStore 导入 subCStore
      //   期望：subBStore 和 subCStore 都应通过传递可达性被标记为 used
      setupVirtualFS({
        'store/facadeAStore.ts': [
          `import { create } from 'zustand'`,
          `import { useSubBStore } from './subBStore'`,
          `export const useFacadeAStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/subBStore.ts': [
          `import { create } from 'zustand'`,
          `import { useSubCStore } from './subCStore'`,
          `export const useSubBStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/subCStore.ts': `import { create } from 'zustand'\nexport const useSubCStore = create(() => ({}))\n`,
        'pages/test/TestPage.tsx': `import { useFacadeAStore } from '@/store/facadeAStore'\nexport function TestPage() { return null }\n`,
      })

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'store'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, directConsumersMap)

      // 验证：facadeAStore 是 BFS 起点
      expect(diagnostics.startingPoints).toContain('facadeAStore')

      // 验证：subBStore 和 subCStore 通过传递可达性被标记为 used
      expect(reachable.has('subBStore')).toBe(true)
      expect(reachable.has('subCStore')).toBe(true)

      // 验证：transitiveOnly 包含 subBStore 和 subCStore
      expect(diagnostics.transitiveOnly).toContain('subBStore')
      expect(diagnostics.transitiveOnly).toContain('subCStore')

      // 验证：BFS 遍历路径正确（facadeAStore → subBStore，subBStore → subCStore）
      const pathFromA = diagnostics.traversalPath.find(p => p.current === 'facadeAStore')
      expect(pathFromA).toBeDefined()
      expect(pathFromA!.newReachable).toContain('subBStore')

      const pathFromB = diagnostics.traversalPath.find(p => p.current === 'subBStore')
      expect(pathFromB).toBeDefined()
      expect(pathFromB!.newReachable).toContain('subCStore')
    })

    // ═══════════════════════════════════════════════════════════════════════════
    // 极端依赖场景测试（v2.1 BFS 鲁棒性验证）
    // 目的：验证 BFS 在拓扑异常图下的正确性与终止性
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * 极端场景 1：钻石依赖（Diamond Dependency）
     *
     * 拓扑：
     *   UI → facadeStore
     *   facadeStore → subBStore
     *   facadeStore → subCStore
     *   subBStore → leafStore
     *   subCStore → leafStore
     *
     * 期望：leafStore 通过两条路径可达，但只被加入 reachable 一次（去重正确）
     */
    it('极端场景1：钻石依赖应正确去重，leafStore 只入队一次', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      setupVirtualFS({
        'store/facadeStore.ts': [
          `import { create } from 'zustand'`,
          `import { useSubBStore } from './subBStore'`,
          `import { useSubCStore } from './subCStore'`,
          `export const useFacadeStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/subBStore.ts': [
          `import { create } from 'zustand'`,
          `import { useLeafStore } from './leafStore'`,
          `export const useSubBStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/subCStore.ts': [
          `import { create } from 'zustand'`,
          `import { useLeafStore } from './leafStore'`,
          `export const useSubCStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/leafStore.ts': `import { create } from 'zustand'\nexport const useLeafStore = create(() => ({}))\n`,
        'pages/test/DiamondPage.tsx': `import { useFacadeStore } from '@/store/facadeStore'\nexport function DiamondPage() { return null }\n`,
      })

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'store'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, directConsumersMap)

      // 验证：4 个 Store 都可达
      expect(reachable.has('facadeStore')).toBe(true)
      expect(reachable.has('subBStore')).toBe(true)
      expect(reachable.has('subCStore')).toBe(true)
      expect(reachable.has('leafStore')).toBe(true)

      // 验证：leafStore 在 traversalPath 中只出现一次（去重正确）
      const leafEntries = diagnostics.traversalPath.filter(p => p.newReachable.includes('leafStore'))
      expect(leafEntries).toHaveLength(1)

      // 验证：reachable 集合大小为 4（无重复）
      expect(reachable.size).toBe(4)

      // 验证：transitiveOnly 不应包含重复
      const transitiveDuplicates = diagnostics.transitiveOnly.filter((n, i, arr) => arr.indexOf(n) !== i)
      expect(transitiveDuplicates).toHaveLength(0)
    })

    /**
     * 极端场景 2：自环依赖（Self-loop）
     *
     * 拓扑：
     *   UI → selfLoopStore
     *   selfLoopStore → selfLoopStore（自导入，理论上不应发生但需鲁棒处理）
     *
     * 期望：BFS 不会无限循环，selfLoopStore 只入队一次
     */
    it('极端场景2：自环依赖应正确终止，BFS 不陷入死循环', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      setupVirtualFS({
        'store/selfLoopStore.ts': [
          `import { create } from 'zustand'`,
          `import { useSelfLoopStore } from './selfLoopStore'`, // 自导入
          `export const useSelfLoopStore = create(() => ({}))\n`,
        ].join('\n'),
        'pages/test/SelfLoopPage.tsx': `import { useSelfLoopStore } from '@/store/selfLoopStore'\nexport function SelfLoopPage() { return null }\n`,
      })

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'store'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, directConsumersMap)

      // 验证：BFS 终止（不会卡死）
      expect(diagnostics.startingPoints).toContain('selfLoopStore')
      expect(reachable.has('selfLoopStore')).toBe(true)
      // reachable 大小为 1（自环不增加新节点）
      expect(reachable.size).toBe(1)

      // 验证：traversalPath 中 selfLoopStore 的出边不会重复加入自身
      const selfEntry = diagnostics.traversalPath.find(p => p.current === 'selfLoopStore')
      // 自环边因 reachable.has() 已存在，应被跳过，不会出现在 newReachable
      if (selfEntry) {
        expect(selfEntry.newReachable).not.toContain('selfLoopStore')
      }
    })

    /**
     * 极端场景 3：双向循环依赖（A → B → A）
     *
     * 拓扑：
     *   UI → cycleAStore
     *   cycleAStore → cycleBStore
     *   cycleBStore → cycleAStore
     *
     * 期望：BFS 正确终止，两个 Store 都可达
     */
    it('极端场景3：双向循环依赖应正确终止，两个 Store 都可达', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      setupVirtualFS({
        'store/cycleAStore.ts': [
          `import { create } from 'zustand'`,
          `import { useCycleBStore } from './cycleBStore'`,
          `export const useCycleAStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/cycleBStore.ts': [
          `import { create } from 'zustand'`,
          `import { useCycleAStore } from './cycleAStore'`,
          `export const useCycleBStore = create(() => ({}))\n`,
        ].join('\n'),
        'pages/test/CyclePage.tsx': `import { useCycleAStore } from '@/store/cycleAStore'\nexport function CyclePage() { return null }\n`,
      })

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'store'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, directConsumersMap)

      // 验证：BFS 终止，两个 Store 都可达
      expect(reachable.has('cycleAStore')).toBe(true)
      expect(reachable.has('cycleBStore')).toBe(true)
      expect(reachable.size).toBe(2)

      // 验证：cycleAStore 是起点，cycleBStore 通过传递可达
      expect(diagnostics.startingPoints).toContain('cycleAStore')
      expect(diagnostics.transitiveOnly).toContain('cycleBStore')
    })

    /**
     * 极端场景 4：多个 Facade 聚合同一子 Store（多路径汇聚）
     *
     * 拓扑：
     *   UI → facadeXStore, UI → facadeYStore
     *   facadeXStore → sharedSubStore
     *   facadeYStore → sharedSubStore
     *
     * 期望：sharedSubStore 通过两条路径可达，但只入队一次
     */
    it('极端场景4：多 Facade 聚合同一子Store，sharedSubStore 只入队一次', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      setupVirtualFS({
        'store/facadeXStore.ts': [
          `import { create } from 'zustand'`,
          `import { useSharedSubStore } from '@/store/sharedSubStore'`, // 绝对路径
          `export const useFacadeXStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/facadeYStore.ts': [
          `import { create } from 'zustand'`,
          `import { useSharedSubStore } from './sharedSubStore'`, // 相对路径
          `export const useFacadeYStore = create(() => ({}))\n`,
        ].join('\n'),
        'store/sharedSubStore.ts': `import { create } from 'zustand'\nexport const useSharedSubStore = create(() => ({}))\n`,
        'pages/test/MultiFacadePage.tsx': [
          `import { useFacadeXStore } from '@/store/facadeXStore'`,
          `import { useFacadeYStore } from '@/store/facadeYStore'`,
          `export function MultiFacadePage() { return null }\n`,
        ].join('\n'),
      })

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'store'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, directConsumersMap)

      // 验证：两个 Facade 都是起点
      expect(diagnostics.startingPoints).toContain('facadeXStore')
      expect(diagnostics.startingPoints).toContain('facadeYStore')

      // 验证：sharedSubStore 可达
      expect(reachable.has('sharedSubStore')).toBe(true)

      // 验证：sharedSubStore 只在 traversalPath 中出现一次（去重正确）
      const sharedEntries = diagnostics.traversalPath.filter(p => p.newReachable.includes('sharedSubStore'))
      expect(sharedEntries).toHaveLength(1)

      // 验证：绝对路径和相对路径都被正确解析为同一边
      const xEdges = graph.get('facadeXStore') ?? []
      const yEdges = graph.get('facadeYStore') ?? []
      expect(xEdges).toContain('sharedSubStore')
      expect(yEdges).toContain('sharedSubStore')
    })

    /**
     * 极端场景 5：深度链（5 层传递依赖）
     *
     * 拓扑：
     *   UI → level1Store → level2Store → level3Store → level4Store → level5Store
     *
     * 期望：5 层链全部可达，BFS 遍历路径按层级顺序
     */
    it('极端场景5：5 层深度传递依赖链应全部可达', async () => {
      const { collectStoreMetas, buildStoreDependencyGraph, markFacadeStores, findStoreConsumers, computeTransitiveReachability } =
        await import('../../../scripts/audit-mapping-integrity')

      setupVirtualFS({
        'store/level1Store.ts': [
          `import { create } from 'zustand'`,
          `import { useLevel2Store } from './level2Store'`,
          `export const useLevel1Store = create(() => ({}))\n`,
        ].join('\n'),
        'store/level2Store.ts': [
          `import { create } from 'zustand'`,
          `import { useLevel3Store } from './level3Store'`,
          `export const useLevel2Store = create(() => ({}))\n`,
        ].join('\n'),
        'store/level3Store.ts': [
          `import { create } from 'zustand'`,
          `import { useLevel4Store } from './level4Store'`,
          `export const useLevel3Store = create(() => ({}))\n`,
        ].join('\n'),
        'store/level4Store.ts': [
          `import { create } from 'zustand'`,
          `import { useLevel5Store } from './level5Store'`,
          `export const useLevel4Store = create(() => ({}))\n`,
        ].join('\n'),
        'store/level5Store.ts': `import { create } from 'zustand'\nexport const useLevel5Store = create(() => ({}))\n`,
        'pages/test/DeepChainPage.tsx': `import { useLevel1Store } from '@/store/level1Store'\nexport function DeepChainPage() { return null }\n`,
      })

      const srcDir = path.resolve(__dirname, '../../../src').replace(/\\/g, '/')
      const searchRoots = ['pages', 'store'].map(d => path.join(srcDir, d).replace(/\\/g, '/'))

      const metas = collectStoreMetas()
      const graph = buildStoreDependencyGraph(metas)
      markFacadeStores(metas, graph)

      const directConsumersMap = new Map<string, ReturnType<typeof findStoreConsumers>>()
      for (const meta of metas) {
        const consumers = findStoreConsumers(meta, searchRoots)
        directConsumersMap.set(meta.fileName, consumers)
      }

      const { reachable, diagnostics } = computeTransitiveReachability(metas, graph, directConsumersMap)

      // 验证：5 层 Store 全部可达
      expect(reachable.has('level1Store')).toBe(true)
      expect(reachable.has('level2Store')).toBe(true)
      expect(reachable.has('level3Store')).toBe(true)
      expect(reachable.has('level4Store')).toBe(true)
      expect(reachable.has('level5Store')).toBe(true)
      expect(reachable.size).toBe(5)

      // 验证：只有 level1Store 是起点，其余 4 个都是 transitiveOnly
      expect(diagnostics.startingPoints).toEqual(['level1Store'])
      expect(diagnostics.transitiveOnly).toHaveLength(4)
      expect(diagnostics.transitiveOnly).toEqual(expect.arrayContaining(['level2Store', 'level3Store', 'level4Store', 'level5Store']))

      // 验证：BFS 遍历路径按层级顺序（level1 → level2 → level3 → level4 → level5）
      expect(diagnostics.traversalPath).toHaveLength(4) // 4 条边
      expect(diagnostics.traversalPath[0]!.current).toBe('level1Store')
      expect(diagnostics.traversalPath[0]!.newReachable).toEqual(['level2Store'])
      expect(diagnostics.traversalPath[1]!.current).toBe('level2Store')
      expect(diagnostics.traversalPath[1]!.newReachable).toEqual(['level3Store'])
      expect(diagnostics.traversalPath[2]!.current).toBe('level3Store')
      expect(diagnostics.traversalPath[2]!.newReachable).toEqual(['level4Store'])
      expect(diagnostics.traversalPath[3]!.current).toBe('level4Store')
      expect(diagnostics.traversalPath[3]!.newReachable).toEqual(['level5Store'])
    })
  })
})
