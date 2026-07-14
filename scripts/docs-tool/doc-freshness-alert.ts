#!/usr/bin/env node
/**
 * @module scripts/doc-freshness-alert
 * @description 激活保鲜度告警规则 ALERT-01~05（约束 2 · C1-C5）
 *
 * 读取 `docs/B-architecture/freshness-alerts.md` 的规则定义 + 当前 docs 状态，
 * 逐条评估 ALERT-01~05，命中即经 `doc-notify`（T3）上报。
 *
 * 评估口径（确定性、可离线运行）：
 *  - ALERT-04 / ALERT-05：基于文档 mtime 距今天数（>90 天 / 31~90 天）。
 *  - ALERT-01：文档最后更新以来，`src/` 累计提交次数 > 5（近似「关联代码累计修改」）。
 *  - ALERT-02 / ALERT-03：若 `docs/reports/doc-freshness/` 存在最新评分 JSON，
 *    取 totalScore（<50 / 50~79）；无评分产物时优雅跳过本两条。
 *
 * **关键原则：本脚本永不抛出**（每步 try/catch），告警只是通知，
 * 退出码恒为 0（不阻断 CI，仅经 doc-notify 记录/上报）。
 *
 * 用法：
 *   npx tsx scripts/doc-freshness-alert.ts [--reports <dir>] [--silent]
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { notifyDocAlerts, type DocAlert } from './doc-notify'

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')
const ROOT = join(__dirname, '..')
const DOCS_DIR = join(ROOT, 'docs')
const ALERTS_REPORT_DIR = join(ROOT, 'docs', 'reports', 'doc-freshness-alerts')
const FRESHNESS_SCORE_DIR = join(ROOT, 'docs', 'reports', 'doc-freshness')

const DAY_MS = 24 * 60 * 60 * 1000

interface DocHit {
  path: string
  days: number
  srcCommits: number
  score?: number
}

// ── 工具 ──────────────────────────────────────────────────────────────────

/** 安全执行 git 命令，失败返回空字符串（优雅降级）。 */
function safeGit(args: string): string {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

/** 取得受跟踪的 docs/**\*.md 列表（排除 reports/ 与 changelogs/ 自动产物）。 */
function listTrackedDocs(): string[] {
  const raw = safeGit(`ls-files`).split('\n').filter((l) => l.trim().length > 0)
  return raw.filter(
    (p) => /^docs\/.*\.md$/.test(p) && !/^docs\/reports\//.test(p) && !/^docs\/changelogs\//.test(p),
  )
}

/** 取某文档最后更新以来 src/ 的提交次数（近似“关联代码累计修改”）。 */
function srcCommitsSince(isoDate: string): number {
  if (!isoDate) return 0
  const out = safeGit(`log --since="${isoDate}" --oneline -- src`)
  if (!out) return 0
  return out.split('\n').filter((l) => l.trim().length > 0).length
}

/** 读取最新的 freshness 评分 JSON（若存在），返回 totalScore。 */
function latestFreshnessScore(): number | undefined {
  try {
    if (!existsSync(FRESHNESS_SCORE_DIR)) return undefined
    const files = readdirSync(FRESHNESS_SCORE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(FRESHNESS_SCORE_DIR, f))
      .sort((a, b) => {
        try {
          return statSync(b).mtimeMs - statSync(a).mtimeMs
        } catch {
          return 0
        }
      })
    if (files.length === 0) return undefined
    const json = JSON.parse(readFileSync(files[0]!, 'utf-8')) as {
      docs?: Array<{ freshness?: { totalScore?: number } }>
    }
    const scores = (json.docs ?? [])
      .map((d) => d.freshness?.totalScore)
      .filter((s): s is number => typeof s === 'number')
    if (scores.length === 0) return undefined
    return scores.reduce((a, b) => a + b, 0) / scores.length
  } catch {
    return undefined
  }
}

// ── 主流程 ────────────────────────────────────────────────────────────────

export interface FreshnessAlertResult {
  evaluated: number
  alerts: DocAlert[]
}

export function evaluateFreshnessAlerts(): FreshnessAlertResult {
  const now = Date.now()
  const docs = listTrackedDocs()
  const avgScore = latestFreshnessScore()
  const alerts: DocAlert[] = []

  for (const rel of docs) {
    const abs = join(ROOT, rel)
    let mtimeMs = 0
    try {
      mtimeMs = statSync(abs).mtimeMs
    } catch {
      continue
    }
    const days = Math.floor((now - mtimeMs) / DAY_MS)
    const isoDate = new Date(mtimeMs).toISOString()
    const srcCommits = srcCommitsSince(isoDate)

    // ALERT-04 / ALERT-05：时效性
    if (days > 90) {
      alerts.push({
        level: 'error',
        code: 'ALERT-04',
        title: `文档过期（${days} 天未更新）`,
        message: `${rel} 最后更新 ${days} 天前（>90），建议立即评审是否仍有效。`,
        source: 'doc-freshness-alert',
        context: { path: rel, days },
      })
    } else if (days >= 31) {
      alerts.push({
        level: 'warning',
        code: 'ALERT-05',
        title: `文档待审阅（${days} 天未更新）`,
        message: `${rel} 最后更新 ${days} 天前（31~90），建议安排审阅。`,
        source: 'doc-freshness-alert',
        context: { path: rel, days },
      })
    }

    // ALERT-01：关联 src 累计修改 > 5 次但文档未同步
    if (srcCommits > 5) {
      alerts.push({
        level: 'warning',
        code: 'ALERT-01',
        title: '关联代码变更频繁但文档未同步',
        message: `${rel} 自最后更新以来 src/ 累计 ${srcCommits} 次提交（>5），文档可能已过时。`,
        source: 'doc-freshness-alert',
        context: { path: rel, srcCommits },
      })
    }
  }

  // ALERT-02 / ALERT-03：健康度评分（依赖 freshness 评分产物）
  if (typeof avgScore === 'number') {
    if (avgScore < 50) {
      alerts.push({
        level: 'error',
        code: 'ALERT-02',
        title: '文档健康度过低',
        message: `全仓平均保鲜度评分 ${avgScore.toFixed(1)}（<50），建议立即安排修订或废弃。`,
        source: 'doc-freshness-alert',
        context: { avgScore },
      })
    } else if (avgScore < 80) {
      alerts.push({
        level: 'warning',
        code: 'ALERT-03',
        title: '文档健康度需关注',
        message: `全仓平均保鲜度评分 ${avgScore.toFixed(1)}（50~79），建议本迭代内安排审阅更新。`,
        source: 'doc-freshness-alert',
        context: { avgScore },
      })
    }
  }

  return { evaluated: docs.length, alerts }
}

async function main(): Promise<void> {
  const silent = process.argv.slice(2).includes('--silent')
  const result = evaluateFreshnessAlerts()

  await notifyDocAlerts(result.alerts, silent ? { silent: true } : undefined)

  // 持久化本轮评估摘要
  try {
    mkdirSync(ALERTS_REPORT_DIR, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const summary = {
      generatedAt: new Date().toISOString(),
      evaluatedDocs: result.evaluated,
      alertCount: result.alerts.length,
      byCode: result.alerts.reduce<Record<string, number>>((acc, a) => {
        acc[a.code ?? 'UNKNOWN'] = (acc[a.code ?? 'UNKNOWN'] ?? 0) + 1
        return acc
      }, {}),
      alerts: result.alerts,
    }
    writeFileSync(join(ALERTS_REPORT_DIR, `freshness-alerts-${ts}.json`), JSON.stringify(summary, null, 2), 'utf-8')
  } catch (err) {
    console.error(`[doc-freshness-alert] 写摘要失败: ${err instanceof Error ? err.message : String(err)}`)
  }

  console.log(`[doc-freshness-alert] 评估 ${result.evaluated} 份文档，命中告警 ${result.alerts.length} 条`)
  if (!silent) {
    for (const a of result.alerts) {
      const tag = a.level === 'error' ? '🔴' : '🟡'
      console.log(`  ${tag} [${a.code}] ${a.title} — ${a.message}`)
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('doc-freshness-alert.ts')) {
  void main()
}
