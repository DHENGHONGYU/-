/**
 * @fileoverview 批量导入服务（barrel re-export）
 *
 * 原批量导入服务，现作为统一入口 re-export 各子模块 API。
 *
 * 模块拆分（2026-07-07）：
 * - batchImportParsers.ts: 解析层（类型/常量/文本解析/文件解析）
 * - batchImportDetect.ts: 重复检测与模板下载
 * - batchImportExecutor.ts: 导入执行（importStocks/importStocksWithProgress）
 * - batchImportService.ts（本文件）: barrel re-export，保持原导入路径 API 兼容
 *
 * @module services/input/batchImportService
 * @updated 2026-07-07 - 拆分为多模块，保持原 API 兼容
 */

// 解析层：类型 + 常量 + 工具函数 + 文本/文件解析
export type {
  BulkImportRowStatus,
  BulkImportRow,
  BulkImportResult,
} from './batchImportParsers'

export {
  MAX_LINE_LENGTH,
  MAX_NAME_LENGTH,
  BOM_CHAR_CODE,
  STOCK_CODE_PATTERN,
  detectExchange,
  parseBulkInput,
  parseCsvFile,
  parseJsonFile,
  parseExcelFile,
  parseFile,
} from './batchImportParsers'

// 检测与模板
export { detectDuplicates, downloadTemplate } from './batchImportDetect'

// 导入执行
export { type ImportStocksOptions, importStocks, importStocksWithProgress } from './batchImportExecutor'
