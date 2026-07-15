/**
 * @fileoverview 机制健康运行时监控服务（三合一：自扫描 / 自诊断 / 自更新）
 *
 * 将 `scripts/mechanism-self-diagnose.ts`（构建期 Node 脚本）的核心逻辑
 * 移植为**运行时浏览器版**：使用 Vite `import.meta.glob` 以 `?raw` 形式
 * 预加载关键源文件，配合运行时模块的"存活探针"，对三类机制
 * （SOP 自动触发 / 文档自动更新 / 日志自动更新）做自扫描与自诊断。
 *
 * 设计要点（遵循 AGENTS.md 分层）：
 * - 本服务保持**无状态**，仅提供 `runMechanismScan()` 与事件常量；
 *   定时器/历史趋势由 `mechanismHealthStore` 持有（仿 systemMonitorStore）。
 * - 不直接调用 `useToast`（hooks 仅限 UI 层），改为通过 eventBus 广播
 *   `mechanism:alert`，由 Widget 订阅后触发全局 Toast（跨切面提醒）。
 *
 * @module services/system/mechanismMonitorService
 */

import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { createCircuitBreaker } from '@/services/resilience'
import { captureError } from '@/services/errorBus'

const logger = getLogger()

/** 机制类别 */
export type MechanismCategory = 'sop' | 'doc' | 'log'

/** 单探针状态 */
export type MechanismProbeStatus = 'active' | 'inactive'

/** 单探针结果 */
export interface MechanismProbe {
  id: string
  category: MechanismCategory
  label: string
  status: MechanismProbeStatus
  detail: string
}

/** 按类别统计 */
export interface MechanismCategoryStat {
  total: number
  active: number
}

/** 一次扫描快照（即"自更新"写入的内容单元） */
export interface MechanismHealthSnapshot {
  timestamp: number
  probes: MechanismProbe[]
  summary: {
    total: number
    active: number
    activatedRatio: number
    byCategory: Record<MechanismCategory, MechanismCategoryStat>
  }
}

/** eventBus 事件名（与 COLLECTION_EVENTS 同风格，使用字面量通道） */
export const MECHANISM_SCAN_EVENT = 'mechanism:scan:completed'
export const MECHANISM_ALERT_EVENT = 'mechanism:alert'

/** 激活率低于该阈值即广播告警（19 探针中 ≥1 项失活即触发） */
export const MECHANISM_ALERT_THRESHOLD = 0.95

/**
 * 探针定义。
 * - `live`：运行时存活检查（导入的模块导出是否可调用）。
 * - `file` + `markers`：源文件标记检查（通过 import.meta.glob 预加载内容做正则匹配）。
 * - `fileGlob`：在多个同名/同后缀文件中任一命中即可。
 */
interface ProbeDef {
  id: string
  category: MechanismCategory
  label: string
  live?: () => boolean
  file?: string
  fileGlob?: boolean
  markers?: RegExp[]
}

/**
 * 以 raw 形式预加载关键源文件（构建期静态分析，浏览器运行时零 fs 依赖）。
 * 仅包含确需扫描的小批量文件，控制打包体积。
 */
const RAW_SOURCES = import.meta.glob(
  [
    '../../../scripts/doc-update-trigger.ts',
    '../../../scripts/mechanism-self-diagnose.ts',
    '../../../scripts/doc-auto-updater.ts',
    '../../../scripts/build-ai-memory-index.ts',
    '../../../package.json',
    '../../../.husky/pre-commit',
    '../../../src/types/modules/collection.types.ts',
    '../../../src/services/data-collector/dataSourceOrchestrator.ts',
    '../../../src/services/data-collector/collectionPipeline.ts',
    '../../../src/services/data-collector/qualityMetricsCollector.ts',
    '../../../src/services/system/systemMonitorService.ts',
    '../../../src/services/system/monitorLogService.ts',
    '../../../src/services/errorBus.ts',
    '../../../src/services/resilience.ts',
    '../../../src/lib/eventBus.ts',
    '../../../src/lib/logger.ts',
    '../../../src/**/security-policy.ts',
    '../../../../../../docs/00-meta/doc-trigger-action-map.md',
    '../../../.github/workflows/*.yml',
  ],
  { query: '?raw', import: 'default', eager: true },
)

/** basename -> 源文件内容 */
const SOURCE_BY_BASENAME = new Map<string, string>()
for (const [key, content] of Object.entries(RAW_SOURCES)) {
  const base = key.split('/').pop() ?? key
  SOURCE_BY_BASENAME.set(base, content as string)
}

/**
 * 在指定 basename 的源文件中检查全部标记是否命中。
 */
function rawHas(basename: string, patterns: RegExp[]): boolean {
  const content = SOURCE_BY_BASENAME.get(basename)
  if (content === undefined) return false
  return patterns.every((re) => re.test(content))
}

/**
 * 在任意 basename 包含 nameSubstr 的源文件中检查全部标记是否命中（用于同名多文件）。
 */
function rawHasAny(nameSubstr: string, patterns: RegExp[]): boolean {
  for (const [base, content] of SOURCE_BY_BASENAME) {
    if (!base.includes(nameSubstr)) continue
    if (patterns.every((re) => re.test(content))) return true
  }
  return false
}

const PROBES: ProbeDef[] = [
  // ============ A 类：SOP 自动触发 ============
  {
    id: 'A1',
    category: 'sop',
    label: 'EventBus 运行时事件总线',
    live: () => typeof eventBus?.on === 'function' && typeof eventBus?.emit === 'function',
  },
  {
    id: 'A2',
    category: 'sop',
    label: '采集生命周期事件 (COLLECTION_EVENTS)',
    file: 'collection.types.ts',
    markers: [/collect:triggered/, /COLLECTION_EVENTS/],
  },
  {
    id: 'A3',
    category: 'sop',
    label: '采集编排四层降级',
    file: 'dataSourceOrchestrator.ts',
    markers: [/fallback/i, /repairMissingScores/],
  },
  {
    id: 'A4',
    category: 'sop',
    label: '流水线自修复 (repairMissingScores)',
    file: 'collectionPipeline.ts',
    markers: [/repairMissingScores/],
  },
  {
    id: 'A5',
    category: 'sop',
    label: 'Git 门禁 (husky pre-commit)',
    file: 'pre-commit',
    markers: [/audit:layers/, /tsc/],
  },
  {
    id: 'A6',
    category: 'sop',
    label: 'CI 定时工作流',
    fileGlob: true,
    file: '.yml',
    markers: [/mechanism|doc-update|quality-check/i],
  },
  // ============ B 类：文档自动更新 ============
  {
    id: 'B1',
    category: 'doc',
    label: '文档触发器 TRIGGER_RULES',
    file: 'doc-update-trigger.ts',
    markers: [/TRIGGER_RULES/],
  },
  {
    id: 'B2',
    category: 'doc',
    label: 'DocGenerator 幂等标记',
    file: 'doc-update-trigger.ts',
    markers: [/auto-update/],
  },
  {
    id: 'B3',
    category: 'doc',
    label: '触发→动作映射表',
    file: 'doc-trigger-action-map.md',
    markers: [/触发/, /动作/],
  },
  {
    id: 'B4',
    category: 'doc',
    label: 'audit:docs 同步校验',
    file: 'package.json',
    markers: [/audit:docs/],
  },
  {
    id: 'B5',
    category: 'doc',
    label: 'build:health 健康报告',
    file: 'package.json',
    markers: [/build:health/],
  },
  {
    id: 'B6',
    category: 'doc',
    label: 'AI 记忆索引构建',
    file: 'build-ai-memory-index.ts',
    markers: [/ai-memory-index/],
  },
  {
    id: 'B7',
    category: 'doc',
    label: 'doc-auto-updater 服务',
    file: 'doc-auto-updater.ts',
    markers: [/auto-update/],
  },
  // ============ C 类：日志自动更新 ============
  {
    id: 'C1',
    category: 'log',
    label: '统一日志 logger',
    live: () => typeof getLogger === 'function',
  },
  {
    id: 'C2',
    category: 'log',
    label: '采集追踪 (traceId / tracePersistence)',
    file: 'qualityMetricsCollector.ts',
    markers: [/traceId|tracePersistence|collect:trace/i],
  },
  {
    id: 'C3',
    category: 'log',
    label: '熔断告警 (CircuitBreaker)',
    live: () => typeof createCircuitBreaker === 'function',
  },
  {
    id: 'C4',
    category: 'log',
    label: '安全审计日志 (writeAuditLog)',
    fileGlob: true,
    file: 'security-policy.ts',
    markers: [/writeAuditLog/],
  },
  {
    id: 'C5',
    category: 'log',
    label: '系统监控服务',
    file: 'systemMonitorService.ts',
    markers: [/startMonitoring|monitor/i],
  },
  {
    id: 'C6',
    category: 'log',
    label: '错误总线 (errorBus)',
    live: () => typeof captureError === 'function',
  },
]

/** 导出探针定义，供 UI 展示标签 */
export const MECHANISM_PROBES = PROBES

/**
 * 运行一次机制健康扫描（自扫描 + 自诊断）。
 * 纯函数式：返回快照，并通过 eventBus 广播完成/告警事件。
 *
 * @returns 本次扫描快照
 */
export function runMechanismScan(): MechanismHealthSnapshot {
  const probes: MechanismProbe[] = PROBES.map((def) => {
    let ok = false
    let detail = ''

    try {
      if (def.live) {
        ok = def.live()
        detail = ok ? '运行时可调用' : '模块导出缺失'
      } else if (def.file) {
        if (def.fileGlob) {
          ok = rawHasAny(def.file, def.markers ?? [])
          detail = ok ? '源文件命中标记' : `未命中: ${def.file}`
        } else {
          const source = SOURCE_BY_BASENAME.get(def.file)
          if (source === undefined) {
            ok = false
            detail = `源文件未扫描到: ${def.file}`
          } else {
            ok = rawHas(def.file, def.markers ?? [])
            detail = ok ? '标记齐全' : '标记缺失'
          }
        }
      }
    } catch (err) {
      ok = false
      detail = `检测异常: ${String(err)}`
    }

    return {
      id: def.id,
      category: def.category,
      label: def.label,
      status: ok ? 'active' : 'inactive',
      detail,
    }
  })

  const total = probes.length
  const active = probes.filter((p) => p.status === 'active').length

  const byCategory: Record<MechanismCategory, MechanismCategoryStat> = {
    sop: { total: 0, active: 0 },
    doc: { total: 0, active: 0 },
    log: { total: 0, active: 0 },
  }
  for (const p of probes) {
    byCategory[p.category].total += 1
    if (p.status === 'active') byCategory[p.category].active += 1
  }

  const snapshot: MechanismHealthSnapshot = {
    timestamp: Date.now(),
    probes,
    summary: {
      total,
      active,
      activatedRatio: total > 0 ? active / total : 0,
      byCategory,
    },
  }

  eventBus.emit(MECHANISM_SCAN_EVENT, snapshot)
  logger.info(`[MechanismMonitor] scan completed: ${active}/${total} active`)

  if (snapshot.summary.activatedRatio < MECHANISM_ALERT_THRESHOLD) {
    eventBus.emit(MECHANISM_ALERT_EVENT, snapshot)
    logger.warn('[MechanismMonitor] alert: activated ratio below threshold')
  }

  return snapshot
}
