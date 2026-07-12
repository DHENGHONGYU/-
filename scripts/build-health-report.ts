import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAuditOutput, parseNumberField } from '../packages/audit-utils/dist/index.js'

/**
 * 构建架构健康度报告。
 *
 * 运行各 audit 脚本，收集关键指标，写入 public/health-report.json，
 * 供总控舱「架构健康度仪表盘」展示。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_PATH = path.join(ROOT, 'public', 'health-report.json')

interface HealthMetric {
  name: string
  label: string
  value: number
  baseline?: number
  unit: string
  status: 'healthy' | 'warning' | 'critical' | 'info'
  detail?: string
}

interface HealthReport {
  generatedAt: string
  agentsVersion: string
  overallScore: number
  metrics: HealthMetric[]
}

function run(cmd: string): string {
  try {
    const [command, ...args] = cmd.split(' ')
    const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf-8', shell: true })
    return (result.stdout ?? '') + (result.stderr ?? '')
  } catch (err: any) {
    return String(err)
  }
}

function getAgentsVersion(): string {
  const content = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf-8')
  const match = content.match(/>\s*\*\*版本\*\*:\s*(v[\d.]+)/)
  return match?.[1] ?? 'unknown'
}

function main(): void {
  // 1. 跨层调用
  const layersOutput = run('npm run audit:layers --silent')
  const layersViolations = parseAuditOutput(layersOutput).data.totalViolations || 0

  // 2. 颜色硬编码
  const tokenOutput = run('npm run audit:tokens --silent')
  const hardcodeHex = parseNumberField(tokenOutput, (json) => {
    const bySeverity = json.summary?.bySeverity || {}
    return (bySeverity as Record<string, number>)['Fatal'] || (bySeverity as Record<string, number>)['Critical'] || 0
  }, /当前:\s*(\d+)\s*基线/)

  // 3. 复杂度
  const complexityOutput = run('npm run audit:complexity --silent')
  const deepNesting = parseNumberField(complexityOutput, (json) => json.summary?.deepNesting || 0, /深层嵌套[\s\S]*?当前:\s*(\d+)/)
  const longChain = parseNumberField(complexityOutput, (json) => json.summary?.longChain || 0, /长链式条件[\s\S]*?当前:\s*(\d+)/)
  const duplicateConditions = parseNumberField(complexityOutput, (json) => json.summary?.duplicateConditions || 0, /重复 if 条件[\s\S]*?当前:\s*(\d+)/)

  // 4. JSDoc 缺失
  const jsdocOutput = run('npm run audit:jsdoc --silent')
  const jsdocMissing = parseNumberField(jsdocOutput, (json) => json.summary?.totalMissing || 0, /发现\s*(\d+)\s*个导出实体缺少 JSDoc/)

  // 5. 文档同步
  const docsOutput = run('npm run audit:docs --silent')
  const docsViolations = parseAuditOutput(docsOutput).data.totalViolations || 0

  const metrics: HealthMetric[] = [
    {
      name: 'layers',
      label: '跨层调用违规',
      value: layersViolations,
      unit: '处',
      status: layersViolations === 0 ? 'healthy' : 'critical',
      detail: 'audit:layers',
    },
    {
      name: 'tokens',
      label: '颜色硬编码',
      value: hardcodeHex.data,
      unit: '处',
      status: hardcodeHex.data === 0 ? 'healthy' : 'warning',
      detail: 'audit:tokens',
    },
    {
      name: 'deepNesting',
      label: '深层嵌套（≥4 层）',
      value: deepNesting.data,
      baseline: 104,
      unit: '处',
      status: deepNesting.data <= 104 ? 'warning' : 'critical',
      detail: 'audit:complexity',
    },
    {
      name: 'longChain',
      label: '长链式条件（≥6 分支）',
      value: longChain.data,
      baseline: 0,
      unit: '处',
      status: longChain.data <= 0 ? 'warning' : 'critical',
      detail: 'audit:complexity',
    },
    {
      name: 'duplicateConditions',
      label: '重复 if 条件',
      value: duplicateConditions.data,
      baseline: 39,
      unit: '处',
      status: duplicateConditions.data <= 39 ? 'warning' : 'critical',
      detail: 'audit:complexity',
    },
    {
      name: 'jsdoc',
      label: 'JSDoc 缺失',
      value: jsdocMissing.data,
      baseline: 0,
      unit: '处',
      status: jsdocMissing.data === 0 ? 'healthy' : jsdocMissing.data <= 628 ? 'warning' : 'critical',
      detail: 'audit:jsdoc',
    },
    {
      name: 'docs',
      label: '文档同步违规',
      value: docsViolations,
      unit: '处',
      status: docsViolations === 0 ? 'healthy' : 'warning',
      detail: 'audit:docs',
    },
  ]

  // 综合得分：健康指标得 100，warning 得 80，critical 得 0，按权重平均
  const weights = [0.25, 0.15, 0.15, 0.1, 0.1, 0.15, 0.1]
  const score = Math.round(
    metrics.reduce((sum, m, i) => {
      const score = m.status === 'healthy' ? 100 : m.status === 'warning' ? 80 : 0
      return sum + score * weights[i]
    }, 0),
  )

  const report: HealthReport = {
    generatedAt: new Date().toISOString(),
    agentsVersion: getAgentsVersion(),
    overallScore: score,
    metrics,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`✅ 架构健康度报告已生成：${OUT_PATH}`)
  console.log(`   综合得分：${score}`)
  metrics.forEach((m) => console.log(`   ${m.label}: ${m.value}${m.unit} [${m.status}]`))
}

main()
