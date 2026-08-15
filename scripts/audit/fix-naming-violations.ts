#!/usr/bin/env tsx
/**
 * fix-naming-violations.ts
 * 批量修复命名规范违规（name-mismatch 和 no-export）
 *
 * 用法:
 *   npx tsx scripts/audit/fix-naming-violations.ts           # dry-run 预览
 *   npx tsx scripts/audit/fix-naming-violations.ts --apply    # 实际写入
 *   npx tsx scripts/audit/fix-naming-violations.ts --json     # JSON 报告
 *
 * 修复策略:
 *   1. no-export (22 个): 这些文件实际使用 export default，检查器未识别
 *      → 更新检查器正则，增加 export default 检测
 *   2. name-mismatch (11 个): 根据文件类型分类处理
 *      - 组件文件: 重命名文件以匹配组件名（更新所有 import）
 *      - 工具/注册表文件: 加入豁免白名单
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, renameSync } from 'node:fs'
import { join, relative, resolve, dirname, basename, extname } from 'node:path'

const ROOT = resolve(import.meta.dirname!, '../..')
const COMPONENTS_DIR = join(ROOT, 'src', 'components')
const REPORT_PATH = join(ROOT, 'outputs', 'naming-conventions-report.json')
const FIX_REPORT_PATH = join(ROOT, 'outputs', 'naming-fix-report.json')

interface Violation {
  file: string
  type: 'name-mismatch' | 'no-export'
  message: string
  exportName?: string
  fileName?: string
  lineCount?: number
  consumers?: string[]
  category?: 'auto-fix' | 'checker-fix' | 'exempt' | 'manual'
  action?: string
  risk?: 'low' | 'medium' | 'high'
  reason?: string
}

// ─── 可自动重命名的文件（文件名 → 组件名） ───
const RENAME_MAP: Record<string, string> = {
  'src/components/atoms/StockPriceChange.tsx': 'StockPriceChangeBadge.tsx',
  'src/components/atoms/Toast.tsx': 'Toaster.tsx',
  'src/components/molecules/states/Error.tsx': 'ErrorState.tsx',
}

// ─── 可通过更新检查器消除的误报（export default 检测） ───
const EXPORT_DEFAULT_FILES = [
  'src/components/organisms/agent/GenericAgentDetail.tsx',
  'src/components/organisms/agent/StandardAgentDetail.tsx',
  'src/components/organisms/agent/V6ScoringAgentDetail.tsx',
  'src/components/organisms/input/CollectionSwimlane.tsx',
  'src/components/organisms/input/CollectionTimeline.tsx',
  'src/components/organisms/input/DimensionConfigCard.tsx',
  'src/components/organisms/input/FieldSelector.tsx',
  'src/components/organisms/input/InputFlowErrorBoundary.tsx',
  'src/components/organisms/input/LiveLogStream.tsx',
  'src/components/organisms/input/PolicyForm.tsx',
  'src/components/organisms/input/SourcePrioritySelect.tsx',
  'src/components/organisms/input/TraceReplayPanel.tsx',
  'src/components/organisms/output/ReviewWizard.tsx',
  'src/components/organisms/scoreDoc/ScoreDocVersionTable.tsx',
  'src/components/organisms/shared/ErrorBoundary.tsx',
  'src/components/organisms/shared/WidgetErrorBoundary.tsx',
  'src/components/organisms/system/AgentHealthCard.tsx',
  'src/components/organisms/system/AgentTaskList.tsx',
  'src/components/organisms/system/EngineStatusCard.tsx',
  'src/components/organisms/system/LogStreamPanel.tsx',
  'src/components/organisms/system/MigrationPanel.tsx',
  'src/components/organisms/system/SystemArchitectureDiagram.tsx',
]

// ─── 需要豁免白名单的文件 ───
const EXEMPT_FILES = [
  {
    file: 'src/components/atoms/statusColors.ts',
    reason: '常量文件，导出 DEFAULT_BADGE 等样式映射，不是组件文件',
    category: 'utility-constants',
  },
  {
    file: 'src/components/organisms/agent/agentComponentRegistry.ts',
    reason: '注册表文件，导出 getAgentComponent 等查询函数，不是组件',
    category: 'registry',
  },
  {
    file: 'src/components/organisms/output/reviewArtifact.ts',
    reason: '工具函数文件，导出 buildReviewArtifactHtml 等构建函数',
    category: 'utility',
  },
  {
    file: 'src/components/organisms/system/migration/migrationUtils.ts',
    reason: '工具函数文件，导出 buildV6Overview 等构建函数',
    category: 'utility',
  },
]

// ─── 需要检查器优化（首个导出是辅助函数）的文件 ───
const CHECKER_OPTIMIZE_FILES = [
  {
    file: 'src/components/molecules/DualFactorEvaluationPanel.tsx',
    realExport: 'DualFactorEvaluationPanel',
    helperExport: 'scoreToIndustryRating',
    reason: '首个导出是辅助函数 scoreToIndustryRating，主组件 DualFactorEvaluationPanel 在后',
  },
  {
    file: 'src/components/organisms/analysis/score/IntelligentScoreExplanation.tsx',
    realExport: 'IntelligentScoreExplanation',
    helperExport: 'buildRadarData',
    reason: '首个导出是辅助函数 buildRadarData，主组件 IntelligentScoreExplanation 在后',
  },
  {
    file: 'src/components/organisms/analysis/sector/SectorRotationHeatmap.tsx',
    realExport: 'SectorRotationHeatmap',
    helperExport: 'adaptHeatmapData',
    reason: '首个导出是辅助函数 adaptHeatmapData，主组件 SectorRotationHeatmap 在后',
  },
]

// ─── 查找精确 import 引用（基于文件的完整 import 路径） ───
function findPreciseImports(targetPath: string): { file: string; line: number; content: string }[] {
  const results: { file: string; line: number; content: string }[] = []
  const dir = dirname(targetPath)
  const oldBase = basename(targetPath, extname(targetPath))
  const importPathSegment = `@/components/${dir.replace(/\\/g, '/')}/${oldBase}`

  function walk(searchDir: string) {
    const entries = readdirSync(searchDir)
    for (const entry of entries) {
      const fullPath = join(searchDir, entry)
      try {
        if (statSync(fullPath).isDirectory()) {
          if (!entry.startsWith('.') && entry !== 'node_modules') walk(fullPath)
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
          const content = readFileSync(fullPath, 'utf8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            // 精确匹配 import 路径：import ... from '@/components/.../OldName'
            // 排除: OldName/index, OldName.tsx 等
            // 使用正向前瞻确保 OldName 后面是引号、斜杠或换行
            const preciseRegex = new RegExp(
              `from\\s+['"].*${importPathSegment}(?=['"/\\s])`
            )
            if (preciseRegex.test(line)) {
              if (resolve(fullPath) !== resolve(join(ROOT, targetPath))) {
                results.push({
                  file: relative(ROOT, fullPath).replace(/\\/g, '/'),
                  line: i + 1,
                  content: line.trim(),
                })
              }
            }
          }
        }
      } catch {}
    }
  }

  walk(join(ROOT, 'src'))
  return results
}

// ─── 分析每个违规文件的消费方 ───
function analyzeConsumers(filePath: string): string[] {
  const imports = findPreciseImports(filePath)
  return imports.map((i) => `${i.file}:${i.line}`)
}

// ─── 分析文件导出详情 ───
function analyzeFile(filePath: string) {
  const fullPath = join(ROOT, filePath)
  if (!existsSync(fullPath)) return null
  const content = readFileSync(fullPath, 'utf8')
  const lineCount = content.split('\n').length

  const namedExports =
    content
      .match(/export\s+(function|const)\s+(\w+)/g)
      ?.map((m) => m.replace(/export\s+(function|const)\s+/, '')) || []

  const hasDefaultExport = /export\s+default\s+(function|const|\w+)/.test(content)
  const hasTypeOnlyExport = namedExports.length === 0 && /export\s+type\s/.test(content)

  return { lineCount, namedExports, hasDefaultExport, hasTypeOnlyExport }
}

// ─── 主函数 ───
function main() {
  const isApply = process.argv.includes('--apply')
  const isJson = process.argv.includes('--json')

  console.log(`━━━ 命名规范违规批量修复器 ━━━`)
  console.log(`模式: ${isApply ? '实际写入' : 'dry-run 预览'}`)
  console.log('')

  const violations: Violation[] = []

  // ── 类别 1: export default 误报（检查器优化）──
  for (const file of EXPORT_DEFAULT_FILES) {
    const analysis = analyzeFile(file)
    const consumers = analyzeConsumers(file)
    violations.push({
      file,
      type: 'no-export',
      message: '未找到命名导出（实际使用 export default，检查器未识别）',
      lineCount: analysis?.lineCount,
      consumers,
      category: 'checker-fix',
      action: '更新检查器正则以检测 export default',
      risk: 'low',
      reason: `文件使用 export default 导出，属于合法模式。需要在检查器的 checkNamingConsistency 中增加 export default 检测：/export\\s+default\\s+(function|const|\\w+)/`,
    })
  }

  // ── 类别 2: 可自动重命名的组件文件 ──
  for (const [oldPath, newName] of Object.entries(RENAME_MAP)) {
    const analysis = analyzeFile(oldPath)
    const consumers = analyzeConsumers(oldPath)
    const dir = dirname(oldPath)
    const newPath = `${dir}/${newName}`

    violations.push({
      file: oldPath,
      type: 'name-mismatch',
      message: `组件名与文件名不一致（→ 重命名为 ${newPath}）`,
      exportName: analysis?.namedExports[0],
      fileName: basename(oldPath, extname(oldPath)),
      lineCount: analysis?.lineCount,
      consumers,
      category: 'auto-fix',
      action: `重命名文件 ${oldPath} → ${newPath}，更新 ${consumers.length} 处 import`,
      risk: consumers.length > 10 ? 'high' : consumers.length > 3 ? 'medium' : 'low',
      reason: `文件名是组件名的简化形式，重命名后组件名与文件名一致。需同步更新所有 import 引用。`,
    })
  }

  // ── 类别 3: 需要豁免白名单的工具/注册表文件 ──
  for (const ex of EXEMPT_FILES) {
    const analysis = analyzeFile(ex.file)
    const consumers = analyzeConsumers(ex.file)
    violations.push({
      file: ex.file,
      type: 'name-mismatch',
      message: `工具/注册表文件，豁免命名检查`,
      exportName: analysis?.namedExports[0],
      fileName: basename(ex.file, extname(ex.file)),
      lineCount: analysis?.lineCount,
      consumers,
      category: 'exempt',
      action: `加入豁免白名单（category: ${ex.category}）`,
      risk: 'low',
      reason: ex.reason,
    })
  }

  // ── 类别 4: 需要检查器优化（首个导出是辅助函数）──
  for (const opt of CHECKER_OPTIMIZE_FILES) {
    const analysis = analyzeFile(opt.file)
    const consumers = analyzeConsumers(opt.file)
    violations.push({
      file: opt.file,
      type: 'name-mismatch',
      message: `首个导出是辅助函数 ${opt.helperExport}，主组件 ${opt.realExport} 在后面`,
      exportName: opt.helperExport,
      fileName: basename(opt.file, extname(opt.file)),
      lineCount: analysis?.lineCount,
      consumers,
      category: 'checker-fix',
      action: '更新检查器逻辑，查找主组件导出而非首个导出',
      risk: 'low',
      reason: opt.reason,
    })
  }

  // ── 分类统计 ──
  const categories = violations.reduce<Record<string, number>>((acc, v) => {
    acc[v.category ?? 'unknown'] = (acc[v.category ?? 'unknown'] || 0) + 1
    return acc
  }, {})

  const risks = violations.reduce<Record<string, number>>((acc, v) => {
    acc[v.risk ?? 'unknown'] = (acc[v.risk ?? 'unknown'] || 0) + 1
    return acc
  }, {})

  // ── 输出报告 ──
  console.log(`发现违规: ${violations.length} 个`)
  console.log(`  auto-fix（可自动重命名）: ${categories['auto-fix'] || 0} 个`)
  console.log(`  checker-fix（检查器优化）: ${categories['checker-fix'] || 0} 个`)
  console.log(`  exempt（豁免白名单）: ${categories['exempt'] || 0} 个`)
  console.log('')

  for (const v of violations) {
    const riskIcon = v.risk === 'high' ? '🔴' : v.risk === 'medium' ? '🟡' : '🟢'
    const catLabel =
      v.category === 'auto-fix'
        ? 'AUTO-FIX  '
        : v.category === 'checker-fix'
          ? 'CHECKER   '
          : v.category === 'exempt'
            ? 'EXEMPT    '
            : 'MANUAL    '
    const consumerCount = v.consumers?.length || 0
    console.log(`  ${riskIcon} [${catLabel}] ${v.file}`)
    console.log(`     ${v.message}`)
    console.log(`     消费方: ${consumerCount} 个 · 风险: ${v.risk?.toUpperCase()}`)
    if (isApply) console.log(`     ⚠️  ${v.action}`)
    console.log('')
  }

  console.log('────────────────────────────────────────────')
  console.log(`类别: auto-fix=${categories['auto-fix'] || 0} checker-fix=${categories['checker-fix'] || 0} exempt=${categories['exempt'] || 0}`)
  console.log(`风险: high=${risks['high'] || 0} medium=${risks['medium'] || 0} low=${risks['low'] || 0}`)

  if (!isApply) {
    console.log('\n💡 使用 --apply 执行修复')
    console.log('💡 使用 --json 导出 JSON 报告')
  }

  // ── 生成报告 ──
  const report = {
    timestamp: new Date().toISOString(),
    mode: isApply ? 'applied' : 'dry-run',
    summary: {
      total: violations.length,
      byCategory: categories,
      byRisk: risks,
    },
    violations: violations.map((v) => ({
      file: v.file,
      type: v.type,
      category: v.category,
      action: v.action,
      risk: v.risk,
      consumers: v.consumers?.length || 0,
      reason: v.reason,
      message: v.message,
    })),
    fixStrategy: {
      checkerUpdate: {
        description: '更新 check-naming-conventions.ts 的 checkNamingConsistency 函数',
        changes: [
          '增加 export default 检测：/export\\s+default\\s+(function|const|\\w+)/',
          '优化导出查找：查找主组件导出（通常是最长命名或含 memo 的导出），而非首个导出',
          '增加豁免白名单：utility-constants / registry / utility 三类',
        ],
      },
      autoRename: RENAME_MAP,
      exemptFiles: EXEMPT_FILES,
      checkerOptimize: CHECKER_OPTIMIZE_FILES,
    },
  }

  if (isJson || !isApply) {
    writeFileSync(FIX_REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
    console.log(`\n📄 报告已写入: ${FIX_REPORT_PATH}`)
  }

  if (isApply) {
    applyFixes(violations)
  }
}

// ─── 应用修复 ───
function applyFixes(violations: Violation[]) {
  console.log('\n━━━ 执行修复 ━━━\n')

  const results: { file: string; action: string; status: 'done' | 'skipped' | 'failed'; details?: string }[] = []

  for (const v of violations) {
    if (v.category !== 'auto-fix') {
      results.push({ file: v.file, action: v.action!, status: 'skipped', details: 'checker-fix / exempt 已通过检查器优化处理' })
      continue
    }

    const newName = RENAME_MAP[v.file]
    if (!newName) continue

    const dir = dirname(v.file)
    const newPath = `${dir}/${newName}`
    const oldFullPath = join(ROOT, v.file)
    const newFullPath = join(ROOT, newPath)
    const oldBase = basename(v.file, extname(v.file))
    const newBase = basename(newName, extname(newName))

    try {
      // 1. 查找精确 import 引用
      const imports = findPreciseImports(v.file)

      // 2. 读取原文件内容
      const content = readFileSync(oldFullPath, 'utf8')

      // 3. 更新文件内部的 @module / @fileoverview 路径
      let newContent = content
        .replace(
          /@module\s+components\/[^*\n]*/g,
          (match) => match.replace(oldBase, newBase)
        )
        .replace(
          /@fileoverview\s+[^\n]*（/g,
          `@fileoverview ${newBase} - 组件（`
        )

      // 4. 写入新文件
      writeFileSync(newFullPath, newContent, 'utf8')
      console.log(`📄 新文件已创建: ${newPath}`)

      // 5. 更新所有消费方的 import 路径
      let updatedFiles = 0
      for (const imp of imports) {
        const consumerPath = join(ROOT, imp.file)
        if (!existsSync(consumerPath)) continue

        const consumerContent = readFileSync(consumerPath, 'utf8')

        // 精确替换 import 路径
        // 将 '@/components/atoms/StockPriceChange' 替换为 '@/components/atoms/StockPriceChangeBadge'
        const importPathOld = `@/components/${dir.replace(/\\/g, '/')}/${oldBase}`
        const importPathNew = `@/components/${dir.replace(/\\/g, '/')}/${newBase}`

        let newConsumerContent = consumerContent.split(importPathOld + "'").join(importPathNew + "'")
        newConsumerContent = newConsumerContent.split(importPathOld + '"').join(importPathNew + '"')

        if (newConsumerContent !== consumerContent) {
          writeFileSync(consumerPath, newConsumerContent, 'utf8')
          updatedFiles++
          console.log(`   ✏️  更新 import: ${imp.file}:${imp.line}`)
        }
      }

      // 6. 保留旧文件（手动删除）
      console.log(`   ⚠️  旧文件保留: ${v.file}`)
      console.log(`   💡  验证后删除: rm ${oldFullPath}`)

      results.push({
        file: v.file,
        action: `重命名为 ${newPath}`,
        status: 'done',
        details: `新文件已创建，${updatedFiles} 处 import 已更新`,
      })

      console.log(`✅ ${v.file} → ${newPath}（${updatedFiles} 处 import 已更新）`)
    } catch (e) {
      results.push({
        file: v.file,
        action: `重命名为 ${newPath}`,
        status: 'failed',
        details: String(e),
      })
      console.log(`❌ ${v.file} 重命名失败: ${e}`)
    }
  }

  console.log('\n📊 修复结果:')
  const done = results.filter((r) => r.status === 'done').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  console.log(`   ✅ 完成: ${done}  ❌ 失败: ${failed}  ⏭️ 跳过: ${skipped}`)
  console.log('\n⚠️  注意：请手动删除旧文件，然后运行 `npm run audit:naming` 验证')

  return results
}

main()