#!/usr/bin/env tsx
/**
 * @module scripts/llm-doc-generator
 * @description LLM 辅助文档更新生成器
 *
 * 基于语义级校验结果，利用 LLM 自动生成文档更新建议
 * - 输入：语义校验报告（缺失的语义信息）
 * - 处理：调用 LLM 生成结构化 Markdown 文档片段
 * - 输出：草稿文件（docs/drafts/doc-update-suggestion-{timestamp}.md）
 *
 * 安全保障：
 * - 仅生成草稿，不直接修改正式文档
 * - LLM 输出严格解析和清洗
 * - 去重机制避免重复内容
 * - API 不可用时优雅降级为模板生成
 *
 * 用法：
 *   npx tsx scripts/llm-doc-generator.ts [--scan-all] [--force]
/**
 * @file llm-doc-generator.ts
 * @description 基于语义校验结果，利用 LLM 自动生成文档更新建议草稿
 * @status 孤立脚本（未在 package.json 中引用）
 * @category 数据处理/分析 — 评估后接入
 * @maintainer 待定
 * @lastVerified 2026-07-13
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chat, LlmApiError } from '@/services/llm/llmClient'
import type { LlmMessage } from '@/services/llm/llmTypes'
import { getDefaultLlmConfig, isLlmConfigured, getLlmApiKeyAsync } from '@/config/llmConfig'
import { scan, type SemanticReport, type SemanticFinding } from './semantic-validation'

const __filename = fileURLToPath(import.meta.url)
const ROOT = dirname(__filename).replace(/[\\/]scripts$/, '')
const DOCS_DIR = join(ROOT, 'docs')
const DRAFTS_DIR = join(DOCS_DIR, 'drafts')

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
} as const

const BATCH_SIZE = 10

interface DocUpdateSuggestion {
  timestamp: string
  sourceReport: string
  findings: SemanticFinding[]
  suggestedUpdates: Array<{
    docFile: string
    sectionTitle: string
    content: string
    confidence: 'high' | 'medium' | 'low'
  }>
  generatedByLlm: boolean
}

function ensureDraftsDir(): void {
  try {
    statSync(DRAFTS_DIR)
  } catch {
    mkdirSync(DRAFTS_DIR, { recursive: true })
  }
}

function getCodeFileContent(filePath: string): string {
  try {
    return readFileSync(join(ROOT, filePath), 'utf-8')
  } catch {
    return ''
  }
}

function buildPrompt(report: SemanticReport, findings?: SemanticFinding[]): string {
  const targetFindings = findings || report.findings
  console.info(`[LLMDocGenerator] 开始构建提示词，待处理发现数: ${targetFindings.length}`)
  
  const findingsSummary = targetFindings.map((finding, index) => {
    const codeContent = getCodeFileContent(finding.file).slice(0, 2000)
    console.debug(`[LLMDocGenerator] 处理发现 ${index + 1}/${targetFindings.length}: ${finding.symbolType} ${finding.symbolName}`)
    return `## 文件: ${finding.file}

**符号**: ${finding.symbolType} \`${finding.symbolName}\`

**缺失语义**: ${finding.missingSemantics.join(', ')}

**代码片段**:
\`\`\`typescript
${codeContent}
\`\`\`
`
  }).join('\n\n')

  const prompt = `你是一个专业的技术文档工程师，擅长为 TypeScript 项目生成高质量的 API 文档和代码说明。

请根据以下语义级校验结果，为缺失文档覆盖的代码符号生成结构化的文档更新建议。

## 校验结果

扫描模式: ${report.scanMode === 'changed' ? '仅变更文件' : '全部文件'}
总符号数: ${report.summary.totalSymbols}
缺失符号数: ${report.summary.missingSymbols}
覆盖率: ${report.summary.coverageRate}%

## 需要文档化的代码符号

${findingsSummary}

## 输出要求

请为每个缺失的符号生成以下格式的文档片段：

\`\`\`markdown
## [符号名]

**类型**: [interface/function/type/class]

**位置**: [文件路径]

**描述**: [简要说明该符号的用途和设计意图]

**字段/参数**:
- [字段名]: [类型] - [描述]

**返回值**: [类型] - [描述]（仅函数）

**示例**:
\`\`\`typescript
// 使用示例
\`\`\`
\`\`\`

注意事项：
1. 仅生成 Markdown 格式的文档内容
2. 不要包含任何解释性文字或对话
3. 保持描述简洁、专业
4. 对于接口，列出所有字段及其类型和用途
5. 对于函数，列出参数、返回值和使用示例
6. 如果无法确定用途，请根据代码上下文合理推断
`

  console.info(`[LLMDocGenerator] 提示词构建完成，长度: ${prompt.length} 字符`)
  return prompt
}

async function generateBatchWithLlm(report: SemanticReport, findings: SemanticFinding[], batchIndex: number, totalBatches: number): Promise<string> {
  const config = getDefaultLlmConfig()
  
  const apiKey = await getLlmApiKeyAsync()
  if (!apiKey) {
    throw new Error('LLM API key not set')
  }

  config.apiKey = apiKey
  const prompt = buildPrompt(report, findings)
  console.info(`[LLMDocGenerator] 批次 ${batchIndex}/${totalBatches} 提示词长度: ${prompt.length} 字符`)

  const messages: LlmMessage[] = [
    { role: 'system', content: '你是一个专业的技术文档工程师，擅长为 TypeScript 项目生成高质量的 API 文档和代码说明。输出格式严格遵循 Markdown。' },
    { role: 'user', content: prompt },
  ]

  console.log(`${C.cyan}🔄 正在调用 LLM (批次 ${batchIndex}/${totalBatches})...${C.reset}`)

  try {
    const response = await chat(messages, {
      baseURL: config.baseURL,
      apiKey,
      model: config.model,
      temperature: 0.3,
      maxTokens: 8000,
    })

    console.log(`${C.green}✅ LLM 批次 ${batchIndex}/${totalBatches} 生成完成${C.reset}`)
    console.log(`${C.dim}Token 使用: ${response.usage?.totalTokens || '未知'}${C.reset}`)
    console.info(`[LLMDocGenerator] LLM 返回内容长度: ${response.content.length} 字符`)

    return response.content
  } catch (err) {
    if (err instanceof LlmApiError) {
      console.warn(`${C.yellow}⚠️ LLM 批次 ${batchIndex}/${totalBatches} 调用失败: ${err.message}${C.reset}`)
    } else {
      console.warn(`${C.yellow}⚠️ LLM 批次 ${batchIndex}/${totalBatches} 调用异常: ${String(err)}${C.reset}`)
    }
    throw err
  }
}

async function generateWithLlm(report: SemanticReport): Promise<string> {
  const config = getDefaultLlmConfig()
  console.info(`[LLMDocGenerator] LLM 配置: baseURL=${config.baseURL}, model=${config.model}`)
  
  if (!isLlmConfigured(config)) {
    console.warn(`${C.yellow}⚠️ LLM 未配置，跳过 LLM 生成${C.reset}`)
    throw new Error('LLM not configured')
  }

  const apiKey = await getLlmApiKeyAsync()
  console.info(`[LLMDocGenerator] API Key 状态: ${apiKey ? '已设置' : '未设置'}`)
  
  if (!apiKey) {
    console.warn(`${C.yellow}⚠️ LLM API Key 未设置，跳过 LLM 生成${C.reset}`)
    throw new Error('LLM API key not set')
  }

  const totalFindings = report.findings.length
  
  if (totalFindings <= BATCH_SIZE) {
    console.info(`[LLMDocGenerator] 发现数 ${totalFindings} <= 批次大小 ${BATCH_SIZE}，使用单次调用`)
    return generateBatchWithLlm(report, report.findings, 1, 1)
  }

  const totalBatches = Math.ceil(totalFindings / BATCH_SIZE)
  console.info(`[LLMDocGenerator] 发现数 ${totalFindings} > 批次大小 ${BATCH_SIZE}，启用分批处理，共 ${totalBatches} 批次`)

  const results: string[] = []
  
  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, totalFindings)
    const batchFindings = report.findings.slice(start, end)
    
    console.info(`[LLMDocGenerator] 处理批次 ${i + 1}/${totalBatches}，包含 ${batchFindings.length} 个发现`)
    
    const batchResult = await generateBatchWithLlm(report, batchFindings, i + 1, totalBatches)
    results.push(batchResult)
  }

  console.info(`[LLMDocGenerator] 所有 ${totalBatches} 批次处理完成`)
  return results.join('\n\n---\n\n')
}

export function generateWithFallback(report: SemanticReport): string {
  console.log(`${C.yellow}📋 使用模板模式生成文档更新建议${C.reset}`)
  console.time('[LLMDocGenerator] 模板生成总耗时')

  let output = `# 文档更新建议（模板生成）

> 生成时间: ${new Date().toISOString()}
> 扫描模式: ${report.scanMode === 'changed' ? '仅变更文件' : '全部文件'}
> 总符号数: ${report.summary.totalSymbols} | 缺失符号数: ${report.summary.missingSymbols}

---

`

  for (let i = 0; i < report.findings.length; i++) {
    const finding = report.findings[i]
    console.time(`[LLMDocGenerator] 处理 ${finding.symbolType} ${finding.symbolName}`)
    
    const displaySemantics = finding.missingSemantics.map(s => {
      if (s.startsWith('prop_')) return s.replace(/^prop_/, '')
      if (s.startsWith('method_')) return s.replace(/^method_/, '')
      return s
    })
    
    output += `## ${finding.symbolName}

**类型**: ${finding.symbolType}

**位置**: \`${finding.file}\`

**缺失语义**: ${displaySemantics.join(', ')}

**描述**: 需要补充该${finding.symbolType}的用途和设计意图说明

`

    if (finding.symbolType === 'interface') {
      output += `**字段说明**:
\`\`\`typescript
// TODO: 列出所有字段及其类型和用途
\`\`\`

`
    } else if (finding.symbolType === 'function') {
      output += `**参数说明**:
\`\`\`typescript
// TODO: 列出参数及其类型和用途
\`\`\`

**返回值**:
\`\`\`typescript
// TODO: 说明返回值类型和含义
\`\`\`

**使用示例**:
\`\`\`typescript
// TODO: 添加使用示例
\`\`\`

`
    } else if (finding.symbolType === 'class') {
      const propertyNames = finding.missingSemantics
        .filter(s => s.startsWith('prop_') && s !== finding.symbolName)
        .map(s => s.replace(/^prop_/, ''))
      const methodNames = finding.missingSemantics
        .filter(s => s.startsWith('method_') && s !== finding.symbolName)
        .map(s => s.replace(/^method_/, ''))
      
      console.debug(`[LLMDocGenerator] ${finding.symbolName}: ${propertyNames.length} 个属性, ${methodNames.length} 个方法`)
      
      output += `**属性说明**:
\`\`\`typescript
${propertyNames.map(p => `// ${p}: [类型] - [描述]`).join('\n') || '// TODO: 列出所有属性及其类型和用途'}
\`\`\`

**方法说明**:
\`\`\`typescript
${methodNames.map(m => `// ${m}(): [返回类型] - [描述]`).join('\n') || '// TODO: 列出所有方法及其返回类型和用途'}
\`\`\`

**使用示例**:
\`\`\`typescript
// TODO: 添加使用示例
\`\`\`

`
    } else if (finding.symbolType === 'type') {
      const members = finding.missingSemantics.filter(s => s !== finding.symbolName)
      output += `**类型成员**:
\`\`\`typescript
${members.map(m => `// ${m}: [描述]`).join('\n') || '// TODO: 列出所有类型成员及其描述'}
\`\`\`

`
    }

    output += `---

`
    console.timeEnd(`[LLMDocGenerator] 处理 ${finding.symbolType} ${finding.symbolName}`)
  }

  console.timeEnd('[LLMDocGenerator] 模板生成总耗时')
  return output
}

export function cleanAndValidateOutput(content: string): string {
  console.info(`[LLMDocGenerator] 开始清洗和验证输出，原始长度: ${content.length} 字符`)
  
  let cleaned = content.trim()

  cleaned = cleaned.replace(/```markdown\n?/g, '')
  cleaned = cleaned.replace(/\n?```$/g, '')

  const seenSections = new Set<string>()
  const lines = cleaned.split('\n')
  const result: string[] = []
  let skippedSections = 0

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)$/)
    if (sectionMatch) {
      const sectionKey = sectionMatch[1].trim()
      if (seenSections.has(sectionKey)) {
        skippedSections++
        continue
      }
      seenSections.add(sectionKey)
    }
    result.push(line)
  }

  console.info(`[LLMDocGenerator] 清洗完成，清洗后长度: ${result.join('\n').length} 字符，跳过重复章节: ${skippedSections} 个`)
  return result.join('\n')
}

export function writeDraft(content: string, generatedByLlm: boolean): string {
  ensureDraftsDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `doc-update-suggestion-${timestamp}.md`
  const filePath = join(DRAFTS_DIR, filename)
  const fullContentLength = content.length

  const header = `# 文档更新建议草稿

> 生成时间: ${new Date().toISOString()}
> 生成方式: ${generatedByLlm ? 'LLM 辅助生成' : '模板生成（LLM 不可用）'}
> 状态: 待人工审核

---

**⚠️ 重要提示**: 此文件为自动生成的草稿，需人工审核后再合并到正式文档中。

---

`

  writeFileSync(filePath, header + content, 'utf-8')

  console.info(`[LLMDocGenerator] 草稿文件已写入: ${filePath}`)
  console.info(`[LLMDocGenerator] 文档内容长度: ${fullContentLength} 字符`)

  return filePath
}

function formatSummary(report: SemanticReport, draftPath: string, generatedByLlm: boolean): string {
  let output = `\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}\n`
  output += `${C.bold}${C.cyan}║  LLM 文档更新生成器 — llm-doc-generator.ts              ║${C.reset}\n`
  output += `${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}\n\n`

  output += `${C.bold}扫描结果:${C.reset}\n`
  output += `  扫描模式: ${report.scanMode === 'changed' ? '仅变更文件' : '全部文件'}\n`
  output += `  总符号数: ${report.summary.totalSymbols}\n`
  output += `${C.green}  已匹配: ${report.summary.matchedSymbols}${C.reset}\n`
  output += `${C.red}  缺失: ${report.summary.missingSymbols}${C.reset}\n`
  output += `  覆盖率: ${report.summary.coverageRate}%\n\n`

  output += `${C.bold}生成方式:${C.reset} ${generatedByLlm ? `${C.green}LLM 辅助生成${C.reset}` : `${C.yellow}模板生成（LLM 不可用）${C.reset}`}\n\n`

  output += `${C.bold}输出文件:${C.reset}\n`
  output += `  ${C.cyan}${draftPath}${C.reset}\n\n`

  output += `${C.bold}使用建议:${C.reset}\n`
  output += `  1. 打开草稿文件查看生成的文档片段\n`
  output += `  2. 人工审核内容准确性和格式\n`
  output += `  3. 将合适的内容合并到对应的正式文档中\n`
  output += `  4. 删除草稿文件或保留作为历史记录\n`

  return output
}

export function testGenerateWithFallback(findings: SemanticFinding[], scanMode: 'changed' | 'all' = 'all'): string {
  const mockReport: SemanticReport = {
    timestamp: new Date().toISOString(),
    totalFiles: 1,
    totalViolations: findings.length,
    scanMode,
    findings,
    summary: {
      totalSymbols: findings.length,
      matchedSymbols: 0,
      missingSymbols: findings.length,
      coverageRate: 0,
    },
  }
  return generateWithFallback(mockReport)
}

export async function main() {
  const args = process.argv.slice(2)
  const scanAll = args.includes('--scan-all')
  const force = args.includes('--force')

  console.log('')
  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║  LLM 文档更新生成器 — llm-doc-generator.ts              ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
  console.log('')

  try {
    const scanMode: 'changed' | 'all' = scanAll ? 'all' : 'changed'
    console.log(`${C.dim}正在进行语义级扫描（模式: ${scanMode}）...${C.reset}`)
    
    console.time('[LLMDocGenerator] 语义扫描耗时')
    const report = scan(scanMode)
    console.timeEnd('[LLMDocGenerator] 语义扫描耗时')

    console.info(`[LLMDocGenerator] 扫描完成，发现违规数: ${report.findings.length}`)

    if (report.findings.length === 0) {
      console.log(`${C.green}✅ 所有符号已在文档中体现，无需生成更新建议${C.reset}`)
      process.exit(0)
    }

    let content: string
    let generatedByLlm = false

    console.time('[LLMDocGenerator] 文档内容生成耗时')
    try {
      content = await generateWithLlm(report)
      generatedByLlm = true
    } catch {
      content = generateWithFallback(report)
      generatedByLlm = false
    }
    console.timeEnd('[LLMDocGenerator] 文档内容生成耗时')

    console.time('[LLMDocGenerator] 输出清洗和文件写入耗时')
    const cleanedContent = cleanAndValidateOutput(content)
    const draftPath = writeDraft(cleanedContent, generatedByLlm)
    console.timeEnd('[LLMDocGenerator] 输出清洗和文件写入耗时')

    console.log(formatSummary(report, draftPath, generatedByLlm))

    process.exit(0)
  } catch (error) {
    console.error(`${C.red}❌ 执行错误:${C.reset}`, error)
    console.error(`[LLMDocGenerator] 错误详情:`, error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
