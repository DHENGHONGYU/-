#!/usr/bin/env tsx
/**
 * verify-all-routes.ts
 * 通用路由一致性验证脚本 v3.0（白盒/透明管道）
 *
 * 静态扫描 ROUTE_REGISTRY 与 CABIN_APPS/PANEL_ITEMS 之间的路由一致性：
 * 1. 检查 ROUTE_REGISTRY 中是否有重复路径（违规）
 * 2. 检查每个舱室的所有预期子路径是否已在 ROUTE_REGISTRY 注册（违规）
 * 3. 检查 ROUTE_REGISTRY 中是否存在未在预期列表中的孤儿路由（警告）
 *
 * v3.0 改造（2026-07-06）：
 * - 采用白盒/透明管道模式：export scan() / formatReport() / main()
 * - stdout 输出 JSON 数据流（机器可读）
 * - stderr 输出诊断日志 + 人类可读报告
 * - 持久化报告到 docs/reports/audit/verify-all-routes-{timestamp}.json
 * - 支持 CLI 参数：--json / --quiet / --output / --no-persist
 * - 测试可直接 import scan() 验证 Report 对象，无需解析字符串
 *
 * 输出契约：
 * - stdout：JSON 数据流（AuditReport 结构）
 * - stderr：诊断日志 + 人类可读报告
 * - 文件：docs/reports/audit/verify-all-routes-{timestamp}.json
 * - 退出码：0=无违规, 1=有违规, 2=执行错误
 *
 * 用途：CI 门禁，防止新增子页面时遗漏路由注册。
 * 执行：npx tsx scripts/verify-all-routes.ts
 */

import { pathToFileURL } from 'node:url'
import { runAuditPipeline, colorize, type AuditReport } from './_debug/_audit-pipeline'
import { hasRoute, getAllPaths } from '../src/config/routes.ts'

// ============================================================
// 类型定义
// ============================================================

/** 路由一致性检查问题项 */
export interface Issue {
  /** 所属舱室（孤儿/重复可能为空） */
  cabin?: string
  /** 路由路径 */
  path: string
  /** 路由标签（预期列表中声明） */
  label?: string
  /** 问题类型：duplicate-path / missing-route / orphan-route */
  type: string
  /** 问题描述 */
  message: string
}

/** 路由一致性审计报告 */
export interface Report extends AuditReport {
  violations: Issue[]
  warnings: Issue[]
  summary: {
    /** 兼容 AuditReport.totalFiles：扫描的 ROUTE_REGISTRY 路由总数 */
    totalFiles: number
    totalViolations: number
    totalWarnings: number
    /** ROUTE_REGISTRY 总路由数 */
    totalRoutes: number
    /** 预期路径数 */
    totalExpected: number
    /** 已注册的预期路径数 */
    totalCovered: number
    /** 覆盖率（百分比字符串） */
    coverageRate: string
    /** 重复路径数 */
    duplicatePaths: number
    /** 孤儿路由数 */
    orphanPaths: number
    byViolationType: Record<string, number>
    byWarningType: Record<string, number>
  }
}

// ============================================================
// 1. 预期路径定义（与 PortalShell 的 PANEL_ITEMS 保持一致）
// ============================================================

const EXPECTED_PATHS: Record<string, { path: string; label: string }[]> = {
  input: [
    { path: '/input', label: '录入看板' },
    { path: '/input/hub', label: '输入舱首页' },
    { path: '/input/hot-sectors', label: '热门板块' },
    { path: '/input/data-test', label: '采集测试' },
    { path: '/input/local-knowledge', label: '本地知识库' },
    { path: '/input/collect-tasks', label: '采集任务监控' },
    { path: '/input/pool-board', label: '股票池看板（候选池管理）' },
    { path: '/input/seven-dim', label: '七维采集策略配置' },
    { path: '/input/fetcher-config', label: '抓取引擎配置' },
  ],
  analysis: [
    { path: '/analysis', label: '分析舱' },
    { path: '/analysis/hub', label: '分析舱首页' },
    { path: '/analysis/sector', label: '行业分析' },
    { path: '/analysis/backtest', label: '策略回测' },
    { path: '/analysis/industry-score', label: 'V4 行业评分' },
    { path: '/analysis/intelligent-score', label: 'V6 个股智能评分' },
    { path: '/analysis/score-docs', label: '评分文档' },
    { path: '/analysis/news', label: '智能资讯' },
    { path: '/analysis/hot-sector', label: '热门板块策略' },
    { path: '/analysis/value-pit', label: '价值洼地策略' },
    { path: '/analysis/score-comparison', label: '历史评分比对看板' },
    { path: '/analysis/multi-factor', label: '多因子筛选' },
    { path: '/analysis/industry-dashboard', label: '行业全景仪表盘' },
  ],
  trading: [
    { path: '/trading', label: '交易舱' },
    { path: '/trading/strategy-snapshots', label: '策略快照' },
    { path: '/trading/holdings', label: '交易持仓' },
    { path: '/trading/flow', label: '交易流程' },
    { path: '/trading/execution-plans', label: '执行计划管理' },
    { path: '/trading/execution', label: '执行管理' },
    { path: '/trading/portfolio', label: '投资组合管理' },
    { path: '/trading/risk', label: '风险控制管理' },
  ],
  output: [
    { path: '/output', label: '输出舱' },
    { path: '/output/hub', label: '输出舱首页' },
    { path: '/output/research', label: '研究报告' },
    { path: '/output/review', label: '交易复盘' },
    { path: '/output/export', label: '数据导出' },
    { path: '/output/dashboard', label: '输出舱仪表盘' },
    { path: '/output/wizard', label: '复盘向导' },
    { path: '/output/prediction', label: '预测校验' },
    { path: '/output/retrospective', label: '周期复盘' },
    { path: '/output/factor-dashboard', label: '因子画板' },
  ],
  command: [
    { path: '/command', label: '总控舱' },
    { path: '/command/hub', label: '总控舱首页' },
    { path: '/command/agents', label: '智能体总控台' },
    { path: '/command/agents/registry', label: '智能体注册表' },
    { path: '/command/agents/registry/:agentId', label: '智能体详情' },
    { path: '/command/agents/trigger', label: '智能体任务触发' },
    { path: '/command/agents/tasks', label: '智能体任务列表' },
    { path: '/command/agents/custom', label: '自定义智能体' },
    { path: '/command/agents/llm', label: 'LLM 管理' },
    { path: '/command/agents/capability-graph', label: '能力图谱' },
    { path: '/command/agents/dag-scheduler', label: 'DAG 调度器' },
    { path: '/command/agents/feedback', label: '反馈控制台' },
    { path: '/command/agents/model-upgrade', label: '模型升级' },
    { path: '/command/agents/data-labels', label: '数据标签管理' },
    { path: '/command/agents/api-config', label: 'API 配置' },
    { path: '/command/agents/skill-audit', label: 'Skill 核查' },
    { path: '/command/agents/optimization', label: '优化建议' },
    { path: '/command/agents/changelog', label: '更新日志' },
    { path: '/command/mcp-servers', label: 'MCP Server 管理' },
    { path: '/command/monitor', label: '系统监控' },
    { path: '/command/config', label: '配置管理' },
    { path: '/command/showcase', label: '组件示例库' },
    { path: '/command/health', label: '架构健康度仪表盘' },
    { path: '/command/test', label: '压力测试' },
  ],
  portal: [
    { path: '/', label: '首页' },
    { path: '/cockpit', label: '驾驶舱' },
    // [DEPRECATED 2026-08-04] /mock-test 已从路由解耦，不再属于预期路径
    // { path: '/mock-test', label: 'Mock 验证页' },
  ],
}

// ============================================================
// 2. 扫描函数（白盒导出，供测试和外部调用）
// ============================================================

/** 安全获取所有已注册路径（带边界条件保护） */
function safeGetAllPaths(): string[] {
  try {
    return getAllPaths()
  } catch (err) {
    // 边界条件：routes 模块加载失败或异常时返回空列表
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`加载 ROUTE_REGISTRY 失败: ${msg}`)
  }
}

/** 安全检查路径是否注册（带边界条件保护） */
function safeHasRoute(p: string): boolean {
  try {
    return hasRoute(p)
  } catch {
    // 边界条件：hasRoute 异常时保守返回 false
    return false
  }
}

/** 执行路由一致性扫描，返回 Report 对象（纯数据，无副作用） */
export function scan(): Report {
  const allPaths = safeGetAllPaths()

  const violations: Issue[] = []
  const warnings: Issue[] = []

  // ── 1. 重复路径检查 ──
  const pathCounts = new Map<string, number>()
  for (const p of allPaths) {
    pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1)
  }
  const duplicates = [...pathCounts.entries()].filter(([, c]) => c > 1)
  for (const [p, c] of duplicates) {
    violations.push({
      path: p,
      type: 'duplicate-path',
      message: `路径 "${p}" 在 ROUTE_REGISTRY 中重复 ${c} 次`,
    })
  }

  // ── 2. 舱室路径覆盖检查 ──
  const totalExpected = Object.values(EXPECTED_PATHS).flat().length
  let totalCovered = 0

  for (const [cabin, items] of Object.entries(EXPECTED_PATHS)) {
    for (const item of items) {
      const registered = safeHasRoute(item.path)
      if (registered) {
        totalCovered++
      } else {
        violations.push({
          cabin,
          path: item.path,
          label: item.label,
          type: 'missing-route',
          message: `预期路径 ${item.path}（${item.label}）未在 ROUTE_REGISTRY 中注册`,
        })
      }
    }
  }

  // ── 3. 孤儿路由检查（警告，不阻塞 CI） ──
  const allExpectedPaths = new Set(
    Object.values(EXPECTED_PATHS)
      .flat()
      .map((i) => i.path),
  )
  const orphanPaths = allPaths.filter((p) => !allExpectedPaths.has(p))
  for (const p of orphanPaths) {
    warnings.push({
      path: p,
      type: 'orphan-route',
      message: `路径 "${p}" 已在 ROUTE_REGISTRY 注册但未在预期列表中声明`,
    })
  }

  // ── 4. 汇总统计 ──
  const byViolationType: Record<string, number> = {}
  const byWarningType: Record<string, number> = {}
  for (const v of violations) {
    byViolationType[v.type] = (byViolationType[v.type] ?? 0) + 1
  }
  for (const w of warnings) {
    byWarningType[w.type] = (byWarningType[w.type] ?? 0) + 1
  }

  const coverageRate =
    totalExpected === 0 ? '0.0%' : ((totalCovered / totalExpected) * 100).toFixed(1) + '%'

  return {
    violations,
    warnings,
    summary: {
      totalFiles: allPaths.length,
      totalViolations: violations.length,
      totalWarnings: warnings.length,
      totalRoutes: allPaths.length,
      totalExpected,
      totalCovered,
      coverageRate,
      duplicatePaths: duplicates.length,
      orphanPaths: orphanPaths.length,
      byViolationType,
      byWarningType,
    },
  }
}

// ============================================================
// 3. 人类可读报告格式化（输出到 stderr）
// ============================================================

/** 格式化人类可读报告 */
export function formatReport(report: Report): string {
  const lines: string[] = []

  lines.push('╔════════════════════════════════════════════════════════════╗')
  lines.push('║  路由一致性验证 — verify-all-routes.ts v3.0                ║')
  lines.push('╚════════════════════════════════════════════════════════════╝')
  lines.push('')

  // ── 1. 重复路径检查 ──
  lines.push('=== 1. 重复路径检查 ===')
  if (report.summary.duplicatePaths === 0) {
    lines.push(colorize('✅ 无重复路径', 'green'))
  } else {
    lines.push(colorize(`🔴 发现 ${report.summary.duplicatePaths} 处重复路径：`, 'red'))
    for (const v of report.violations.filter((i) => i.type === 'duplicate-path')) {
      lines.push(`  ❌ ${v.message}`)
    }
  }
  lines.push('')

  // ── 2. 舱室路径覆盖检查 ──
  lines.push('=== 2. 舱室路径覆盖检查 ===')
  const cabins = Object.keys(EXPECTED_PATHS)
  for (const cabin of cabins) {
    const items = EXPECTED_PATHS[cabin]!
    lines.push(`\n--- ${cabin} 舱 ---`)
    for (const item of items) {
      const registered = safeHasRoute(item.path)
      if (registered) {
        lines.push(`  ✅ ${item.path} (${item.label})`)
      } else {
        lines.push(colorize(`  ❌ ${item.path} (${item.label}) — 未注册`, 'red'))
      }
    }
  }
  lines.push(`\n覆盖: ${report.summary.totalCovered}/${report.summary.totalExpected} (${report.summary.coverageRate})`)
  lines.push('')

  // ── 3. 孤儿路由检查 ──
  lines.push('=== 3. 孤儿路由检查 ===')
  if (report.summary.orphanPaths === 0) {
    lines.push(colorize('✅ 无孤儿路由', 'green'))
  } else {
    lines.push(colorize(`⚠️  发现 ${report.summary.orphanPaths} 条孤儿路由（未在预期列表中但已注册）：`, 'yellow'))
    for (const w of report.warnings.filter((i) => i.type === 'orphan-route')) {
      lines.push(`  - ${w.path}`)
    }
  }
  lines.push('')

  // ── 4. 汇总 ──
  lines.push('=== 汇总 ===')
  lines.push(`ROUTE_REGISTRY 总路由数: ${report.summary.totalRoutes}`)
  lines.push(`预期路径数: ${report.summary.totalExpected}`)
  lines.push(`覆盖路径数: ${report.summary.totalCovered}`)
  lines.push(`孤儿路由数: ${report.summary.orphanPaths}`)
  lines.push(`重复路径数: ${report.summary.duplicatePaths}`)
  lines.push('────────────────────────────────────────────────────────────')

  if (report.summary.totalViolations > 0) {
    lines.push(colorize('\n❌ 路由一致性检查未通过。请修复上述问题后重新提交。', 'red'))
  } else {
    lines.push(colorize('\n✅ 路由一致性检查通过。', 'green'))
  }

  return lines.join('\n')
}

// ============================================================
// 4. CLI 入口（编排：scan → stdout JSON → stderr 诊断 → 持久化 → exit）
// ============================================================

export function main(): void {
  const result = runAuditPipeline<Report>({
    scriptName: 'verify-all-routes',
    version: '3.0',
    scanFn: scan,
    formatReportFn: formatReport,
  })
  process.exit(result.exitCode)
}

// 仅在直接作为 CLI 运行时执行（避免被 import 时自动运行）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
