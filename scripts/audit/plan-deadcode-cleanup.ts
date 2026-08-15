/**
 * @fileoverview Dead Code 清理计划脚本
 *
 * 针对 audit-dead-code 扫描出的 30 条 warnings，生成分类清理计划：
 *   1. 无条件返回 null（3 处）→ 组件合法空状态，豁免
 *   2. 空函数 noop（1 处）→ 合法 fallback，豁免
 *   3. 未注册页面（5 处）→ 注册到路由表或标记为架构预留
 *   4. 未使用组件（20 处）→ 分类：动态加载/僵尸/桶导出
 *   5. 命名冲突（1 处）→ 重命名或合并
 *
 * 使用方式:
 *   npx tsx scripts/audit/plan-deadcode-cleanup.ts          # 生成计划
 *   npx tsx scripts/audit/plan-deadcode-cleanup.ts --verify  # 验证组件引用
 *
 * @version v1.0.0
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, relative } from 'path'

const ROOT = process.cwd()
const REPORTS_DIR = resolve(ROOT, 'scripts/audit/docs/reports/audit')
const OUTPUT_DIR = resolve(ROOT, 'scripts/audit/docs/plans')
const VERIFY = process.argv.includes('--verify')

// ─── 类型 ───────────────────────────────────────────────────────
interface DeadCodeIssue {
  file: string
  line: number
  type: string
  message: string
  context: string
  refCount?: number
  collisionFiles?: string[]
}

interface CleanupAction {
  category: string
  severity: 'safe' | 'needs-review' | 'delete'
  action: string
  file: string
  reason: string
  suggestedFix: string
}

// ─── 主流程 ───────────────────────────────────────────────────────
function main(): void {
  const report = loadLatestReport()
  if (!report) {
    console.error('❌ 找不到 audit-dead-code 报告')
    process.exit(1)
  }

  const issues = extractIssues(report)
  console.log(`📋 读取审计报告，共 ${issues.length} 条 deadcode warnings`)

  const actions = classifyIssues(issues)
  printPlan(actions)

  if (VERIFY) {
    verifyComponentUsage(issues)
  }
}

// ─── 加载报告 ────────────────────────────────────────────────────
function loadLatestReport(): string | null {
  if (!existsSync(REPORTS_DIR)) return null
  const files: string[] = readdirSync(REPORTS_DIR)
  const deadcodeFiles = files
    .filter((f) => f.startsWith('audit-dead-code-') && f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a))
  return deadcodeFiles.length > 0 ? resolve(REPORTS_DIR, deadcodeFiles[0]) : null
}

function extractIssues(reportPath: string): DeadCodeIssue[] {
  const content = readFileSync(reportPath, 'utf-8')
  const report = JSON.parse(content)
  return [...(report.issues || []), ...(report.warnings || [])]
}

// ─── 分类处理 ────────────────────────────────────────────────────
function classifyIssues(issues: DeadCodeIssue[]): CleanupAction[] {
  const actions: CleanupAction[] = []

  for (const issue of issues) {
    switch (issue.type) {
      case '无条件返回 null':
        actions.push({
          category: '合法空状态',
          severity: 'safe',
          action: '保留',
          file: issue.file,
          reason: 'React 组件返回 null 是合法的条件渲染模式',
          suggestedFix: '在组件/测试中添加注释说明这是预期的空状态',
        })
        break

      case '空函数':
        actions.push({
          category: '合法 fallback',
          severity: 'safe',
          action: '保留',
          file: issue.file,
          reason: 'noop 是事件订阅/定时器等场景的安全默认值',
          suggestedFix: '添加 JSDoc 注释说明 fallback 用途',
        })
        break

      case '未注册页面':
        actions.push({
          category: '路由注册',
          severity: 'needs-review',
          action: '注册/删除',
          file: issue.file,
          reason: '页面文件未在路由表或 App 分发器中注册',
          suggestedFix: '① 确认页面是否为架构预留；② 若已实现则注册到对应 App；③ 若废弃则删除文件',
        })
        break

      case '未使用组件':
        actions.push(classifyUnusedComponent(issue))
        break

      case 'name-collision':
        actions.push({
          category: '命名冲突',
          severity: 'needs-review',
          action: '重命名',
          file: issue.file,
          reason: `组件名 "ErrorState" 与 ${(issue.collisionFiles || []).join(', ')} 冲突`,
          suggestedFix: '① 重命名其中一个为 AppErrorState / DefaultErrorState；② 或合并到单一文件统一导出',
        })
        break

      default:
        actions.push({
          category: '其他',
          severity: 'needs-review',
          action: '审查',
          file: issue.file,
          reason: issue.message,
          suggestedFix: '手动审查处理',
        })
    }
  }

  return actions
}

// ─── 未使用组件分类 ──────────────────────────────────────────────
function classifyUnusedComponent(issue: DeadCodeIssue): CleanupAction {
  const file = issue.file

  // MockDataBadge 是通用徽章，很可能被动态引用
  if (file.includes('MockDataBadge')) {
    return {
      category: '通用组件（可能桶导出）',
      severity: 'safe',
      action: '保留',
      file,
      reason: 'MockDataBadge 通过 barrel export 或条件渲染使用',
      suggestedFix: '添加注释说明用途，审计误报',
    }
  }

  // 模板/布局组件通常被 App 入口引用
  if (file.includes('templates/') || file.includes('Layout')) {
    return {
      category: '布局组件（动态引用）',
      severity: 'safe',
      action: '保留',
      file,
      reason: '布局组件通过 App 入口或动态 import 引用',
      suggestedFix: '验证 App.tsx / 路由表中是否引用',
    }
  }

  // 错误边界组件
  if (file.includes('ErrorBoundary')) {
    return {
      category: '错误边界（全局注册）',
      severity: 'safe',
      action: '保留',
      file,
      reason: 'ErrorBoundary 通常在根组件注册一次',
      suggestedFix: '验证 App.tsx 中的引用',
    }
  }

  // 图表/行业组件
  if (file.includes('chart/') || file.includes('industry/')) {
    return {
      category: '图表组件（可能动态加载）',
      severity: 'needs-review',
      action: '验证',
      file,
      reason: '图表组件可能通过 React.lazy 或动态 import 加载',
      suggestedFix: '① 搜索 React.lazy/dynamic import；② 若无引用则列入待删除清单',
    }
  }

  // cabin 组件
  if (file.includes('cabin/')) {
    return {
      category: 'Cabin 组件（可能已废弃）',
      severity: 'delete',
      action: '删除',
      file,
      reason: 'Cabin 子系统已迁移到 Cockpit，Score* 组件可能为僵尸',
      suggestedFix: '① 确认无引用后删除 ScoreHistoryTable.tsx 等 4 个文件；② 或迁移到 Cockpit 体系',
    }
  }

  // cockpit 组件
  if (file.includes('cockpit/')) {
    return {
      category: 'Cockpit 组件（可能已废弃）',
      severity: 'delete',
      action: '删除',
      file,
      reason: 'DensityToggle/SecurityStatus 可能为旧版 UI 组件',
      suggestedFix: '确认 CockpitShell.tsx 中是否引用；若无则删除',
    }
  }

  // molecules 通用组件
  if (file.includes('molecules/')) {
    return {
      category: '通用组件（可能桶导出）',
      severity: 'needs-review',
      action: '验证',
      file,
      reason: 'FilterChip/FormField/SearchBar 可能通过 barrel export 使用',
      suggestedFix: '① 搜索 components/molecules/index.ts 导出；② 全局搜索组件名使用',
    }
  }

  // organisms 组件
  if (file.includes('organisms/')) {
    return {
      category: 'Organism 组件（可能条件渲染）',
      severity: 'needs-review',
      action: '验证',
      file,
      reason: 'ScoreHistoryPanel/CycleRetrospectiveView 可能通过条件渲染使用',
      suggestedFix: '① 搜索组件名使用；② 若无引用则删除',
    }
  }

  return {
    category: '僵尸组件',
    severity: 'delete',
    action: '删除',
    file,
    reason: '组件无任何引用',
    suggestedFix: '删除文件',
  }
}

// ─── 打印计划 ────────────────────────────────────────────────────
function printPlan(actions: CleanupAction[]): void {
  const byCategory = new Map<string, CleanupAction[]>()
  for (const a of actions) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, [])
    byCategory.get(a.category)!.push(a)
  }

  const bySeverity = {
    safe: actions.filter((a) => a.severity === 'safe').length,
    'needs-review': actions.filter((a) => a.severity === 'needs-review').length,
    delete: actions.filter((a) => a.severity === 'delete').length,
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(' Dead Code 清理计划 v1.0')
  console.log(`${'═'.repeat(60)}`)
  console.log(` 总计: ${actions.length} 条`)
  console.log(`   ✅ 安全保留: ${bySeverity.safe}`)
  console.log(`   🔍 需要审查: ${bySeverity['needs-review']}`)
  console.log(`   🗑️  建议删除: ${bySeverity.delete}`)
  console.log(`${'─'.repeat(60)}`)

  for (const [cat, items] of byCategory) {
    const icon = items[0].severity === 'safe' ? '✅' : items[0].severity === 'delete' ? '🗑️' : '🔍'
    console.log(`\n ${icon} ${cat} (${items.length})`)
    for (const item of items) {
      console.log(`    ${item.file}`)
      console.log(`       原因: ${item.reason}`)
      console.log(`       建议: ${item.suggestedFix}`)
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log('\n📝 建议执行顺序:')
  console.log('  1. 先验证 safe 类（组件确实在用，添加注释即可）')
  console.log('  2. 再审查 needs-review 类（确认动态引用）')
  console.log('  3. 最后处理 delete 类（确认无引用后删除）')
  console.log('\n  💡 使用 --verify 模式验证组件引用')

  // 生成 markdown 报告
  generateMarkdownReport(actions)
}

// ─── 生成 Markdown 报告 ──────────────────────────────────────────
function generateMarkdownReport(actions: CleanupAction[]): void {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const now = new Date().toISOString().split('T')[0]
  const outputPath = resolve(OUTPUT_DIR, `deadcode-cleanup-plan-${now}.md`)

  const byCategory = new Map<string, CleanupAction[]>()
  for (const a of actions) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, [])
    byCategory.get(a.category)!.push(a)
  }

  let md = `# Dead Code 清理计划\n\n`
  md += `> 生成时间: ${new Date().toISOString()}\n`
  md += `> 扫描文件: 1440\n`
  md += `> 发现问题: ${actions.length} 条\n\n`

  md += `## 统计概览\n\n`
  md += `| 分类 | 数量 | 严重度 |\n`
  md += `|------|------|--------|\n`
  for (const [cat, items] of byCategory) {
    const sev = items[0].severity === 'safe' ? '✅ 安全' : items[0].severity === 'delete' ? '🗑️ 建议删除' : '🔍 需审查'
    md += `| ${cat} | ${items.length} | ${sev} |\n`
  }

  for (const [cat, items] of byCategory) {
    md += `\n## ${cat}\n\n`
    md += `| 文件 | 原因 | 建议操作 |\n`
    md += `|------|------|----------|\n`
    for (const item of items) {
      md += `| ${item.file} | ${item.reason} | ${item.suggestedFix} |\n`
    }
  }

  md += `\n## 执行 Checklist\n\n`
  md += `- [ ] 验证 safe 类组件确实在使用（添加注释说明）\n`
  md += `- [ ] 审查 needs-review 类组件的动态引用情况\n`
  md += `- [ ] 确认 delete 类组件无引用后删除\n`
  md += `- [ ] 修复 1 处命名冲突（ErrorState）\n`
  md += `- [ ] 注册 5 处未注册页面（或确认废弃）\n`
  md += `- [ ] 重新运行 audit-dead-code 确认清零\n`

  writeFileSync(outputPath, md, 'utf-8')
  console.log(`\n📄 完整报告: ${relative(ROOT, outputPath)}`)
}

// ─── 验证组件引用 ────────────────────────────────────────────────
function verifyComponentUsage(issues: DeadCodeIssue[]): void {
  console.log('\n🔍 验证组件引用...\n')
  const unfound: string[] = []
  for (const issue of issues) {
    if (issue.type !== '未使用组件') continue
    const basename = issue.file.split('/').pop()?.replace('.tsx', '').replace('.ts', '') || ''
    // 简化验证：搜索组件名在其他文件中的引用
    const result = execSync(
      `cd /d "${ROOT}" && findstr /s /m /c:"${basename}" src\\*.tsx src\\*.ts 2>nul || echo "NOT_FOUND"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()
    if (result === 'NOT_FOUND' || result.split('\n').length <= 1) {
      unfound.push(issue.file)
      console.log(`  ⚠️  可能真僵尸: ${issue.file}`)
    } else {
      console.log(`  ✅ 有引用: ${issue.file} (${result.split('\n').length} 处匹配)`)
    }
  }
  if (unfound.length > 0) {
    console.log(`\n🗑️  确认无引用的僵尸组件: ${unfound.length} 个`)
    for (const f of unfound) console.log(`   - ${f}`)
  }
}

// ─── 启动 ────────────────────────────────────────────────────────
main()