#!/usr/bin/env tsx
/**
 * audit-reg-validate.ts
 *
 * 组件注册表运行时校验 — CI 门禁脚本
 * 基于 validateRegistry() 函数执行运行时一致性校验：
 *   1. 所有 active 组件必须有非空 consumers
 *   2. 所有 deprecated 组件必须有完整 deprecationMeta
 *
 * 与 audit-registry.ts（静态正则扫描）互补：
 *   - audit-registry.ts：静态正则解析，不执行代码，检查文件存在性和注册表覆盖度
 *   - audit-reg-validate.ts：运行时导入组件注册表，通过 validateRegistry() 做函数级校验
 *
 * 用法：
 *   npm run audit:registry:validate            # 人类可读输出
 *   npm run audit:registry:validate:json       # JSON 输出（CI 模式）
 *
 * 退出码：
 *   0 = 全部通过
 *   1 = 发现校验问题（CI 阻塞）
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')

/** 将绝对路径转为 file:// URL（兼容 Windows） */
function toFileURL(absPath: string): string {
  return pathToFileURL(absPath).href
}

const IS_JSON = process.argv.includes('--json')
const OUTPUT_PATH = process.env.AUDIT_OUTPUT_PATH || resolve(ROOT, 'outputs', 'registry-validate.json')

interface ValidationIssue {
  level: string
  type: 'missing-consumers' | 'missing-meta'
  name: string
  message: string
}

interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  summary: {
    totalChecked: number
    missingConsumers: number
    missingMeta: number
    byLevel: Record<string, number>
  }
  timestamp: string
}

async function runValidation(): Promise<ValidationResult> {
  // 动态导入 componentRegistry（运行时解析，获取真实组件数据）
  const { validateRegistry, COMPONENT_REGISTRY } = await import(
    toFileURL(resolve(ROOT, 'src', 'components', 'componentRegistry.ts'))
  )

  const result = validateRegistry()

  // 统计摘要
  const byLevel: Record<string, number> = {}
  for (const issue of result.issues) {
    byLevel[issue.level] = (byLevel[issue.level] || 0) + 1
  }

  // 按 level 统计 checked 数量
  const levelCounts: Record<string, number> = {}
  for (const entry of COMPONENT_REGISTRY) {
    levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1
  }

  return {
    valid: result.valid,
    issues: result.issues,
    summary: {
      totalChecked: COMPONENT_REGISTRY.length,
      missingConsumers: result.issues.filter((i) => i.type === 'missing-consumers').length,
      missingMeta: result.issues.filter((i) => i.type === 'missing-meta').length,
      byLevel,
    },
    timestamp: new Date().toISOString(),
  }
}

function printHuman(result: ValidationResult): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  组件注册表运行时校验 — audit-reg-validate               ║')
  console.log('╚════════════════════════════════════════════════════════════\n')

  console.log(`  校验时间: ${result.timestamp}`)
  console.log(`  检查组件总数: ${result.summary.totalChecked}`)
  console.log(`  发现问题: ${result.issues.length}`)

  if (result.valid) {
    console.log('\n  ✅ validateRegistry() 校验全部通过')
    console.log('     - 所有 active 组件均声明 consumers')
    console.log('     - 所有 deprecated 组件均有完整 deprecationMeta')
    console.log()
  } else {
    const missingConsumers = result.issues.filter((i) => i.type === 'missing-consumers')
    const missingMeta = result.issues.filter((i) => i.type === 'missing-meta')

    if (missingConsumers.length > 0) {
      console.log(`\n  ⚠️  [missing-consumers] ${missingConsumers.length} 个 active 组件未声明 consumers:`)
      for (const issue of missingConsumers) {
        console.log(`     - ${issue.name} (${issue.level}): ${issue.message}`)
      }
    }

    if (missingMeta.length > 0) {
      console.log(`\n  ⚠️  [missing-meta] ${missingMeta.length} 个 deprecated 组件缺少必填字段:`)
      for (const issue of missingMeta) {
        console.log(`     - ${issue.name} (${issue.level}): ${issue.message}`)
      }
    }

    // 按 level 汇总
    if (Object.keys(result.summary.byLevel).length > 0) {
      console.log('\n  按层级分布:')
      for (const [level, count] of Object.entries(result.summary.byLevel)) {
        console.log(`     ${level}: ${count} 个问题`)
      }
    }
  }

  console.log('────────────────────────────────────────────────────────────\n')
}

function writeJsonOutput(result: ValidationResult): void {
  // 确保输出目录存在
  const outDir = dirname(OUTPUT_PATH)
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`  JSON 报告已写入: ${OUTPUT_PATH}`)
}

async function main(): Promise<void> {
  try {
    const result = await runValidation()

    if (IS_JSON) {
      // JSON 模式：输出到文件，同时将结果打印到 stdout 便于 CI 日志
      writeJsonOutput(result)
      // 将 JSON 摘要打印到 stdout（供 CI 日志查看）
      console.log(JSON.stringify({
        valid: result.valid,
        issueCount: result.issues.length,
        totalChecked: result.summary.totalChecked,
        summary: result.summary,
      }, null, 2))
    } else {
      printHuman(result)
    }

    process.exit(result.valid ? 0 : 1)
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('\n❌ validateRegistry() 执行异常:')
    console.error(`   ${error.message}`)
    console.error('\n   可能原因:')
    console.error('   - componentRegistry.ts 导出结构变更')
    console.error('   - 子注册表文件（atomRegistry/moleculeRegistry/organismRegistry/templateRegistry）语法错误')
    console.error('   - 依赖模块（registryTypes）缺失')
    console.error('\n   建议排查:')
    console.error('   1. npx tsc --noEmit src/components/componentRegistry.ts')
    console.error('   2. npx tsx scripts/audit/audit-registry.ts')
    console.error('   3. npx vitest run src/components/registry/registryContract.test.ts')

    // 写入错误报告
    const errorResult: ValidationResult = {
      valid: false,
      issues: [{
        level: 'unknown',
        type: 'missing-consumers',
        name: '__RUNTIME_ERROR__',
        message: `validateRegistry() 执行异常: ${error.message}`,
      }],
      summary: { totalChecked: 0, missingConsumers: 1, missingMeta: 0, byLevel: {} },
      timestamp: new Date().toISOString(),
    }
    writeJsonOutput(errorResult)

    process.exit(2)
  }
}

main()