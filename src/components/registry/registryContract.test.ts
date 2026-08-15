/**
 * @test_id V9-TEST-REGISTRY-CONTRACT-001
 * @covers_docs []
 *
 * Registry 契约集成测试套件：
 *
 * 目的：保证 P0-2 标记为 @internal 的 12 个预留组件（Score 四卡 + 行业 v4 五卡）
 *      不被业务代码通过 `import { xxx } from '../index'` 直引，而必须通过
 *      `organismRegistry` + 动态 `import()` / registry 解析机制间接加载。
 *      一旦有人打破契约（<ScoreSnapshot /> 或 `from '@/components/cabin'`），
 *      这里就会报错并把他加入破约名单。
 *
 * 覆盖场景（5 个）：
 *   1. 预留 9 组件都必须在 organismRegistry 有声明（Registry 映射闭环）
 *   2. cabin/index.ts & chart/index.ts 不准把 @internal 组件加到命名 export
 *   3. 非 test / 非同目录子组件组合 不准出现 `import { <预留名> } from '...'` 静态 import
 *      - 允许例外 1: 同目录内部组合（IndustryV4Panel.tsx 引用 IndustryV4Radar/
 *        SubIndicatorBar 属父面板 + 子面板组合契约，不算泄露）
 *      - 允许例外 2: 所有 *.test.tsx / *.spec.ts（单测直引是被允许的）
 *   4. 非 test 不准出现 `<ScoreSnapshot/>, <IndustryV4Panel/>` 等 JSX 直引标签
 *   5. Industry V4 Panel 的 consumers = ["TBD - pending integration"] 表示尚未挂
 *      接入路由 / Widget，对应 organism 不应在 page / app 层出现任何引用
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { ORGANISM_REGISTRY } from './organismRegistry'

/** 项目根目录（d:\FinSightV9，兼容 Windows 盘符/正反斜杠） */
const PROJECT_ROOT = (() => {
  // 从本文件（src/components/registry/registryContract.test.ts）向上退三层到 src/..
  let p = dirname(__dirname) // src/components/registry -> src/components
  p = dirname(p) // src/components -> src
  p = dirname(p) // src -> 项目根
  return p
})()

/** 允许的 @internal 预留组件白名单（对齐 2026-08-13 P0-2 的 @internal 标记） */
const RESERVED_INTERNAL = [
  // Cabin 域评分四卡
  'ScoreSnapshot',
  'ScoreItem',
  'ScoreSummary',
  'ScoreHistoryTable',
  // Chart 域行业 v4 五卡
  'IndustryV4Panel',
  'IndustryV4Radar',
  'SubIndicatorBar',
  'TrendLineChart',
  'ValuationDistribution',
] as const
// type ReservedName = (typeof RESERVED_INTERNAL)[number]

/** 同目录父子组合允许例外：父面板 IndustryV4Panel 内部可直接引用 2 个子组件 */
const SAME_DIR_SIBLING_EXCEPTIONS: Record<string, Set<string>> = {
  'src/components/chart/industry/IndustryV4Panel.tsx': new Set(['IndustryV4Radar', 'SubIndicatorBar']),
}

const ALL_SRC_DIR = join(PROJECT_ROOT, 'src')

/**
 * 递归扫描 ts/tsx 文件（排除生成物和 node_modules），返回相对于 PROJECT_ROOT 的路径数组
 */
function listSourceFiles(dir: string, out: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }) as Array<{
    name: string
    isDirectory(): boolean
    isFile(): boolean
  }>
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      // 跳过 __snapshots__ / generated / 构建产物
      if (e.name === '__snapshots__' || e.name === 'generated' || e.name.startsWith('.')) continue
      listSourceFiles(full, out)
    } else if (e.isFile()) {
      if (/\.(ts|tsx)$/.test(e.name)) {
        out.push(full.slice(PROJECT_ROOT.length + 1).replace(/\\/g, '/'))
      }
    }
  }
  return out
}

describe('Registry Contract: @internal reserved components (9 个预留组件)', () => {
  it('1. 所有预留组件必须在 ORGANISM_REGISTRY 中声明（registry 映射闭环）', () => {
    const declaredNames = new Set(ORGANISM_REGISTRY.map((e) => e.name))
    const missing = RESERVED_INTERNAL.filter((n) => !declaredNames.has(n))
    expect(missing, `以下 @internal 组件未在 organismRegistry 登记: ${missing.join(', ')}`).toEqual([])
  })

  it("2. cabin/index.ts & chart/index.ts 不得把 @internal 组件列入命名 export", () => {
    const cabinIndexPath = join(PROJECT_ROOT, 'src/components/cabin/index.ts')
    const chartIndexPath = join(PROJECT_ROOT, 'src/components/chart/index.ts')
    for (const p of [cabinIndexPath, chartIndexPath]) {
      if (!existsSync(p)) continue
      const src = readFileSync(p, 'utf-8')
      const leaked = RESERVED_INTERNAL.filter((name) => {
        // 只 catch export { XXX } / export { XXX as YYY } 这种命名导出
        // 带 @internal 注释块是允许的（P0-2 治理时已加 JSDoc），但 export 语句里不准出现名字
        const exportStmtRegex = new RegExp(
          `export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`,
          'm',
        )
        return exportStmtRegex.test(src)
      })
      expect(
        leaked,
        `${basename(p)} 中发现 @internal 组件的对外导出: ${leaked.join(', ')}。这些组件应该只通过 organismRegistry 动态加载。`,
      ).toEqual([])
    }
  })

  it('3. 非 test/非同目录子组件组合，不得出现静态 import 预留组件', () => {
    const files = listSourceFiles(ALL_SRC_DIR)
    const violations: string[] = []

    for (const rel of files) {
      if (/\.(test|spec)\.(ts|tsx)$/.test(rel)) continue // 测试例外
      const abs = join(PROJECT_ROOT, rel)
      let src: string
      try {
        src = readFileSync(abs, 'utf-8')
      } catch {
        continue
      }

      for (const name of RESERVED_INTERNAL) {
        // import { ...Name } from '...' 静态 import
        const staticImportRegex = new RegExp(
          `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]`,
          'm',
        )
        if (!staticImportRegex.test(src)) continue

        // 检查例外 1：同目录父子组件组合
        const allowedSiblings = SAME_DIR_SIBLING_EXCEPTIONS[rel]
        if (allowedSiblings?.has(name)) continue

        violations.push(`${rel} 静态 import 了 @internal 组件 "${name}"（破约）`)
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('4. 非 test 文件，不得出现 JSX 直引：<ScoreSnapshot />, <IndustryV4Panel /> 等', () => {
    const files = listSourceFiles(ALL_SRC_DIR)
    const violations: string[] = []

    for (const rel of files) {
      if (/\.(test|spec)\.(ts|tsx)$/.test(rel)) continue
      const abs = join(PROJECT_ROOT, rel)
      let src: string
      try {
        src = readFileSync(abs, 'utf-8')
      } catch {
        continue
      }
      // 例外 1：父面板内部组合（IndustryV4Panel.tsx 内部允许直引 IndustryV4Radar / SubIndicatorBar）
      const jsxAllowed = SAME_DIR_SIBLING_EXCEPTIONS[rel] ?? new Set<string>()

      for (const name of RESERVED_INTERNAL) {
        if (jsxAllowed.has(name)) continue
        // JSX 标签：<Name ...> / <Name/> （含大小写精确匹配）
        const jsxRegex = new RegExp(`<${name}(\\s|\\/|>)`, 'm')
        if (jsxRegex.test(src)) {
          violations.push(`${rel} 存在 JSX 直引 @internal 组件 <${name}>`)
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('5. Industry V4 的 consumers=TBD/pending-integration，不应在 page/app 层出现任何引用', () => {
    const pendingNames = ORGANISM_REGISTRY
      .filter((e) => (e.consumers ?? []).every((c) => c.startsWith('TBD') || c.includes('pending')))
      .map((e) => e.name)
    if (pendingNames.length === 0) {
      // 没 TBD 了说明接入完成，测试自动变 NOOP，不阻塞
      expect(pendingNames).toEqual([])
      return
    }
    const files = listSourceFiles(ALL_SRC_DIR).filter(
      (rel) => rel.startsWith('src/pages/') || rel.startsWith('src/apps/') || rel.startsWith('src/cockpit/'),
    )
    const violations: string[] = []
    for (const rel of files) {
      const abs = join(PROJECT_ROOT, rel)
      let src: string
      try {
        src = readFileSync(abs, 'utf-8')
      } catch {
        continue
      }
      for (const name of pendingNames) {
        // 任何形式的名字引用（import / JSX / 字符串 ID）都算
        if (new RegExp(`\\b${name}\\b`).test(src)) {
          violations.push(
            `${rel} 引用了 TBD-pending 的 organism "${name}"，但 registry 声明 consumers=["TBD ..."]，请先更新 registry.consumers 再接入。`,
          )
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })
})
