#!/usr/bin/env node
/**
 * @module scripts/doc-notify
 * @description 文档自动更新体系 —— 统一的告警通知适配器（M2 · T3）
 *
 * 告警出口，承接：①门禁非零退出 ②updater overallStatus=failure
 * ③freshness 评分 <50 (ALERT-02) ④C1-C5 规则命中。
 *
 * **关键原则：`notifyDocAlert` 绝不能抛出**（内部任何错误都吞掉并 stderr 记录），
 * 以免污染主流程。CI 环境（GitHub Actions）下按级别发出 `::error` / `::warning`
 * 工作流命令；本地统一 `console.error`；告警持久化到 `<日期>.jsonl`；
 * 可选 Webhook（env `DOC_NOTIFY_WEBHOOK_URL`）5s 超时推送。
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/** 告警级别 */
export type DocAlertLevel = 'info' | 'warning' | 'error'

/** 一条文档告警 */
export interface DocAlert {
  level: DocAlertLevel
  /** 可选告警码，如 'ALERT-02' | 'UPDATE_FAILURE' | 'PIPELINE_VALIDATION_FAILED' */
  code?: string
  title: string
  message: string
  /** 来源脚本名 */
  source?: string
  context?: Record<string, unknown>
}

/** 通知选项 */
export interface DocNotifyOptions {
  /** 覆盖 webhook 地址（默认读 env DOC_NOTIFY_WEBHOOK_URL） */
  webhookUrl?: string
  /** 覆盖告警日志目录（默认 docs/reports/doc-alerts） */
  alertsDir?: string
  /** true 时跳过 stdout/CI 命令输出，仍写文件 + 发 webhook */
  silent?: boolean
}

const DEFAULT_ALERTS_DIR = join(process.cwd(), 'docs', 'reports', 'doc-alerts')

/** 取得当天告警日志文件路径（按本地日期 YYYY-MM-DD.jsonl） */
function todayFile(alertsDir: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return join(alertsDir, `${y}-${m}-${day}.jsonl`)
}

/** 在 CI（GitHub Actions）下发出工作流命令；本地走 console.error */
function emit(alert: DocAlert, silent: boolean): void {
  if (silent) return
  if (process.env.GITHUB_ACTIONS === 'true') {
    const body = `title=${alert.title}::${alert.message}`
    if (alert.level === 'error') {
      console.log(`::error ${body}`)
    } else if (alert.level === 'warning') {
      console.log(`::warning ${body}`)
    } else {
      console.log(`[DocNotify][info] ${alert.title}: ${alert.message}`)
    }
  } else {
    console.error(`[DocNotify][${alert.level}] ${alert.title}: ${alert.message}`)
  }
}

/** 持久化告警到 jsonl（内部已 try/catch） */
function persist(alert: DocAlert, alertsDir: string): void {
  try {
    mkdirSync(alertsDir, { recursive: true })
    const line = JSON.stringify({ ts: new Date().toISOString(), ...alert })
    appendFileSync(todayFile(alertsDir), line + '\n', 'utf-8')
  } catch (err) {
    console.error(`[DocNotify] 写入告警日志失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** 可选 Webhook 推送（5s 超时，失败仅记录） */
async function pushWebhook(alert: DocAlert, url: string): Promise<void> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts: new Date().toISOString(), ...alert }),
      signal: controller.signal,
    })
    clearTimeout(timer)
  } catch (err) {
    console.error(`[DocNotify] Webhook 推送失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * 发送单条文档告警。**永不抛出**：所有内部异常仅记录到 stderr。
 *
 * @param alert 告警内容
 * @param options 通知选项
 */
export async function notifyDocAlert(alert: DocAlert, options?: DocNotifyOptions): Promise<void> {
  try {
    const alertsDir = options?.alertsDir ?? DEFAULT_ALERTS_DIR
    const silent = options?.silent ?? false
    emit(alert, silent)
    persist(alert, alertsDir)
    const webhook = options?.webhookUrl ?? process.env.DOC_NOTIFY_WEBHOOK_URL
    if (webhook) {
      await pushWebhook(alert, webhook)
    }
  } catch (err) {
    console.error(`[DocNotify] 内部错误: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
  }
}

/**
 * 顺序发送多条告警。
 *
 * @param alerts 告警数组
 * @param options 通知选项
 */
export async function notifyDocAlerts(alerts: DocAlert[], options?: DocNotifyOptions): Promise<void> {
  for (const alert of alerts) {
    await notifyDocAlert(alert, options)
  }
}

// ─── 自测（仅当直接作为主模块运行时） ─────────────────────────────────────────
const isMain = process.argv[1] && process.argv[1].endsWith('doc-notify.ts')
if (isMain) {
  void (async () => {
    await notifyDocAlert(
      {
        level: 'warning',
        code: 'SELFTEST',
        title: 'doc-notify 自测',
        message: '这是一条自测告警',
        source: 'doc-notify',
      },
      { alertsDir: tmpdir() },
    )
    console.error('[DocNotify] self-test ok')
  })()
}
