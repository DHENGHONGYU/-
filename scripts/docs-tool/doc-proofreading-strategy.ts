#!/usr/bin/env node
/**
 * @module scripts/docs-tool/doc-proofreading-strategy
 * @description 自动文档校对策略 — 单一事实源（single source of truth）
 *
 * 本文件定义自动文档校对系统（daily-doc-validation / doc:gate）应执行的
 * 三类交叉引用检查及其适用范围。任何脚本（校验器、门禁、调度器）在决定
 * "是否对某文档执行某类交叉引用检查"时，必须引用本策略，不得各自硬编码。
 *
 * 三类检查（扫描能力由 cross-ref-engine 提供）：
 *  - doc-to-code : 文档引用代码/资源文件路径（src/ scripts/ *.ts *.json ...）
 *  - code-to-doc : 代码引用文档路径（docs/**\/*.md）
 *  - doc-to-doc  : 文档引用其它文档的相对链接
 *
 * 策略范围：仅对 tier ∈ appliesToTiers 的文档执行（默认 core / important）。
 * tier 取自文档 frontmatter 的 `tier` 字段；缺失时回退 classifyTier 路径分类。
 *
 * 阻断策略：默认 blocking=false（断裂引用以 warning 上报，不冲垮既有门禁）。
 * 待 backlog（数千条历史断裂）清理后，可将对应检查 blocking 翻为 true 升级为 failure。
 */

import { readFileSync } from 'node:fs'
import { basename, relative } from 'node:path'

// ─── 类型 ───────────────────────────────────────────────────────────────────

export type CrossReferenceCheckType = 'doc-to-code' | 'code-to-doc' | 'doc-to-doc'

export type DocTier = 'core' | 'important' | 'reference'

export interface CrossReferenceCheckPolicy {
  /** 策略内唯一 ID */
  readonly id: string
  /** 人类可读名称 */
  readonly name: string
  /** 检查类型（与 cross-ref-engine Reference.type 对应） */
  readonly type: CrossReferenceCheckType
  /** 仅对 tier 命中本集合的文档执行该检查 */
  readonly appliesToTiers: readonly DocTier[]
  /** 发现断裂引用时的严重程度 */
  readonly severity: 'critical' | 'high' | 'medium' | 'low'
  /** 是否阻断门禁（false=仅 warning 上报；true=升级为 failure 阻断） */
  readonly blocking: boolean
  /** 策略说明 */
  readonly description: string
}

// ─── 策略定义（单一事实源） ──────────────────────────────────────────────────

/**
 * 自动文档校对策略 v1.0.0
 * 适用范围：核心文档（core）+ 重要文档（important）。
 */
export const PROOFREADING_STRATEGY = {
  version: '1.0.0',
  /** 全局默认适用范围（各检查可在 appliesToTiers 中收窄，但不得超出本集合） */
  appliesToTiers: ['core', 'important'] as const,
  checks: [
    {
      id: 'XREF-D2C',
      name: '文档→代码引用',
      type: 'doc-to-code',
      appliesToTiers: ['core', 'important'],
      severity: 'high',
      blocking: false,
      description: '核心/重要文档中引用的 src/ scripts/ 代码或资源路径必须存在',
    },
    {
      id: 'XREF-C2D',
      name: '代码→文档引用',
      type: 'code-to-doc',
      appliesToTiers: ['core', 'important'],
      severity: 'high',
      blocking: false,
      description: '代码引用的 docs/ 核心/重要文档路径必须存在',
    },
    {
      id: 'XREF-D2D',
      name: '文档→文档引用',
      type: 'doc-to-doc',
      appliesToTiers: ['core', 'important'],
      severity: 'medium',
      blocking: false,
      description: '核心/重要文档中指向其它文档的相对链接必须有效',
    },
  ],
} as const satisfies {
  version: string
  appliesToTiers: readonly DocTier[]
  checks: readonly CrossReferenceCheckPolicy[]
}

/** 便捷查询：按类型取检查策略 */
export function getCheckPolicy(type: CrossReferenceCheckType): CrossReferenceCheckPolicy {
  const found = PROOFREADING_STRATEGY.checks.find((c) => c.type === type)
  if (!found) {
    throw new Error(`[doc-proofreading-strategy] 未知检查类型: ${type}`)
  }
  return found as CrossReferenceCheckPolicy
}

// ─── 文档 tier 解析 ──────────────────────────────────────────────────────────

const VALID_TIERS = new Set<DocTier>(['core', 'important', 'reference'])

/** 路径分类（与 doc-rule-validator.classifyTier 保持一致的冻结实现副本） */
export function classifyTier(relPath: string): DocTier {
  const p = relPath.toLowerCase()
  if (p.startsWith('meta/') && !p.includes('deprecated') && !p.includes('old-versions')) return 'core'
  if (
    p.startsWith('reference/') &&
    [
      'api-contract',
      'data-dictionary',
      'data-definition',
      'architecture-standards',
      'engine-specs',
      'quality-gates',
      'routing-specs',
      'data-flow-spec',
      'databridge',
      'functional-module',
    ].some((k) => p.includes(k))
  ) {
    return 'core'
  }
  if (p.startsWith('reports/') || p.startsWith('archive/') || p.startsWith('drafts/')) return 'reference'
  if (/^adr-\d{3}/.test(basename(relPath).toLowerCase())) return 'reference'
  if (/^\d{4}-\d{2}-\d{2}/.test(basename(relPath))) return 'reference'
  if (['report', 'audit', 'review', 'remediation', 'rectification', 'retrospective'].some((k) => p.includes(k))) {
    return 'reference'
  }
  return 'important'
}

/**
 * 解析文档 tier：优先 frontmatter `tier` 字段；缺失/非法时回退路径分类。
 * @param docAbsolutePath 文档绝对路径
 * @param docsRoot docs 目录绝对路径（用于计算相对路径做路径分类）
 */
export function resolveDocTier(docAbsolutePath: string, docsRoot: string): DocTier {
  try {
    const content = readFileSync(docAbsolutePath, 'utf-8')
    const fm = content.match(/^---\n([\s\S]*?)\n---/)
    if (fm) {
      const tierMatch = fm[1].match(/^tier:\s*(\w+)/m)
      if (tierMatch && tierMatch[1] && VALID_TIERS.has(tierMatch[1] as DocTier)) {
        return tierMatch[1] as DocTier
      }
    }
  } catch {
    /* 读取失败时使用路径分类 */
  }
  const rel = relative(docsRoot, docAbsolutePath).replace(/\\/g, '/')
  return classifyTier(rel)
}
