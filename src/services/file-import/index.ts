/**
 * @fileoverview 文件导入服务 barrel export
 *
 * 统一导出文件校验、解析、差异分析、哈希比对、校对报告等模块。
 *
 * @module services/file-import
 * @created 2026-07-14 - 双通道整改 P0-1~P0-4
 */

// 校验器
export {
  validateFile,
  validateFiles,
  ALLOWED_EXTENSIONS,
  MAX_BUSINESS_FILE_SIZE,
  MAX_DOC_FILE_SIZE,
  MAX_ROW_COUNT,
  MAX_LINE_LENGTH,
} from './unifiedFileValidator'

// 解析器注册表
export {
  registerParser,
  getParser,
  getParserByFileName,
  parseFile,
  getAllParsers,
  getSupportedExtensions,
  isExtensionSupported,
  clearParsers,
} from './parserRegistry'

// 解析器实现
export { csvParser } from './parsers/csvParser'
export { jsonParser } from './parsers/jsonParser'
export { excelParser } from './parsers/excelParser'
export { markdownParser } from './parsers/markdownParser'
export { pdfParser } from './parsers/pdfParser'
export { docxParser } from './parsers/docxParser'

// 哈希比对
export {
  computeRecordHash,
  computeFileHash,
  compareHashes,
  buildFileHashComparison,
} from './hashComparator'

// 差异分析
export {
  analyzeDiff,
  quickDiff,
} from './diffAnalyzer'

// 校对报告
export {
  generateProofreadReport,
  renderReportAsMarkdown,
} from './proofreadReportGenerator'

// 解析器自动注册
import { registerParser } from './parserRegistry'
import { csvParser } from './parsers/csvParser'
import { jsonParser } from './parsers/jsonParser'
import { excelParser } from './parsers/excelParser'
import { markdownParser } from './parsers/markdownParser'
import { pdfParser } from './parsers/pdfParser'
import { docxParser } from './parsers/docxParser'

// 自动注册内置解析器
registerParser(csvParser)
registerParser(jsonParser)
registerParser(excelParser)
registerParser(markdownParser)
registerParser(pdfParser)
registerParser(docxParser)
