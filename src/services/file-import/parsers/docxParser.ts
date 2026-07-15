/**
 * @fileoverview DOCX 文件解析器（预留桩）
 *
 * DOCX 二进制解析需要 mammoth.js 库，当前为预留接口。
 * 实际解析时返回文件元数据占位记录，内容待接入 mammoth.js 后实现。
 *
 * 接入方案：
 * 1. 安装 mammoth：npm install mammoth
 * 2. 使用 mammoth.extractRawText({ arrayBuffer }) 提取文本
 * 3. 替换 parse() 方法中的占位逻辑
 *
 * @module services/file-import/parsers/docxParser
 * @created 2026-07-14 - 双通道整改 P3-1
 */

import { getLogger } from '@/lib/logger'
import { STORE_NAME } from '@/config/dbConfig'
import type { FileParser, ParseOptions, ParsedData } from '@/types/modules/data-sync.types'

const logger = getLogger()

/**
 * DOCX/DOC 文件解析器（预留桩）
 *
 * 当前仅生成占位记录，不解析 Word 内容。
 * 待接入 mammoth.js 后替换为完整实现。
 */
export const docxParser: FileParser = {
  extensions: ['docx', 'doc'],
  dataType: 'researchReports',

  async parse(file: File, _options?: ParseOptions): Promise<ParsedData> {
    logger.info('[docxParser] DOCX 解析（预留桩）', {
      fileName: file.name,
      fileSize: file.size,
      note: 'DOCX 二进制解析待接入 mammoth.js，当前仅生成占位记录',
    })

    const record: Record<string, unknown> = {
      id: `${file.name}-${file.lastModified}`,
      fileName: file.name,
      title: file.name.replace(/\.(docx?|DOCX?)$/i, ''),
      content: `[Word 文件待解析] ${file.name}（${(file.size / 1024).toFixed(1)} KB）`,
      fileSize: file.size,
      lastModified: new Date(file.lastModified).toISOString(),
      source: 'file-import',
      parseStatus: 'pending',
    }

    return {
      dataType: 'researchReports',
      targetStore: STORE_NAME.localDocs,
      records: [record],
      parseMeta: {
        totalRows: 1,
        parsedRows: 1,
        skippedRows: 0,
        columns: Object.keys(record),
      },
    }
  },
}
