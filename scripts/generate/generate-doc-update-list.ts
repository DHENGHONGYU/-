#!/usr/bin/env tsx

import { join, dirname } from 'node:path'
import { safeWriteFileSync } from '../../src/lib/safeFs'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const ROOT = dirname(__filename).replace(/[\\/]scripts$/, '')
const DOCS_DIR = join(ROOT, 'docs')

interface SemanticFinding {
  file: string
  symbolName: string
  symbolType: 'interface' | 'function' | 'type' | 'class'
  missingSemantics: string[]
  matchedSemantics: string[]
}

interface SemanticReport {
  timestamp: string
  totalFiles: number
  totalViolations: number
  scanMode: 'changed' | 'all'
  findings: SemanticFinding[]
  summary: {
    totalSymbols: number
    matchedSymbols: number
    missingSymbols: number
    coverageRate: number
  }
}

interface SymbolGroup {
  category: string
  symbols: SemanticFinding[]
}

function groupByCategory(findings: SemanticFinding[]): SymbolGroup[] {
  const groups: Record<string, SemanticFinding[]> = {}

  for (const finding of findings) {
    const filePath = finding.file
    let category = '其他'
    
    if (filePath.startsWith('src/core/')) {
      category = '核心层 (core)'
    } else if (filePath.startsWith('src/services/')) {
      const match = filePath.match(/src\/services\/([^/]+)/)
      category = match ? `服务层 - ${match[1]}` : '服务层 (services)'
    } else if (filePath.startsWith('src/store/')) {
      category = '状态层 (store)'
    } else if (filePath.startsWith('src/lib/')) {
      category = '库函数层 (lib)'
    } else if (filePath.startsWith('src/types/')) {
      category = '类型定义层 (types)'
    } else if (filePath.startsWith('src/components/')) {
      category = '组件层 (components)'
    } else if (filePath.startsWith('src/pages/')) {
      category = '页面层 (pages)'
    } else if (filePath.startsWith('src/config/')) {
      category = '配置层 (config)'
    } else if (filePath.startsWith('src/constants/')) {
      category = '常量层 (constants)'
    }

    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(finding)
  }

  return Object.entries(groups)
    .map(([category, symbols]) => ({ category, symbols }))
    .sort((a, b) => b.symbols.length - a.symbols.length)
}

function generateDocUpdateList(report: SemanticReport): string {
  const groups = groupByCategory(report.findings)
  
  let output = `# 文档更新清单

> 生成时间: ${new Date().toISOString()}
> 扫描模式: ${report.scanMode === 'changed' ? '仅变更文件' : '全部文件'}
> 总符号数: ${report.summary.totalSymbols}
> 缺失符号数: ${report.summary.missingSymbols}
> 覆盖率: ${report.summary.coverageRate}%

---

## 概述

本清单列出了代码中所有缺失文档覆盖的符号，按模块分类整理，便于文档维护者逐步补充。

---

## 更新统计

| 模块 | 符号数量 | 需要补充说明 |
|------|---------|-------------|
${groups.map(g => `| ${g.category} | ${g.symbols.length} | ${g.symbols.reduce((sum, s) => sum + s.missingSemantics.length, 0)} |`).join('\n')}

---

## 详细清单

`

  for (const group of groups) {
    output += `### ${group.category}

| 符号名 | 类型 | 文件路径 | 缺失项数 |
|--------|------|---------|---------|
${group.symbols.map(s => `| \`${s.symbolName}\` | ${s.symbolType} | \`${s.file}\` | ${s.missingSemantics.length} |`).join('\n')}

`
    for (const symbol of group.symbols) {
      const propertyNames = symbol.missingSemantics
        .filter(s => s.startsWith('prop_') && s !== symbol.symbolName)
        .map(s => s.replace(/^prop_/, ''))
      const methodNames = symbol.missingSemantics
        .filter(s => s.startsWith('method_') && s !== symbol.symbolName)
        .map(s => s.replace(/^method_/, ''))
      const otherNames = symbol.missingSemantics
        .filter(s => !s.startsWith('prop_') && !s.startsWith('method_') && s !== symbol.symbolName)

      output += `#### \`${symbol.symbolName}\`

**类型**: ${symbol.symbolType}
**位置**: \`${symbol.file}\`

`
      
      if (propertyNames.length > 0) {
        output += `**需要补充的属性**:
${propertyNames.map(p => `- [ ] \`${p}\` - [类型] - [描述]`).join('\n')}

`
      }
      
      if (methodNames.length > 0) {
        output += `**需要补充的方法**:
${methodNames.map(m => `- [ ] \`${m}()\` - [返回类型] - [描述]`).join('\n')}

`
      }
      
      if (otherNames.length > 0) {
        output += `**需要补充的其他语义**:
${otherNames.map(o => `- [ ] \`${o}\` - [描述]`).join('\n')}

`
      }
    }
  }

  return output
}

function generateMarkdownExport(report: SemanticReport): string {
  let output = `# API 文档草稿

> 生成时间: ${new Date().toISOString()}
> 扫描模式: ${report.scanMode === 'changed' ? '仅变更文件' : '全部文件'}

---

`

  for (const finding of report.findings) {
    const propertyNames = finding.missingSemantics
      .filter(s => s.startsWith('prop_') && s !== finding.symbolName)
      .map(s => s.replace(/^prop_/, ''))
    const methodNames = finding.missingSemantics
      .filter(s => s.startsWith('method_') && s !== finding.symbolName)
      .map(s => s.replace(/^method_/, ''))
    const otherNames = finding.missingSemantics
      .filter(s => !s.startsWith('prop_') && !s.startsWith('method_') && s !== finding.symbolName)

    output += `## ${finding.symbolName}

**类型**: ${finding.symbolType}

**位置**: \`${finding.file}\`

**描述**: TODO: 补充该${finding.symbolType}的用途和设计意图说明

`

    if (finding.symbolType === 'class') {
      if (propertyNames.length > 0) {
        output += `### 属性说明

| 属性名 | 类型 | 描述 |
|--------|------|------|
${propertyNames.map(p => `| \`${p}\` | TODO | TODO |`).join('\n')}

`
      }
      
      if (methodNames.length > 0) {
        output += `### 方法说明

| 方法名 | 返回类型 | 描述 |
|--------|---------|------|
${methodNames.map(m => `| \`${m}()\` | TODO | TODO |`).join('\n')}

`
      }
    } else if (finding.symbolType === 'interface') {
      if (otherNames.length > 0) {
        output += `### 字段说明

| 字段名 | 类型 | 描述 |
|--------|------|------|
${otherNames.map(o => `| \`${o}\` | TODO | TODO |`).join('\n')}

`
      }
    } else if (finding.symbolType === 'function') {
      output += `### 参数说明

| 参数名 | 类型 | 描述 |
|--------|------|------|
TODO: 列出参数及其类型和用途

### 返回值

| 类型 | 描述 |
|------|------|
TODO: 说明返回值类型和含义

`
    }

    output += `### 使用示例

\`\`\`typescript
// TODO: 添加使用示例
\`\`\`

---

`
  }

  return output
}

function main() {
  console.log('开始全量扫描...')
  
  const output = execSync(
    'npx tsx scripts/semantic-validation.ts --all --json --quiet',
    { cwd: ROOT, encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 }
  )
  
  let report: SemanticReport
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      report = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('无法解析 JSON 输出')
    }
  } catch (e) {
    console.error('解析扫描结果失败:', e)
    return
  }
  
  console.log(`扫描完成，发现 ${report.findings.length} 个缺失语义的符号`)
  console.log(`总符号数: ${report.summary.totalSymbols}, 覆盖率: ${report.summary.coverageRate}%`)

  const listContent = generateDocUpdateList(report)
  const listPath = join(DOCS_DIR, 'drafts', `doc-update-list-${new Date().toISOString().replace(/[:.]/g, '-')}.md`)
  safeWriteFileSync(listPath, listContent)
  console.log(`文档更新清单已写入: ${listPath}`)

  const mdContent = generateMarkdownExport(report)
  const mdPath = join(DOCS_DIR, 'drafts', `api-doc-draft-${new Date().toISOString().replace(/[:.]/g, '-')}.md`)
  safeWriteFileSync(mdPath, mdContent)
  console.log(`Markdown 导出文件已写入: ${mdPath}`)

  const recentFiles = report.findings
    .filter(f => f.file.includes('dataflow') || f.file.includes('databridge') || f.file.includes('mcp'))
    .slice(0, 20)
  
  console.log('\n最近关注的模块（dataflow/databridge/mcp）:')
  recentFiles.forEach(f => {
    console.log(`  - ${f.symbolType} ${f.symbolName} (${f.file})`)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
