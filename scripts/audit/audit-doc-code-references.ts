#!/usr/bin/env node
/**
 * @module scripts/audit-doc-code-references
 * @description 文档-代码引用验证审计（CLI 包装）
 *
 * 三类交叉引用检查（doc-to-code / code-to-doc / doc-to-doc）的扫描与校验逻辑
 * 已抽离至 scripts/docs-tool/cross-ref-engine.ts（单一事实源），本文件仅负责
 * 全仓库遍历编排、报告打印与 JSON 持久化。
 *
 * 用法：
 *   npx tsx scripts/audit/audit-doc-code-references.ts
 * 退出码：0=无断裂, 1=有断裂/执行错误
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  runFullAudit,
  type AuditResult,
  type Reference,
} from '../docs-tool/cross-ref-engine'

const __filename = new URL(import.meta.url).pathname
const __dirname = dirname(__filename).replace(/^\/([A-Z]:)/, '$1')
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const DOCS_DIR = join(PROJECT_ROOT, 'docs')
const SRC_DIR = join(PROJECT_ROOT, 'src')
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts')
const REGISTRY_INDEX = join(DOCS_DIR, '00-meta', 'registry-index.md')
const REPORTS_DIR = join(PROJECT_ROOT, 'scripts', 'docs', 'reports', 'audit')

function audit(): AuditResult {
  return runFullAudit(PROJECT_ROOT)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function printReport(result: AuditResult, maxBrokenRate: number): void {
  console.log('\n' + '='.repeat(70))
  console.log('文档-代码引用验证审计报告')
  console.log('='.repeat(70))

  console.log(`\n📊 扫描统计:`)
  console.log(`  总引用数: ${result.totalReferences}`)
  console.log(`  有效引用: ${result.validReferences.length}`)
  console.log(`  断裂引用: ${result.brokenReferences.length}`)
  console.log(`  断裂率: ${formatPercent(result.brokenRate)} (门禁阈值: ${formatPercent(maxBrokenRate)})`)

  console.log(`\n📈 分类统计:`)
  console.log(`  文档→代码: ${result.summary.docToCode.total} (${result.summary.docToCode.broken} 断裂)`)
  console.log(`  代码→文档: ${result.summary.codeToDoc.total} (${result.summary.codeToDoc.broken} 断裂)`)
  console.log(`  文档→文档: ${result.summary.docToDoc.total} (${result.summary.docToDoc.broken} 断裂)`)

  if (result.registryIntegrity) {
    console.log(`\n📋 REGISTRY_INDEX 完整性:`)
    console.log(`  索引条目数: ${result.registryIntegrity.indexedFiles}`)
    console.log(`  未索引文件: ${result.registryIntegrity.missingFromIndex.length}`)
    console.log(`  无效索引项: ${result.registryIntegrity.orphanedIndexEntries.length}`)
  }

  if (result.brokenReferences.length > 0) {
    console.log(`\n🔴 断裂引用列表（按源文件分组）:`)
    for (const [source, refs] of Object.entries(result.bySource).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n  📄 ${source} (${refs.length} 个断裂引用)`)
      for (const ref of refs) {
        console.log(`    [${ref.type}] 行 ${ref.line}: ${ref.target}`)
      }
    }
  } else {
    console.log('\n✅ 未发现断裂引用')
  }

  console.log('\n' + '='.repeat(70))
}

function saveReport(result: AuditResult): string {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = join(REPORTS_DIR, `audit-doc-code-references-${timestamp}.json`)

  const report = {
    meta: {
      scriptName: 'audit-doc-code-references',
      version: '3.2',
      timestamp: new Date().toISOString(),
      rootDir: relative(PROJECT_ROOT, SCRIPTS_DIR),
    },
    ...result,
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  return reportPath
}

function parseMaxBrokenRate(): number {
  const flag = '--max-broken-rate'
  const argIndex = process.argv.findIndex((arg) => arg.startsWith(flag))
  if (argIndex === -1) {
    return 0 // 默认零容忍
  }

  const raw = process.argv[argIndex].includes('=')
    ? process.argv[argIndex].split('=')[1]
    : process.argv[argIndex + 1]

  if (!raw) {
    console.error(`[audit-doc-code-references] ❌ ${flag} 需要参数值，例如 ${flag}=0.5% 或 ${flag} 0.005`)
    process.exit(1)
  }

  const normalized = raw.trim().replace('%', '')
  const value = Number(normalized)
  if (Number.isNaN(value) || value < 0) {
    console.error(`[audit-doc-code-references] ❌ ${flag} 参数无效: ${raw}`)
    process.exit(1)
  }

  // 支持 0.5（小数）或 0.5%（百分比）两种写法
  return raw.includes('%') ? value / 100 : value
}

function main(): void {
  try {
    const maxBrokenRate = parseMaxBrokenRate()
    const result = audit()
    printReport(result, maxBrokenRate)

    const reportPath = saveReport(result)
    console.log(`[audit-doc-code-references] 💾 报告已持久化: ${reportPath}`)

    if (result.brokenRate > maxBrokenRate) {
      console.error(
        `[audit-doc-code-references] ❌ 断裂率 ${formatPercent(result.brokenRate)} 超过门禁阈值 ${formatPercent(maxBrokenRate)}`
      )
      process.exit(1)
    } else {
      console.log(
        `[audit-doc-code-references] ✅ 断裂率 ${formatPercent(result.brokenRate)} 未超过门禁阈值 ${formatPercent(maxBrokenRate)}`
      )
      process.exit(0)
    }
  } catch (error) {
    console.error('[audit-doc-code-references] ❌ 审计失败:', error)
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

export { audit, AuditResult, Reference }
