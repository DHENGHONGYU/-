/**
 * @fileoverview 自动补充 @fileoverview 注释脚本
 *
 * 扫描所有组件文件，为缺失 @fileoverview 的文件自动生成标准文档模板。
 * 支持 --dry-run 预览和 --apply 实际写入模式。
 *
 * Usage:
 *   npx tsx scripts/audit/fix-fileoverview.ts              # dry-run 预览
 *   npx tsx scripts/audit/fix-fileoverview.ts --apply       # 实际写入
 *   npx tsx scripts/audit/fix-fileoverview.ts --json        # JSON 报告
 *
 * @module scripts/audit/fix-fileoverview
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname, relative, extname, basename, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const SRC = join(ROOT, 'src')
const COMPONENTS_DIR = join(SRC, 'components')

interface FixResult {
  file: string
  action: 'added' | 'skipped' | 'error'
  reason?: string
  originalOverview?: string
  addedOverview?: string
}

interface FixReport {
  timestamp: string
  mode: 'dry-run' | 'applied'
  totalScanned: number
  totalFixed: number
  totalSkipped: number
  totalErrors: number
  results: FixResult[]
}

const LEVEL_DIRS: Record<string, string> = {
  atoms: 'Atom',
  molecules: 'Molecule',
  organisms: 'Organism',
  templates: 'Template',
}

const SKIP_PATTERNS = [
  /\.test\.(tsx|ts)$/,
  /\.spec\.(tsx|ts)$/,
  /\.stories\.(tsx|ts)$/,
  /index\.(tsx|ts)$/,
]

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath))
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  try {
    const items = readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      const fullPath = join(dir, item.name)
      if (item.isDirectory()) {
        results.push(...walkDir(fullPath))
      } else if (item.isFile()) {
        results.push(fullPath)
      }
    }
  } catch {
    // skip
  }
  return results
}

function detectLevel(filePath: string): string {
  const rel = relative(COMPONENTS_DIR, filePath).replace(/\\/g, '/')
  const topDir = rel.split('/')[0]
  return LEVEL_DIRS[topDir] ?? 'Component'
}

/** 推断组件功能描述 */
function inferDescription(filePath: string, content: string): string {
  // 策略 1: 从文件名推断
  const fileName = basename(filePath, extname(filePath))
  const nameHints: Record<string, string> = {
    Panel: '面板',
    Card: '卡片',
    List: '列表',
    Dialog: '对话框',
    Modal: '弹窗',
    Badge: '徽章',
    Button: '按钮',
    Input: '输入框',
    Select: '选择器',
    Chart: '图表',
    Filter: '筛选器',
    Form: '表单',
    Dashboard: '仪表盘',
    Layout: '布局',
    Container: '容器',
    Header: '头部',
    Footer: '底部',
    Sidebar: '侧边栏',
    ErrorBoundary: '错误边界',
    Loading: '加载状态',
    Empty: '空状态',
    Skeleton: '骨架屏',
    Alert: '警告提示',
    Toast: '吐司通知',
    Tooltip: '工具提示',
    Table: '表格',
    Grid: '网格',
    Tabs: '选项卡',
    Step: '步骤',
    Wizard: '向导',
    Overview: '概览',
    Score: '评分',
    Trend: '趋势',
    Heatmap: '热力图',
    Distribution: '分布图',
    Indicator: '指示器',
    Gauge: '仪表盘',
    Map: '地图',
    Timeline: '时间线',
    Swimlane: '泳道图',
    Spectrum: '频谱',
    Report: '报告',
    Review: '复盘',
    Preview: '预览',
    Detail: '详情',
    Summary: '摘要',
    Config: '配置',
    Setting: '设置',
    Upload: '上传',
    Download: '下载',
    Search: '搜索',
    Stock: '股票',
    News: '资讯',
    Collection: '采集',
    Quality: '质量',
    Signal: '信号',
    Risk: '风险',
    Control: '控制',
    Order: '订单',
    Prediction: '预测',
    Factor: '因子',
    Multi: '多',
    Dual: '双',
    Single: '单',
    Live: '实时',
    Realtime: '实时',
    Historical: '历史',
    Intelligent: '智能',
    Auto: '自动',
    Manual: '手动',
    Batch: '批量',
    Trace: '追踪',
    Log: '日志',
    Stream: '流',
    Data: '数据',
    Info: '信息',
    Status: '状态',
    State: '状态',
    View: '视图',
    Page: '页面',
    App: '应用',
  }

  // 组合匹配
  const parts = fileName.replace(/([A-Z])/g, ' $1').trim().split(/\s+/)
  const descriptions: string[] = []

  for (const part of parts) {
    if (nameHints[part]) {
      descriptions.push(nameHints[part])
    }
  }

  // 策略 2: 从代码中提取组件名称和 props
  const exportMatch = content.match(/export\s+(function|const)\s+(\w+)/)
  const componentName = exportMatch?.[2] ?? fileName

  if (descriptions.length > 0) {
    return `${componentName} - ${descriptions.join(' / ')}组件`
  }

  // 策略 3: 通用描述
  const level = detectLevel(filePath)
  return `${componentName} ${level}层组件`
}

/** 推断 @module 路径 */
function inferModulePath(filePath: string): string {
  const relPath = relative(SRC, filePath).replace(/\\/g, '/')
  return `@module ${relPath.replace(/\.tsx?$/, '')}`
}

/** 生成标准 @fileoverview 块 */
function generateFileoverview(filePath: string, content: string): string {
  const description = inferDescription(filePath, content)
  const modulePath = inferModulePath(filePath)
  const level = detectLevel(filePath)

  return `/**
 * @fileoverview ${description}（${level}层组件）
 * ${modulePath}
 */`
}

/** 分析文件结构，确定插入位置 */
function findInsertPoint(content: string): { insertAt: number; hasExistingFileoverview: boolean } {
  // 如果已有 @fileoverview，跳过
  if (content.includes('@fileoverview')) {
    return { insertAt: -1, hasExistingFileoverview: true }
  }

  // 如果文件以注释开头（不是 @fileoverview），保留原有注释
  // 查找第一个 import / export / interface 的位置
  const firstImport = content.search(/^import\s/m)
  const firstExport = content.search(/^export\s/m)
  const firstInterface = content.search(/^(?:export\s+)?interface\s/m)

  // 找最靠前的非空行
  const candidates = [firstImport, firstExport, firstInterface].filter((n) => n >= 0)
  const firstCodeLine = candidates.length > 0 ? Math.min(...candidates) : content.length

  // 查找文件开头的注释块
  const leadingCommentMatch = content.match(/^(\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\n|\s*\n)*)/)
  const leadingLen = leadingCommentMatch ? leadingCommentMatch[1].length : 0

  // 在 leading comment 之后，import 之前插入
  const insertAt = Math.max(leadingLen, 0)

  return { insertAt, hasExistingFileoverview: false }
}

/** 检查组件是否有主导出 */
function hasComponentExport(content: string): boolean {
  return /export\s+(function|const)\s+\w+/.test(content)
}

async function main(): Promise<void> {
  const isApply = process.argv.includes('--apply')
  const isJson = process.argv.includes('--json')
  const isFixAll = process.argv.includes('--fix-all')

  console.log('━━━ @fileoverview 自动补充脚本 ━━━')
  console.log(`模式: ${isApply ? '应用写入' : 'dry-run 预览'}`)
  console.log()

  // 收集组件文件
  const componentFiles: string[] = []
  const levelsDirs = ['atoms', 'molecules', 'organisms', 'templates']
  for (const dir of levelsDirs) {
    const dirPath = join(COMPONENTS_DIR, dir)
    if (!existsSync(dirPath)) continue
    const files = walkDir(dirPath)
    for (const file of files) {
      if (extname(file) !== '.tsx' && extname(file) !== '.ts') continue
      if (shouldSkip(file)) continue
      if (file.endsWith('Registry.ts') || file.endsWith('registryTypes.ts')) continue
      componentFiles.push(file)
    }
  }

  const results: FixResult[] = []
  let fixed = 0
  let skipped = 0
  let errors = 0

  for (const filePath of componentFiles) {
    const relPath = relative(ROOT, filePath).replace(/\\/g, '/')
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch (e) {
      results.push({ file: relPath, action: 'error', reason: String(e) })
      errors++
      continue
    }

    // 跳过没有组件导出的文件
    if (!hasComponentExport(content)) {
      results.push({ file: relPath, action: 'skipped', reason: '无组件导出（可能是工具/类型文件）' })
      skipped++
      continue
    }

    const { insertAt, hasExistingFileoverview } = findInsertPoint(content)

    if (hasExistingFileoverview) {
      results.push({ file: relPath, action: 'skipped', reason: '已有 @fileoverview' })
      skipped++
      continue
    }

    if (insertAt < 0) {
      results.push({ file: relPath, action: 'skipped', reason: '无法确定插入位置' })
      skipped++
      continue
    }

    const newOverview = generateFileoverview(filePath, content)
    const newContent = content.substring(0, insertAt) + newOverview + '\n\n' + content.substring(insertAt)

    results.push({ file: relPath, action: 'added', addedOverview: newOverview })
    fixed++

    if (!isJson) {
      const level = detectLevel(filePath)
      console.log(`  📝 ${relPath} [${level}] → ${newOverview.split('\n')[1].trim()}`)
    }

    if (isApply) {
      try {
        writeFileSync(filePath, newContent, 'utf-8')
      } catch (e) {
        results[results.length - 1].action = 'error'
        results[results.length - 1].reason = String(e)
        errors++
        fixed--
      }
    }
  }

  // 输出
  if (isJson) {
    mkdirSync(join(ROOT, 'outputs'), { recursive: true })
    const report: FixReport = {
      timestamp: new Date().toISOString(),
      mode: isApply ? 'applied' : 'dry-run',
      totalScanned: componentFiles.length,
      totalFixed: fixed,
      totalSkipped: skipped,
      totalErrors: errors,
      results,
    }
    const outputPath = join(ROOT, 'outputs', 'fix-fileoverview.json')
    writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log('\n────────────────────────────────────────────')
    console.log(`摘要:`)
    console.log(`  扫描文件: ${componentFiles.length}`)
    console.log(`  补充 @fileoverview: ${fixed}`)
    console.log(`  跳过: ${skipped}`)
    console.log(`  错误: ${errors}`)
    console.log(`  模式: ${isApply ? '已应用' : '预览（使用 --apply 实际写入）'}`)
    console.log('────────────────────────────────────────────')
  }

  process.exit(errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('❌ fix-fileoverview 执行异常:', e)
  process.exit(2)
})