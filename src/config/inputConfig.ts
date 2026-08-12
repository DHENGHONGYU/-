/**
 * 输入舱全局配置
 *
 * 集中管理导入、搜索、数据质量等常量，禁止在 UI/服务层硬编码。
  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
*/

export const INPUT_CONFIG = {
  bulkImport: {
    maxRows: 500,
    lineSeparators: /[\n;；、]/,
    inlineSeparators: /[\s,，]+/,
    supportedFormats: ['code', 'code.name', 'code,name', 'code.name.exchange'] as const,
    supportedFileExtensions: ['csv', 'txt', 'json', 'xlsx', 'xls'] as const,
    templateHeader: ['序号', '股票代码', '股票简称'] as const,
    // 模板示例行（描述性占位符，非真实股票代码）
    templateExamples: [] as ReadonlyArray<{ code: string; name: string }>,
    templateFileName: 'stock_import_template.csv',
    batchSize: 20,
    batchIntervalMs: 500,
  },
  quality: {
    requiredBasicFields: ['name', 'industry', 'price', 'pe', 'pb'] as const,
    requiredKlineFields: ['close', 'volume'] as const,
    requiredFinanceFields: ['roe', 'revenueGrowth'] as const,
  },
  search: {
    debounceMs: 200,
    minQueryLength: 1,
    maxResults: 20,
  },
} as const

export type InputConfig = typeof INPUT_CONFIG
