/**
 * 组件复用审计脚本
 * v0.9.11 P2-CMP-002
 * 用途：检测单次使用的组件，识别可提升为公共组件的候选者
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, extname, basename } from 'path'

const PROJECT_ROOT = 'c:\\Users\\huawei\\Documents\\kimi\\Workspaces\\智能投研复盘系统V9'
const SRC_DIR = join(PROJECT_ROOT, 'src')
const COMPONENTS_DIR = join(SRC_DIR, 'components')

interface ComponentUsage {
  componentPath: string
  componentName: string
  relativePath: string
  importCount: number
  importers: ImporterInfo[]
  lines: number
}

interface ImporterInfo {
  filePath: string
  relativePath: string
  importLine: number
}

/**
 * 递归获取目录下的所有 TSX 文件
 */
function getTsxFiles(dir: string, results: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        getTsxFiles(fullPath, results)
      } else if (extname(entry.name) === '.tsx' || extname(entry.name) === '.ts') {
        results.push(fullPath)
      }
    }
  } catch (e) {
    // 忽略无法访问的目录
  }
  return results
}

/**
 * 统计文件行数
 */
function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

/**
 * 从文件名推断组件名
 */
function inferComponentName(filePath: string): string {
  const name = basename(filePath).replace(/\.(tsx|ts)$/, '')
  return name
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(/[\s_-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}

/**
 * 提取文件中的所有组件导入
 */
function extractComponentImports(filePath: string): Map<string, number> {
  const content = readFileSync(filePath, 'utf-8')
  const imports = new Map<string, number>()
  
  // 匹配多种导入模式
  const patterns = [
    // import { Xxx } from '@/components/...'
    /import\s+\{([^}]+)\}\s+from\s+['"]@\/components\/[^'"]+['"]/g,
    // import { Xxx } from '@/components/atoms/...'
    /import\s+\{([^}]+)\}\s+from\s+['"]@\/components\/ui\/[^'"]+['"]/g,
    // import Xxx from '@/components/...'
    /import\s+(\w+)\s+from\s+['"]@\/components\/[^'"]+['"]/g,
    // import * as Xxx from '@/components/...'
    /import\s+\*\s+as\s+(\w+)\s+from\s+['"]@\/components\/[^'"]+['"]/g,
  ]
  
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const pattern of patterns) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(line ?? '')) !== null) {
        const names = match[1]!?.split(',')?.map(n => n.trim().split(' as ')[0].trim())
        for (const name of names) {
          if (name && name !== '*') {
            imports.set(name, (imports.get(name) || 0) + 1)
          }
        }
      }
    }
  }
  
  return imports
}

/**
 * 扫描所有组件的使用情况
 */
function scanComponents(): ComponentUsage[] {
  const allFiles = getTsxFiles(SRC_DIR)
  
  // 收集所有导入关系
  const importMap = new Map<string, ImporterInfo[]>()
  
  for (const file of allFiles) {
    const imports = extractComponentImports(file)
    const relativeFilePath = file.replace(PROJECT_ROOT + '\\', '').replace(PROJECT_ROOT + '/', '')
    
    for (const [componentName] of imports) {
      if (!importMap.has(componentName)) {
        importMap.set(componentName, [])
      }
      importMap.get(componentName)!.push({
        filePath: file,
        relativePath: relativeFilePath,
        importLine: 0 // 简化版本，不追踪具体行号
      })
    }
  }
  
  // 获取所有组件文件
  const componentFiles = getTsxFiles(COMPONENTS_DIR)
  const results: ComponentUsage[] = []
  
  for (const file of componentFiles) {
    const componentName = inferComponentName(file)
    const importers = importMap.get(componentName) || []
    const lines = countLines(file)
    const relativePath = file.replace(PROJECT_ROOT + '\\', '').replace(PROJECT_ROOT + '/', '')
    
    results.push({
      componentPath: file,
      componentName,
      relativePath,
      importCount: importers.length,
      importers,
      lines
    })
  }
  
  // 也扫描 src/components 下的直接组件（不在 ui 子目录）
  const topLevelComponents = getTsxFiles(SRC_DIR + '\\components').filter(f => !f.includes('\\ui\\'))
  for (const file of topLevelComponents) {
    const componentName = inferComponentName(file)
    if (!results.find(r => r.componentName === componentName)) {
      const importers = importMap.get(componentName) || []
      const lines = countLines(file)
      const relativePath = file.replace(PROJECT_ROOT + '\\', '').replace(PROJECT_ROOT + '/', '')
      
      results.push({
        componentPath: file,
        componentName,
        relativePath,
        importCount: importers.length,
        importers,
        lines
      })
    }
  }
  
  return results
}

/**
 * 生成审计报告
 */
function generateReport(usages: ComponentUsage[]): string {
  const lines: string[] = []
  
  lines.push('=== 组件复用审计报告 ===')
  lines.push(`生成时间: ${new Date().toISOString()}`)
  lines.push(`版本: v0.9.11 P2-CMP-002\n`)
  
  lines.push(`\n总计组件: ${usages.length}`)
  
  const reusable = usages.filter(u => u.importCount >= 2)
  const singleUse = usages.filter(u => u.importCount === 1)
  const unused = usages.filter(u => u.importCount === 0)
  
  lines.push(`\n✅ 可复用组件 (≥2次): ${reusable.length}`)
  lines.push(`⚠️  单次使用组件: ${singleUse.length}`)
  lines.push(`❌ 未使用组件: ${unused.length}`)
  
  // 单次使用组件（建议审查）
  if (singleUse.length > 0) {
    lines.push('\n--- 单次使用组件 (建议审查) ---')
    for (const u of singleUse.slice(0, 30)) {
      lines.push(`  ${u.componentName} (${u.lines}行, ${u.importers[0]?.relativePath || 'self'})`)
    }
  }
  
  // 未使用组件
  if (unused.length > 0) {
    lines.push('\n--- 未使用组件 (建议删除或审查) ---')
    for (const u of unused.slice(0, 20)) {
      lines.push(`  ${u.componentName} (${u.lines}行) - ${u.relativePath}`)
    }
  }
  
  // 大组件分析 (>300行)
  const largeComponents = usages.filter(u => u.lines > 300)
  if (largeComponents.length > 0) {
    lines.push('\n--- 大组件分析 (>300行) ---')
    for (const u of largeComponents) {
      const status = u.importCount >= 2 ? '✅' : u.importCount === 1 ? '⚠️' : '❌'
      lines.push(`  ${status} ${u.componentName} (${u.lines}行, 使用${u.importCount}次)`)
    }
  }
  
  // 可复用性建议
  lines.push('\n--- 复用性建议 ---')
  const suggestions = analyzeSuggestions(singleUse, reusable)
  lines.push(...suggestions)
  
  return lines.join('\n')
}

/**
 * 分析复用建议
 */
function analyzeSuggestions(singleUse: ComponentUsage[], reusable: ComponentUsage[]): string[] {
  const suggestions: string[] = []
  
  suggestions.push('\n1. 单次使用组件优化建议:')
  if (singleUse.length === 0) {
    suggestions.push('   - 所有组件均被多次使用，复用性良好')
  } else {
    suggestions.push(`   - 发现 ${singleUse.length} 个单次使用组件`)
    suggestions.push('   - 建议审查这些组件是否可以合并到使用方')
    suggestions.push('   - 或考虑是否存在其他页面也需要类似功能')
  }
  
  suggestions.push('\n2. 大组件拆分建议:')
  const largeSingleUse = singleUse.filter(u => u.lines > 200)
  if (largeSingleUse.length > 0) {
    suggestions.push('   - 以下组件过大且使用次数少，建议拆分:')
    for (const u of largeSingleUse) {
      suggestions.push(`     * ${u.componentName} (${u.lines}行) - ${u.relativePath}`)
    }
  } else {
    suggestions.push('   - 未发现需要立即拆分的大组件')
  }
  
  return suggestions
}

function main() {
  console.log('开始扫描组件...\n')
  
  const usages = scanComponents()
  const report = generateReport(usages)
  
  console.log(report)
  
  // 保存报告
  const reportPath = join(PROJECT_ROOT, 'scripts', 'component-audit-report.txt')
  writeFileSync(reportPath, report, 'utf-8')
  console.log(`\n报告已保存到: ${reportPath}`)
  
  // 保存 JSON 数据
  const jsonPath = join(PROJECT_ROOT, 'scripts', 'component-audit-data.json')
  writeFileSync(jsonPath, JSON.stringify(usages, null, 2), 'utf-8')
  console.log(`JSON 数据已保存到: ${jsonPath}`)
}

main()
