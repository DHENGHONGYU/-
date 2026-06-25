/**
 * 输入舱全局配置
 *
 * 集中管理导入、搜索、数据质量等常量，禁止在 UI/服务层硬编码。
 */

export const INPUT_CONFIG = {
  bulkImport: {
    maxRows: 500,
    lineSeparators: /[\n;；、]/,
    inlineSeparators: /[\s,，]+/,
    supportedFormats: ['code', 'code.name', 'code,name'] as const,
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
