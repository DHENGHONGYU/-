/**
 * @fileoverview 批量导入重复检测与模板下载
 *
 * 从 batchImportService.ts 拆分而来，职责：
 * - 实现 detectDuplicates：检测重复并标记行级状态（valid/duplicate/invalid）
 * - 实现 downloadTemplate：下载 CSV 导入模板（含表头与示例数据）
 *
 * 设计原则：纯函数 + DOM I/O，无副作用，不写 db。
 *
 * @module services/input/batchImportDetect
 * @created 2026-07-07 - 从 batchImportService.ts 拆分
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { INPUT_CONFIG } from '@/config/inputConfig'
import { getLogger } from '@/lib/logger'

import { BOM_CHAR_CODE, STOCK_CODE_PATTERN, type BulkImportRow } from './batchImportParsers'

const logger = getLogger()

/**
 * 检测重复并标记每行状态
 *
 * - 代码格式不合规 → invalid
 * - 与现有意向候选池重复 / 批次内重复 → duplicate
 * - 其余 → valid
 *
 * @param rows 待检测的行
 * @param existingSymbols 现有意向候选池 symbol 集合（如 "600519.SH"）
 */
export function detectDuplicates(
  rows: BulkImportRow[],
  existingSymbols: Set<string>,
): BulkImportRow[] {
  logger.info('[batchImport] 检测重复与校验', {
    rowCount: rows.length,
    existingCount: existingSymbols.size,
  })

  const seenInBatch = new Set<string>()

  const result = rows.map((row) => {
    // 代码格式校验
    if (!STOCK_CODE_PATTERN.test(row.code)) {
      return {
        ...row,
        status: 'invalid' as const,
        statusReason: '代码格式不合规（需为 6 位数字）',
      }
    }
    // 与意向候选池重复
    if (existingSymbols.has(row.symbol)) {
      return {
        ...row,
        status: 'duplicate' as const,
        statusReason: '与意向候选池已存在重复',
      }
    }
    // 批次内重复
    if (seenInBatch.has(row.symbol)) {
      return {
        ...row,
        status: 'duplicate' as const,
        statusReason: '与本次导入列表内重复',
      }
    }
    seenInBatch.add(row.symbol)
    return { ...row, status: 'valid' as const, statusReason: undefined }
  })

  const counts = result.reduce(
    (acc, r) => {
      acc[r.status]++
      return acc
    },
    { valid: 0, duplicate: 0, invalid: 0 },
  )
  logger.info('[batchImport] 重复检测完成', counts)

  return result
}

/**
 * 下载 CSV 导入模板（含表头与示例数据）
 *
 * 使用 Blob + URL.createObjectURL 触发浏览器下载，附带 BOM 以兼容 Excel。
 * 支持两种格式：
 * - 序号,股票代码,股票简称（如：1,600519.SH,贵州茅台）
 * - 代码,名称（如：600519,贵州茅台）
 */
export function downloadTemplate(): void {
  logger.info('[batchImport] 下载导入模板')
  try {
    const header = INPUT_CONFIG.bulkImport.templateHeader.join(',')
    const examples = INPUT_CONFIG.bulkImport.templateExamples
      .map((e, idx) => `${idx + 1},${e.code},${e.name}`)
      .join('\n')
    const content = `${String.fromCharCode(BOM_CHAR_CODE)}${header}\n${examples}\n`

    logger.debug('[batchImport] 生成模板内容', { header, exampleCount: INPUT_CONFIG.bulkImport.templateExamples.length })

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = INPUT_CONFIG.bulkImport.templateFileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    logger.info('[batchImport] 模板下载成功', { fileName: INPUT_CONFIG.bulkImport.templateFileName, size: blob.size })
  } catch (err) {
    logger.error('[batchImport] 模板下载失败', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
