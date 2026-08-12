/**
 * 策略快照导出服务
 *
 * 支持：
 * 1. 导出完整快照为 JSON 文件（离线分析）
 * 2. 导出核心稀缺组合列表为 Excel 文件
 *
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023]
 */

import type { StrategyGroupItem } from './strategySnapshotService'
import type { StrategySnapshot } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** Excel MIME 类型 */
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
/** JSON MIME 类型 */
const JSON_MIME_TYPE = 'application/json'

/** 生成 traceId（时间戳+短随机串）用于串联单条导出链路日志 */
function makeTraceId(prefix = 'EXP'): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${prefix}-${ts}-${rand}`
}

// ============================================================
// 通用文件下载
// ============================================================

/** 触发浏览器文件下载 */
function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') {
    throw new Error('浏览器环境不存在：document 未定义')
  }
  if (!blob || blob.size === 0) {
    throw new Error('下载 Blob 为空或大小为 0')
  }
  let url: string | null = null
  try {
    url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    if (url) URL.revokeObjectURL(url)
  }
}

/** 生成带日期的文件名 */
function buildFilename(prefix: string, ext: 'json' | 'xlsx'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${prefix}_${dateStr}.${ext}`
}

// ============================================================
// JSON 导出
// ============================================================

export interface SnapshotExportResult {
  success: boolean
  filename: string
  error?: string
  traceId?: string
}

/**
 * 导出完整策略快照为 JSON 文件。
 *
 * 包含快照元数据、三策略分组、变更日志，以及每只标的的详细评分因子。
 */
export function exportSnapshotToJson(
  snapshot: StrategySnapshot,
  items?: { core: StrategyGroupItem[]; hot: StrategyGroupItem[]; value: StrategyGroupItem[] },
): SnapshotExportResult {
  const traceId = makeTraceId('JSON')
  const t0 = Date.now()
  logger.info(`[strategySnapshotExport] [${traceId}] JSON 导出开始`, {
    traceId,
    snapshotId: snapshot.id,
    version: snapshot.version,
    coreCount: snapshot.core.count,
    hotCount: snapshot.hot.count,
    valueCount: snapshot.value.count,
    hasDetails: !!items,
  })
  try {
    const exportData = {
      ...snapshot,
      details: items
        ? {
            core: items.core.map(toDetailedItem),
            hot: items.hot.map(toDetailedItem),
            value: items.value.map(toDetailedItem),
          }
        : undefined,
      exportedAt: new Date().toISOString(),
      exportedBy: 'strategySnapshotExport.ts',
    }

    logger.debug(`[strategySnapshotExport] [${traceId}] 序列化 JSON 中`, {
      traceId,
      detailKeys: Object.keys(exportData.details ?? {}),
    })
    const jsonStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonStr], { type: JSON_MIME_TYPE })
    const filename = buildFilename(`strategy_snapshot_v${snapshot.version}`, 'json')

    logger.debug(`[strategySnapshotExport] [${traceId}] 触发浏览器下载`, {
      traceId,
      filename,
      blobSize: blob.size,
    })
    downloadBlob(blob, filename)
    logger.info(`[strategySnapshotExport] [${traceId}] JSON 导出成功`, {
      traceId,
      filename,
      snapshotId: snapshot.id,
      blobSize: blob.size,
      elapsedMs: Date.now() - t0,
    })
    return { success: true, filename }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    logger.error(`[strategySnapshotExport] [${traceId}] JSON 导出失败`, {
      traceId,
      snapshotId: snapshot.id,
      error: msg,
      stack,
      elapsedMs: Date.now() - t0,
    })
    return { success: false, filename: '', error: msg, traceId }
  }
}

/** 将 StrategyGroupItem 转为包含完整评分因子的详细对象 */
function toDetailedItem(item: StrategyGroupItem) {
  return {
    symbol: item.symbol,
    name: item.name,
    classification: item.classification,
    composite: item.composite,
    l1Score: item.l1Score ?? null,
    l7Score: item.l7Score ?? null,
    l3v: item.l3v,
    l3fScore: item.l3fScore ?? null,
    resonance: item.resonance ?? null,
    reasons: item.reasons,
  }
}

// ============================================================
// Excel 导出
// ============================================================

/**
 * 导出策略组合列表为 Excel 文件。
 *
 * @param items 要导出的策略组合 items（通常是核心稀缺组合）
 * @param sheetName Sheet 名称（如"核心稀缺"）
 */
export async function exportGroupToExcel(
  items: StrategyGroupItem[],
  sheetName = '核心稀缺组合',
): Promise<SnapshotExportResult> {
  const traceId = makeTraceId('XLSX-GRP')
  const t0 = Date.now()
  logger.info(`[strategySnapshotExport] [${traceId}] 单组 Excel 导出开始`, {
    traceId,
    sheetName,
    rowCount: items.length,
  })
  try {
    if (items.length === 0) {
      logger.warn(`[strategySnapshotExport] [${traceId}] Excel 导出跳过：无数据`, {
        traceId,
        sheetName,
      })
      return { success: false, filename: '', error: '导出数据为空' }
    }

    logger.debug(`[strategySnapshotExport] [${traceId}] 动态加载 xlsx 库`)
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    logger.debug(`[strategySnapshotExport] [${traceId}] 构建 ${items.length} 行数据`)
    const rows: Array<Record<string, string | number>> = items.map((item, idx) => ({
      序号: idx + 1,
      股票代码: item.symbol,
      股票名称: item.name,
      综合评分: item.composite,
      估值分_L1: item.l1Score ?? '-',
      情绪分_L7: item.l7Score ?? '-',
      质量分_L3V: item.l3v,
      质量分_L3F: item.l3fScore ?? '-',
      板块共振: item.resonance ?? '-',
      策略分类: classifyLabel(item.classification),
      入选原因: item.reasons.join('；'),
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 60 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE })
    const filename = buildFilename(sheetName, 'xlsx')

    logger.debug(`[strategySnapshotExport] [${traceId}] 触发下载`, {
      traceId,
      filename,
      blobSize: blob.size,
    })
    downloadBlob(blob, filename)
    logger.info(`[strategySnapshotExport] [${traceId}] 单组 Excel 导出成功`, {
      traceId,
      filename,
      rowCount: items.length,
      sheetName,
      blobSize: blob.size,
      elapsedMs: Date.now() - t0,
    })
    return { success: true, filename }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    logger.error(`[strategySnapshotExport] [${traceId}] 单组 Excel 导出失败`, {
      traceId,
      sheetName,
      rowCount: items.length,
      error: msg,
      stack,
      elapsedMs: Date.now() - t0,
    })
    return { success: false, filename: '', error: msg, traceId }
  }
}

/** 策略分类中文标签 */
function classifyLabel(classification: 'core' | 'hot' | 'value'): string {
  switch (classification) {
    case 'core':
      return '核心稀缺'
    case 'hot':
      return '热点动量'
    case 'value':
      return '价值洼地'
  }
}

// ============================================================
// 批量导出（三策略分组到一个 Excel 的多个 Sheet）
// ============================================================

/**
 * 导出三策略分组到多 Sheet Excel 文件。
 */
export async function exportAllGroupsToExcel(
  groups: { core: StrategyGroupItem[]; hot: StrategyGroupItem[]; value: StrategyGroupItem[] },
): Promise<SnapshotExportResult> {
  const traceId = makeTraceId('XLSX-ALL')
  const t0 = Date.now()
  logger.info(`[strategySnapshotExport] [${traceId}] 全量 Excel 导出开始`, {
    traceId,
    core: groups.core.length,
    hot: groups.hot.length,
    value: groups.value.length,
  })
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    const sheetConfigs: Array<{ items: StrategyGroupItem[]; name: string }> = [
      { items: groups.core, name: '核心稀缺' },
      { items: groups.hot, name: '热点动量' },
      { items: groups.value, name: '价值洼地' },
    ]

    for (const { items, name } of sheetConfigs) {
      if (items.length === 0) continue
      logger.debug(`[strategySnapshotExport] [${traceId}] 构建 Sheet=${name} rows=${items.length}`)
      const rows = items.map((item, idx) => ({
        序号: idx + 1,
        股票代码: item.symbol,
        股票名称: item.name,
        综合评分: item.composite,
        估值分_L1: item.l1Score ?? '-',
        情绪分_L7: item.l7Score ?? '-',
        质量分_L3V: item.l3v,
        质量分_L3F: item.l3fScore ?? '-',
        板块共振: item.resonance ?? '-',
        入选原因: item.reasons.join('；'),
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 60 },
      ]
      XLSX.utils.book_append_sheet(wb, ws, name)
    }

    if (wb.SheetNames.length === 0) {
      const ws = XLSX.utils.json_to_sheet([{ 提示: '暂无策略组合数据' }])
      XLSX.utils.book_append_sheet(wb, ws, '空数据')
    }

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE })
    const filename = buildFilename('策略组合全量', 'xlsx')

    logger.debug(`[strategySnapshotExport] [${traceId}] 触发下载`, {
      traceId,
      filename,
      sheets: wb.SheetNames.length,
      blobSize: blob.size,
    })
    downloadBlob(blob, filename)
    logger.info(`[strategySnapshotExport] [${traceId}] 全量 Excel 导出成功`, {
      traceId,
      filename,
      sheets: wb.SheetNames.length,
      blobSize: blob.size,
      elapsedMs: Date.now() - t0,
    })
    return { success: true, filename }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    logger.error(`[strategySnapshotExport] [${traceId}] 全量 Excel 导出失败`, {
      traceId,
      error: msg,
      stack,
      elapsedMs: Date.now() - t0,
    })
    return { success: false, filename: '', error: msg, traceId }
  }
}

// ============================================================
// 任务3：批量导出（多快照 -> 多 Sheet Excel）
// ============================================================

export interface BatchExportResult extends SnapshotExportResult {
  snapshotCount: number
  sheetCount: number
  failedIds?: string[]
  traceId?: string
}

/** Excel Sheet 名称最大长度（Excel 限制） */
const SHEET_NAME_MAX_LENGTH = 31
/** Excel Sheet 名称中不允许的字符 */
const SHEET_NAME_ILLEGAL_CHARS = /[:\\/?*[\]]/g

/**
 * 构建唯一的 Excel Sheet 名称。
 *
 * 处理规则：
 * 1. 清理非法字符（: \ / ? * [ ]）
 * 2. 截断到 31 字符（为后缀留出空间）
 * 3. 如果名称已存在于 existingNames，追加 ` (2)` / ` (3)` 后缀直到唯一
 *
 * @param baseName 基础名称
 * @param existingNames 已存在的 Sheet 名称集合（会被原地修改）
 * @returns 唯一的 Sheet 名称
 */
export function buildUniqueSheetName(baseName: string, existingNames: Set<string>): string {
  // 1. 清理非法字符
  let cleaned = baseName.replace(SHEET_NAME_ILLEGAL_CHARS, '_')

  // 2. 截断到 31 字符（为后缀留空间，先截到 28）
  const maxBaseLength = SHEET_NAME_MAX_LENGTH - 3 // 留 3 字符给 " (N)" 后缀
  if (cleaned.length > SHEET_NAME_MAX_LENGTH) {
    cleaned = cleaned.slice(0, maxBaseLength)
  }

  // 3. 去重：如果名称已存在，追加后缀
  let finalName = cleaned.length > SHEET_NAME_MAX_LENGTH ? cleaned.slice(0, SHEET_NAME_MAX_LENGTH) : cleaned
  let suffix = 2
  while (existingNames.has(finalName)) {
    const suffixStr = ` (${suffix})`
    const availableLength = SHEET_NAME_MAX_LENGTH - suffixStr.length
    finalName = `${cleaned.slice(0, availableLength)}${suffixStr}`
    suffix++
  }

  existingNames.add(finalName)
  return finalName
}

/**
 * 批量导出多个策略快照到一个 Excel 文件。
 *
 * 每个快照的核心/热点/价值标的合并为独立 Sheet（Sheet 名为 `V{版本}-{策略}`），
 * 另外附带一个「快照汇总」Sheet 记录每个快照的元数据。
 *
 * Sheet 命名安全处理：
 * - 非法字符清理（: \ / ? * [ ] → _）
 * - 超过 31 字符自动截断
 * - 同名 Sheet 自动追加 ` (2)` / ` (3)` 后缀去重
 */
export async function exportBatchSnapshotsToExcel(
  snapshots: StrategySnapshot[],
): Promise<BatchExportResult> {
  const traceId = makeTraceId('XLSX-BATCH')
  const t0 = Date.now()
  const failedIds: string[] = []
  const usedSheetNames = new Set<string>()

  logger.info(`[strategySnapshotExport] [${traceId}] 批量快照 Excel 导出开始`, {
    traceId,
    snapshotCount: snapshots.length,
    snapshotIds: snapshots.map((s) => `${s.id}(v${s.version})`),
  })

  try {
    if (snapshots.length === 0) {
      logger.warn(`[strategySnapshotExport] [${traceId}] 批量导出跳过：快照列表为空`)
      return { success: false, filename: '', error: '快照列表为空', snapshotCount: 0, sheetCount: 0 }
    }

    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // 构建汇总 Sheet
    const summaryRows = snapshots.map((s, idx) => ({
      序号: idx + 1,
      版本: s.version,
      快照ID: s.id,
      日期: s.date,
      时间: s.time,
      触发器: s.trigger,
      标的总数: s.stockCount,
      核心稀缺: s.core.count,
      热点动量: s.hot.count,
      价值洼地: s.value.count,
      核心最大分: s.core.maxComposite.toFixed(2),
      核心平均分: s.core.avgComposite.toFixed(2),
      核心标的: s.core.symbols.join('、'),
    }))
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows)
    summaryWs['!cols'] = [
      { wch: 6 }, { wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 80 },
    ]
    const summarySheetName = buildUniqueSheetName('快照汇总', usedSheetNames)
    XLSX.utils.book_append_sheet(wb, summaryWs, summarySheetName)

    // 记录是否有任何分组数据被加入
    let groupSheetCount = 0

    // 为每个快照构建 Sheet：V{version}-{策略}
    // 使用快照序号作为区分，避免同版本号快照的 Sheet 名冲突
    for (let sIdx = 0; sIdx < snapshots.length; sIdx++) {
      const snapshot = snapshots[sIdx]!
      const groups: Array<{
        key: 'core' | 'hot' | 'value'
        items: Array<{ symbol: string; name: string; composite: number; classification: string }>
      }> = [
        { key: 'core', items: snapshot.core.items },
        { key: 'hot', items: snapshot.hot.items },
        { key: 'value', items: snapshot.value.items },
      ]

      for (const group of groups) {
        if (group.items.length === 0) continue
        // Sheet 名格式：V{版本}-{策略}，同版本时 buildUniqueSheetName 会自动加后缀
        const baseName = `V${snapshot.version}-${labelShort(group.key)}`
        const sheetName = buildUniqueSheetName(baseName, usedSheetNames)
        logger.debug(`[strategySnapshotExport] [${traceId}] 构建 Sheet=${sheetName}`, {
          traceId,
          baseName,
          finalName: sheetName,
          snapshotIdx: sIdx,
          groupKey: group.key,
          itemCount: group.items.length,
        })
        const rows = group.items.map((item, idx) => ({
          序号: idx + 1,
          股票代码: item.symbol,
          股票名称: item.name,
          综合评分: item.composite,
          策略分类: item.classification,
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
        groupSheetCount++
      }
    }

    // 如果没有任何分组数据 Sheet（只有汇总），补充一个空数据 Sheet
    if (groupSheetCount === 0) {
      const ws = XLSX.utils.json_to_sheet([{ 提示: '无可导出的快照分组数据' }])
      const emptyName = buildUniqueSheetName('空数据', usedSheetNames)
      XLSX.utils.book_append_sheet(wb, ws, emptyName)
    }

    logger.debug(`[strategySnapshotExport] [${traceId}] Sheet 列表`, {
      traceId,
      sheetNames: wb.SheetNames,
      sheetCount: wb.SheetNames.length,
    })

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE })
    const filename = buildFilename(`策略快照批量_${snapshots.length}个`, 'xlsx')

    logger.debug(`[strategySnapshotExport] [${traceId}] 触发下载`, {
      traceId,
      filename,
      sheets: wb.SheetNames.length,
      blobSize: blob.size,
    })
    downloadBlob(blob, filename)
    logger.info(`[strategySnapshotExport] [${traceId}] 批量快照 Excel 导出成功`, {
      traceId,
      filename,
      snapshotCount: snapshots.length,
      sheetCount: wb.SheetNames.length,
      sheetNames: wb.SheetNames,
      blobSize: blob.size,
      failedCount: failedIds.length,
      elapsedMs: Date.now() - t0,
    })
    return {
      success: true,
      filename,
      snapshotCount: snapshots.length,
      sheetCount: wb.SheetNames.length,
      failedIds,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    logger.error(`[strategySnapshotExport] [${traceId}] 批量快照 Excel 导出失败`, {
      traceId,
      snapshotCount: snapshots.length,
      error: msg,
      stack,
      elapsedMs: Date.now() - t0,
    })
    return {
      success: false,
      filename: '',
      error: msg,
      snapshotCount: snapshots.length,
      sheetCount: 0,
      failedIds,
      traceId,
    }
  }
}

/** 策略短标签（for Sheet 名称） */
function labelShort(key: 'core' | 'hot' | 'value'): string {
  switch (key) {
    case 'core':
      return '核心稀缺'
    case 'hot':
      return '热点动量'
    case 'value':
      return '价值洼地'
  }
}

// 重新导出类型，方便消费方使用
export type { StrategySnapshot, StrategyGroupItem }
