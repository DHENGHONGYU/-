#!/usr/bin/env tsx
/**
 * cleanup-reports.ts
 * 清理过期自动产物
 *
 * 按 docs/meta/cleanup-schedule.md 定义的保留期规则，删除超过保留期的文件和目录。
 *
 * 安全策略：
 * - 仅清理 RULES 中显式配置的目录
 * - 不递归进入子目录（只清理目录顶层条目）
 * - 保护名为 latest.json 的文件
 * - 目录使用 rmdirSync（要求空目录），文件使用 unlinkSync
/**
 * @file cleanup-reports.ts
 * @description 按保留期规则清理过期自动产物（报告、覆盖率、构建目录等）
 * @status 孤立脚本（未在 package.json 中引用）
 * @category 未接入审计流水线 — 评估后接入
 * @maintainer 待定
 * @lastVerified 2026-07-13
 */

import { existsSync, readdirSync, statSync, unlinkSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'

interface CleanupRule {
  path: string
  maxAgeDays: number
}

const RULES: CleanupRule[] = [
  { path: 'docs/reports/audit', maxAgeDays: 30 },
  { path: 'docs/reports/system-check-loop', maxAgeDays: 7 },
  { path: 'docs/reports/system-health', maxAgeDays: 7 },
  { path: 'docs/reports/doc-freshness', maxAgeDays: 7 },
  { path: 'docs/reports/code-graph', maxAgeDays: 7 },
  { path: 'coverage', maxAgeDays: 14 },
  { path: 'dist', maxAgeDays: 7 },
]

function cleanup(rule: CleanupRule): void {
  const now = Date.now()
  const maxAge = rule.maxAgeDays * 24 * 60 * 60 * 1000

  if (!existsSync(rule.path)) {
    console.log(`[cleanup] ${rule.path}: 目录不存在，跳过`)
    return
  }

  try {
    const entries = readdirSync(rule.path)
    let removed = 0

    for (const entry of entries) {
      if (entry === 'latest.json') continue // 保护软链/汇总文件
      if (entry === '.gitkeep') continue // 保护目录占位文件

      const fullPath = join(rule.path, entry)
      const stats = statSync(fullPath)
      const age = now - stats.mtimeMs

      if (age > maxAge) {
        if (stats.isDirectory()) {
          // 仅删除空目录；非空目录跳过，避免误删
          try {
            rmdirSync(fullPath)
            removed++
          } catch {
            console.warn(`[cleanup] ${fullPath}: 目录非空，跳过`)
          }
        } else {
          unlinkSync(fullPath)
          removed++
        }
      }
    }

    console.log(`[cleanup] ${rule.path}: removed ${removed} stale entries`)
  } catch (err) {
    console.warn(`[cleanup] ${rule.path}: ${err}`)
  }
}

RULES.forEach(cleanup)
