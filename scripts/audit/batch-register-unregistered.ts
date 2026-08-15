#!/usr/bin/env tsx
/**
 * batch-register-unregistered.ts
 * 批量将 audit:registry 反向检查发现的未注册文件补全到注册表
 *
 * 用法: npx tsx scripts/audit/batch-register-unregistered.ts [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..', '..')
const srcDir = join(rootDir, 'src')
const componentsDir = join(srcDir, 'components')

const DRY_RUN = process.argv.includes('--dry-run')

// ── 待注册文件清单 ──
interface TargetFile {
  path: string
  level: 'atom' | 'molecule' | 'organism' | 'template' | 'service'
  suggestedName?: string
  description?: string
}

const TARGET_FILES: TargetFile[] = [
  // ── Molecule 层 ──
  { path: 'src/components/molecules/ErrorState.tsx', level: 'molecule', suggestedName: 'GlobalErrorState', description: '全局错误状态展示（内联/卡片/全屏，支持重试）' },
  { path: 'src/components/molecules/FilterChip.tsx', level: 'molecule', description: '筛选条件芯片' },
  { path: 'src/components/molecules/FormField.tsx', level: 'molecule', description: '表单字段（标签 + 控件 + 验证提示）' },
  { path: 'src/components/molecules/SearchBar.tsx', level: 'molecule', description: '搜索栏' },

  // ── Organism 层（Cabin 域） ──
  { path: 'src/components/cabin/ScoreHistoryTable.tsx', level: 'organism', description: '评分历史表格' },
  { path: 'src/components/cabin/ScoreItem.tsx', level: 'organism', description: '评分项' },
  { path: 'src/components/cabin/ScoreSnapshot.tsx', level: 'organism', description: '评分快照' },
  { path: 'src/components/cabin/ScoreSummary.tsx', level: 'organism', description: '评分摘要' },

  // ── Organism 层（Chart 域） ──
  { path: 'src/components/chart/industry/IndustryV4Panel.tsx', level: 'organism', description: '行业 V4 复合面板' },
  { path: 'src/components/chart/industry/TrendLineChart.tsx', level: 'organism', suggestedName: 'TrendLineChart', description: '行业通用折线图' },
  { path: 'src/components/chart/industry/ValuationDistribution.tsx', level: 'organism', suggestedName: 'ValuationDistribution', description: '估值分布图' },
  { path: 'src/components/chart/MultiPaneChart.tsx', level: 'organism', suggestedName: 'MultiPaneChart', description: '多面板图表' },

  // ── Organism 层（Cockpit 域） ──
  { path: 'src/components/cockpit/DensityToggle.tsx', level: 'organism', description: '密度切换开关' },
  { path: 'src/components/cockpit/SecurityStatus.tsx', level: 'organism', description: '安全状态指示器' },

  // ── Service 层 ──
  { path: 'src/services/trading/watchlistMoversService.ts', level: 'service', suggestedName: 'WatchlistMovers', description: '自选股异动计算服务' },
]

// ── 注册表文件路径 ──
const REGISTRY_PATHS: Record<string, string> = {
  atom: join(componentsDir, 'registry', 'atomRegistry.ts'),
  molecule: join(componentsDir, 'registry', 'moleculeRegistry.ts'),
  organism: join(componentsDir, 'registry', 'organismRegistry.ts'),
  template: join(componentsDir, 'registry', 'templateRegistry.ts'),
  service: join(srcDir, 'services', 'serviceRegistry.ts'),
}

// ── 从文件内容提取主组件名 ──
function extractExportName(filePath: string, level: string): string | null {
  if (!existsSync(filePath)) return null
  const src = readFileSync(filePath, 'utf-8')

  // Service 文件：优先查找主导出函数
  if (level === 'service') {
    const servicePatterns = [
      /export\s+(?:const|function)\s+(\w*[Mm]over\w*|\w*[Ss]ervice\w*|\w+)\s*(?:=|\()/m,
      /export\s+(?:const|function)\s+(\w+)\s*(?:=|\()/m,
    ]
    for (const p of servicePatterns) {
      const m = src.match(p)
      if (m && !m[1].startsWith('DEFAULT_') && !m[1].startsWith('SERVICE_')) return m[1]
    }
    return basename(filePath).replace(/\.(tsx?|jsx?)$/, '')
  }

  // 优先：export default XxxMemo → 提取原始组件名
  const defaultMatch = src.match(/export\s+default\s+(\w+)/)
  if (defaultMatch) {
    const name = defaultMatch[1]
    if (name.endsWith('Memo')) return name.slice(0, -4)
    if (name.endsWith('Component')) return name.slice(0, -9)
    return name
  }

  // 其次：export const XxxMemo / Xxx = ...
  const constPatterns = [
    /export\s+const\s+(\w+Memo)\s*=/m,
    /export\s+const\s+(\w+Component)\s*=/m,
    /export\s+const\s+(\w+)\s*=\s*(?:memo|forwardRef|React\.)/m,
    /export\s+const\s+(\w+)\s*=/m,
  ]
  for (const p of constPatterns) {
    const m = src.match(p)
    if (m) {
      let name = m[1]
      if (name.endsWith('Memo')) name = name.slice(0, -4)
      if (name.endsWith('Component')) name = name.slice(0, -9)
      return name
    }
  }

  // 然后：export function Xxx
  const funcMatch = src.match(/export\s+function\s+(\w+)\s*\(/m)
  if (funcMatch) return funcMatch[1]

  // 最后：export class Xxx
  const classMatch = src.match(/export\s+class\s+(\w+)\s/m)
  if (classMatch) return classMatch[1]

  return basename(filePath).replace(/\.(tsx?|jsx?)$/, '')
}

// ── 生成 registry entry 行 ──
function generateEntry(file: TargetFile): { line: string; identifier: string } | null {
  const absPath = join(rootDir, file.path)
  if (!existsSync(absPath)) {
    console.warn(`  ⚠️  文件不存在: ${file.path}`)
    return null
  }

  const exportName = extractExportName(absPath, file.level)
  const name = file.suggestedName || exportName || basename(file.path).replace(/\.(tsx?|jsx?)$/, '')

  if (file.level === 'service') {
    const serviceId = name.endsWith('Service') ? name : name + 'Service'
    const relPath = file.path.replace(/\.tsx?$/, '')
    const line = `  { id: '${serviceId}', filePath: '${relPath}', status: 'active' },`
    return { line, identifier: serviceId }
  }

  const consumers = findConsumers(file.path, name)
  const consumersStr = consumers.length > 0
    ? consumers.map((c) => `'${c}'`).join(', ')
    : `'TBD - pending integration'`

  const line = `  { name: '${name}', level: '${file.level}', sourcePath: '${file.path}', targetPath: '${file.path}', status: 'active', description: '${file.description || name}', consumers: [${consumersStr}] },`
  return { line, identifier: name }
}

// ── 查找消费方（简化版） ──
function findConsumers(fileRelPath: string, componentName: string): string[] {
  const consumers = new Set<string>()
  const fileBase = basename(fileRelPath).replace(/\.(tsx?)$/, '')
  const importRel = fileRelPath.replace(/\.(tsx?)$/, '').replace(/\/index$/, '')

  function scanDir(dir: string) {
    let entries: any[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(full)
      } else if (/\.(tsx?)$/.test(entry.name)) {
        if (entry.name.endsWith('.test.tsx') || entry.name.endsWith('.spec.tsx')) continue
        if (relative(rootDir, full).replace(/\\/g, '/') === fileRelPath) continue
        try {
          const content = readFileSync(full, 'utf-8')
          // 检查是否 import 了目标组件
          const importPattern = new RegExp(`from\\s*['"][^'"]*${importRel}[^'"]*['"]`)
          if (importPattern.test(content)) {
            const nameMatch = content.match(/export\s+(?:const|function)\s+(\w+)/)
            consumers.add(nameMatch ? nameMatch[1] : basename(full).replace(/\.(tsx?)$/, ''))
          }
        } catch {
          // skip
        }
      }
    }
  }

  scanDir(componentsDir)
  return Array.from(consumers)
}

// ── 插入 registry entry ──
function insertEntry(registryPath: string, entryLine: string, identifier: string, level: string): void {
  if (!existsSync(registryPath)) {
    console.error(`  ❌ 注册表不存在: ${basename(registryPath)}`)
    return
  }

  let content = readFileSync(registryPath, 'utf-8')

  // 检查是否已存在
  if (content.includes(identifier)) {
    console.log(`  ⏭️  已存在，跳过: ${identifier}`)
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] 将添加到 ${basename(registryPath)}: ${identifier}`)
    return
  }

  const lines = content.split('\n')
  let insertAt = -1

  if (level === 'service') {
    // Service：在最后一个有效条目后插入（在 ] 之前）
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('{ id: ')) {
        insertAt = i + 1
        break
      }
    }
    if (insertAt < 0) {
      const bracketIdx = lines.findIndex((l) => l.trim() === ']')
      insertAt = bracketIdx >= 0 ? bracketIdx : lines.length - 1
    }
  } else {
    // Component：在最后一个同级 level 条目后插入
    let lastLevelIdx = -1
    for (let i = 0; i < lines.length; i++) {
      const levelMatch = lines[i].match(/level:\s*'(\w+)'/)
      if (levelMatch && levelMatch[1] === level) {
        lastLevelIdx = i
      }
    }

    if (lastLevelIdx >= 0) {
      // 找到这个条目的结束位置
      let endIdx = lastLevelIdx
      let depth = 0
      let seenBrace = false
      for (let i = lastLevelIdx; i < lines.length; i++) {
        const l = lines[i]
        const opens = (l.match(/\{/g) || []).length
        const closes = (l.match(/\}/g) || []).length
        depth += opens - closes
        if (opens > 0) seenBrace = true
        if (seenBrace && depth <= 0) {
          endIdx = i
          break
        }
      }
      insertAt = endIdx + 1
    } else {
      // 在数组结束前插入
      const bracketIdx = lines.findIndex((l) => l.trim().startsWith(']'))
      insertAt = bracketIdx >= 0 ? bracketIdx : lines.length - 1
    }
  }

  lines.splice(insertAt, 0, entryLine)
  content = lines.join('\n')
  writeFileSync(registryPath, content)
  console.log(`  ✅ 已添加: ${identifier}`)
}

// ── 主流程 ──
console.log('═══════════════════════════════════════════════════════')
console.log('批量注册未注册文件 → 对应注册表')
if (DRY_RUN) console.log('（DRY-RUN 模式）')
console.log('═══════════════════════════════════════════════════════')

const grouped: Record<string, TargetFile[]> = {}
for (const file of TARGET_FILES) {
  const regPath = REGISTRY_PATHS[file.level]
  if (!grouped[regPath]) grouped[regPath] = []
  grouped[regPath].push(file)
}

let successCount = 0
let skipCount = 0

for (const [regPath, files] of Object.entries(grouped)) {
  console.log(`\n📁 ${relative(rootDir, regPath)}`)

  for (const file of files) {
    const result = generateEntry(file)
    if (!result) continue
    const { line, identifier } = result

    const existing = readFileSync(regPath, 'utf-8')
    if (existing.includes(identifier)) {
      console.log(`  ⏭️  已存在，跳过: ${identifier}`)
      skipCount++
      continue
    }

    console.log(`  ➕ ${file.path} → ${identifier}`)
    insertEntry(regPath, line, identifier, file.level)
    successCount++
  }
}

console.log(`\n═══════════════════════════════════════════════════════`)
console.log(`完成：新增 ${successCount} 个，跳过 ${skipCount} 个`)
if (DRY_RUN) console.log('💡 去掉 --dry-run 以实际写入')