/**
 * @module audit-atomic
 * @description 原子组件层级边界审计
 *
 * 校验 `src/components/` 下所有组件是否遵守 Atomic Design 层级约束：
 * - Atom  ：只可由 Tailwind/Tokens 组装，禁止 import store/service/molecule/organism/template/page/app/business
 * - Molecule：只可由 Atom 组合，禁止 import organism/template/store/service/page/app/business
 * - Template：只可由 Molecule+Atom 组合，禁止 import organism/store/service/page/app/business
 * - Organism：可 import 任意层级（含 store/service）
 * - Shim（ui/ 兼容层）：必须是纯 re-export，且只能指向 atoms/ 或 molecules/
 *
 * 依据 `componentRegistry.ts` 推断处于旧位置（analysis/input/...）组件的层级，
 * 对当前布局即可生效，不必等物理迁移完成。
 *
 * 输出遵循 _audit-pipeline 契约：stdout=JSON、stderr=人类可读、退出码 0/1/2。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_debug/_audit-pipeline'
import { COMPONENT_REGISTRY, type AtomicLevel } from '../src/components/componentRegistry'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const COMPONENTS_DIR = path.join(ROOT, 'src', 'components')

// ============================================================
// 类型
// ============================================================

type ImportCategory =
  | 'atom'
  | 'molecule'
  | 'organism'
  | 'template'
  | 'shim'
  | 'business' // 旧位置业务组件（analysis/input/chart/cockpit/cabin/widgets/news/...）
  | 'store'
  | 'service'
  | 'page'
  | 'app'
  | 'infra' // config/constants/lib/core/types/data/hooks/portal/cockpit(系统)/agents
  | 'external' // react / 三方包等

interface AtomicViolation {
  file: string
  tier: AtomicLevel | 'shim' | 'unregistered'
  rule: string
  level: 'blocking' | 'warning'
  importTarget?: string
  message: string
}

interface AtomicReport extends AuditReport {
  violations: AtomicViolation[]
  summary: {
    totalFiles: number
    totalViolations: number
    totalWarnings: number
    byTier: Record<string, number>
    byRule: Record<string, number>
  }
}

// ============================================================
// 目录 → 层级推断
// ============================================================

function tierFromDir(relativePath: string): AtomicLevel | 'shim' | 'business' | null {
  const parts = relativePath.split(path.sep)
  if (parts[0] === 'atoms') return 'atom'
  if (parts[0] === 'molecules') return 'molecule'
  if (parts[0] === 'organisms') return 'organism'
  if (parts[0] === 'templates') return 'template'
  // LEGACY: ui/ 目录已删除（阶段 5 shim 清理），保留分类作为安全网
  if (parts[0] === 'ui') return 'shim'
  if (parts[0] === 'shared') return 'organism'
  // LEGACY: 旧业务目录（collection/pool/input/trading/output/news/strategy/agent/localDoc/system/analysis/scoreDoc）已删除
  // 保留 'business' 分类用于 cockpit/cabin/chart/widgets 等按决策保留的目录
  return 'business'
}

// 依据 componentRegistry 查组件应属层级（兼容迁移前 sourcePath 与迁移后 targetPath）
function levelFromRegistry(currentPath: string): { level: AtomicLevel; status: string } | null {
  const entry = COMPONENT_REGISTRY.find(
    (e) => e.sourcePath === currentPath || e.targetPath === currentPath,
  )
  return entry ? { level: entry.level, status: entry.status } : null
}

// ============================================================
// import 分类
// ============================================================

function classifyImport(spec: string): ImportCategory {
  if (!spec.startsWith('@/')) return 'external'
  const rest = spec.slice(2) // 去掉 '@/'
  if (rest.startsWith('components/atoms')) return 'atom'
  if (rest.startsWith('components/molecules')) return 'molecule'
  if (rest.startsWith('components/organisms')) return 'organism'
  if (rest.startsWith('components/templates')) return 'template'
  if (rest.startsWith('components/ui')) return 'shim'
  if (rest.startsWith('components/')) return 'business'
  if (rest.startsWith('store')) return 'store'
  if (rest.startsWith('services')) return 'service'
  if (rest.startsWith('pages')) return 'page'
  if (rest.startsWith('apps')) return 'app'
  return 'infra'
}

// 各层级禁止 import 的目标类别
const FORBIDDEN: Record<string, ImportCategory[]> = {
  atom: ['molecule', 'organism', 'template', 'store', 'service', 'page', 'app', 'business'],
  molecule: ['organism', 'template', 'store', 'service', 'page', 'app', 'business'],
  template: ['organism', 'store', 'service', 'page', 'app', 'business'],
  organism: [],
  shim: [],
  business: [],
  unregistered: [],
}

// ============================================================
// 提取 import 目标
// ============================================================

const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?\bfrom\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function extractImports(content: string): string[] {
  const specs: string[] = []
  let m: RegExpExecArray | null
  IMPORT_RE.lastIndex = 0
  while ((m = IMPORT_RE.exec(content)) !== null) {
    const spec = m[1] ?? m[2]
    if (spec) specs.push(spec)
  }
  return specs
}

// ============================================================
// shim 纯度校验
// ============================================================

// 匹配「非 re-export 的 export」（即实现体）
const IMPL_EXPORT_RE = /(^|\n)\s*export\s+(?:default\s+)?(?:async\s+)?(function|const|class|interface|type|enum)\b(?![^;{]*\bfrom\s+['"])/

// LEGACY: ui/ 目录已删除（阶段 5 shim 清理），此函数仅作历史文档保留。
// 如果未来重新引入 shim 机制，可参考此实现。
function checkShimPurity(relativePath: string, content: string): AtomicViolation[] {
  const violations: AtomicViolation[] = []
  // 去除块注释与行注释，避免误判
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  if (IMPL_EXPORT_RE.test(stripped)) {
    violations.push({
      file: relativePath,
      tier: 'shim',
      rule: 'shim-pure-reexport',
      level: 'blocking',
      message: 'ui/ shim 必须是纯 re-export，但包含实现体（export function/const/class）。',
    })
  }
  // 校验每条 re-export 的目标
  const reExportRe = /export\s+(?:\*\s+|\{[^}]*\}\s+)?from\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = reExportRe.exec(content)) !== null) {
    const target = m[1]!
    const cat = classifyImport(target)
    if (cat !== 'atom' && cat !== 'molecule') {
      violations.push({
        file: relativePath,
        tier: 'shim',
        rule: 'shim-target',
        level: 'warning',
        importTarget: target,
        message: `ui/ shim 应指向 atoms/ 或 molecules/，实际指向 ${target}（${cat}）。`,
      })
    }
  }
  return violations
}

// ============================================================
// 扫描
// ============================================================

export function scan(): AtomicReport {
  const violations: AtomicViolation[] = []
  let totalFiles = 0

  const walk = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (entry.name === 'index.ts') continue // 跳过桶导出
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue // 测试可自由 import
      if (entry.name === 'componentRegistry.ts') continue

      totalFiles++
      const relativePath = path.relative(COMPONENTS_DIR, full).split(path.sep).join('/')
      const content = fs.readFileSync(full, 'utf-8')

      const dirTier = tierFromDir(relativePath)

      // —— shim 纯度校验 ——
      // LEGACY: ui/ shim 已删除，此分支不会触发，保留作安全网
      if (dirTier === 'shim') {
        violations.push(...checkShimPurity(relativePath, content))
        // shim 层级本身不进行跨层 import 边界校验（由纯度校验覆盖）
        continue
      }

      // —— 确定层级 ——
      let tier: AtomicLevel
      if (dirTier === 'atom' || dirTier === 'molecule' || dirTier === 'template' || dirTier === 'organism') {
        tier = dirTier
      } else {
        // 旧位置业务组件：依据 registry 推断（同时匹配 sourcePath / targetPath）
        const regInfo = levelFromRegistry(`src/components/${relativePath}`)
        if (regInfo) {
          tier = regInfo.level
          // 若 registry 标注 migrating 但文件已在 targetPath（新位置），提示翻转
          const entry = COMPONENT_REGISTRY.find(
            (e) => e.sourcePath === `src/components/${relativePath}` || e.targetPath === `src/components/${relativePath}`,
          )
          if (entry && entry.status === 'migrating' && `src/components/${relativePath}` === entry.targetPath) {
            violations.push({
              file: relativePath,
              tier: 'unregistered',
              rule: 'registry-status',
              level: 'warning',
              message: `组件已在目标路径但 registry status 仍为 'migrating'，建议翻转为 'active'。`,
            })
          }
        } else {
          tier = 'organism' // 默认按业务有机体处理
          violations.push({
            file: relativePath,
            tier: 'unregistered',
            rule: 'unregistered',
            level: 'warning',
            message: `业务组件未在 componentRegistry 登记（默认按 organism 处理）。建议补登 targetPath 与层级。`,
          })
        }
      }

      // —— 跨层 import 边界校验 ——
      const forbidden = FORBIDDEN[tier] ?? []
      const imports = extractImports(content)
      for (const spec of imports) {
        const cat = classifyImport(spec)
        if (forbidden.includes(cat)) {
          violations.push({
            file: relativePath,
            tier,
            rule: `tier-boundary:${tier}-no-${cat}`,
            level: 'blocking',
            importTarget: spec,
            message: `${tier} 不应 import ${cat} 级模块：${spec}`,
          })
        }
      }

      // SAFETY NET: 检测是否有文件仍引用已删除的 @/components/ui/ 路径
      // ui/ 目录已删除（阶段 5），但保留此规则防止未来误创建
      if (dirTier !== 'shim') {
        for (const spec of imports) {
          if (classifyImport(spec) === 'shim') {
            violations.push({
              file: relativePath,
              tier,
              rule: 'stale-ui-import',
              level: 'warning',
              importTarget: spec,
              message: `已迁移组件仍引用 @/components/ui（shim 兼容层），建议改为 @/components/atoms 或 @/components/molecules。`,
            })
          }
        }
      }
    }
  }

  walk(COMPONENTS_DIR)

  const totalViolations = violations.length
  const totalWarnings = violations.filter((v) => v.level === 'warning').length
  const byTier: Record<string, number> = {}
  const byRule: Record<string, number> = {}
  for (const v of violations) {
    byTier[v.tier] = (byTier[v.tier] ?? 0) + 1
    byRule[v.rule] = (byRule[v.rule] ?? 0) + 1
  }

  return {
    violations,
    summary: {
      totalFiles,
      totalViolations,
      totalWarnings,
      byTier,
      byRule,
    },
  }
}

// ============================================================
// 人类可读报告
// ============================================================

function formatReport(report: AtomicReport): string {
  const { totalFiles, totalViolations, totalWarnings, byTier, byRule } = report.summary
  const blocking = totalViolations - totalWarnings
  const lines: string[] = []
  lines.push('══════════════════════════════════════════════════════')
  lines.push(' 原子组件层级边界审计 (audit:atomic)')
  lines.push('══════════════════════════════════════════════════════')
  lines.push(`扫描文件数 : ${totalFiles}`)
  lines.push(`违规总数   : ${totalViolations}  (阻断 ${blocking} / 警告 ${totalWarnings})`)
  if (Object.keys(byTier).length) {
    lines.push('')
    lines.push('按层级:')
    for (const [t, n] of Object.entries(byTier)) lines.push(`  - ${t}: ${n}`)
  }
  if (Object.keys(byRule).length) {
    lines.push('')
    lines.push('按规则:')
    for (const [r, n] of Object.entries(byRule)) lines.push(`  - ${r}: ${n}`)
  }
  const blockers = report.violations.filter((v) => v.level === 'blocking')
  if (blockers.length) {
    lines.push('')
    lines.push(colorize('🔴 阻断性违规（必须修复）:', 'red'))
    for (const v of blockers.slice(0, 50)) {
      lines.push(`  • [${v.tier}] ${v.file}${v.importTarget ? `  ← ${v.importTarget}` : ''}`)
      lines.push(`    ${v.message}`)
    }
    if (blockers.length > 50) lines.push(`  … 其余 ${blockers.length - 50} 条见 JSON 报告`)
  }
  const warnings = report.violations.filter((v) => v.level === 'warning')
  if (warnings.length) {
    lines.push('')
    lines.push(colorize(`⚠️  警告（不阻断，建议消减）: ${warnings.length} 条`, 'yellow'))
    for (const v of warnings.slice(0, 30)) {
      lines.push(`  • [${v.tier}] ${v.file}: ${v.message}`)
    }
    if (warnings.length > 30) lines.push(`  … 其余 ${warnings.length - 30} 条见 JSON 报告`)
  }
  lines.push('')
  lines.push(totalViolations === 0 ? colorize('✅ 无违规', 'green') : blocking === 0 ? colorize('✅ 无阻断性违规（仅警告）', 'green') : colorize('❌ 存在阻断性违规', 'red'))
  return lines.join('\n')
}

// ============================================================
// 入口
// ============================================================

export function main(): void {
  runAuditPipeline({
    scriptName: 'audit-atomic',
    version: '1.0.0',
    scanFn: scan,
    formatReportFn: formatReport,
  })
}

main()
