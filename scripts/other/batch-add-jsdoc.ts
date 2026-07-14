/**
 * 批量补齐 JSDoc 缺失（基于 audit-jsdoc.ts 报告）
 * 在 29 处缺失点插入标准 JSDoc 注释。
 */
/**
 * @file batch-add-jsdoc.ts
 * @description 批量补齐 JSDoc 缺失（基于 audit-jsdoc.ts 报告），在缺失点插入标准 JSDoc 注释
 * @status 孤立脚本（未在 package.json 中引用）
 * @category 未接入审计流水线 — 评估后接入
 * @maintainer 待定
 * @lastVerified 2026-07-13
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = process.cwd()

interface JsdocEntry {
  file: string
  line: number // 1-based line of the export/declaration
  jsdoc: string[]
}

const entries: JsdocEntry[] = [
  // ======= services/ =======
  {
    file: 'src/services/trading/tradeReviewAI.utils.ts',
    line: 40,
    jsdoc: [
      '/**',
      ' * 从订单列表构建交易对列表：按 symbol 分组，将买入/卖出配对。',
      ' * @param orders 原始订单数组',
      ' * @returns 配对的交易对列表',
      ' */',
    ],
  },
  {
    file: 'src/services/input/inputService.ts',
    line: 103,
    jsdoc: [
      '/**',
      ' * 添加股票到股票池：规范化 symbol + 名称，获取 K 线数据，写入 dataLayer。',
      ' * @param input 添加股票的输入（symbol, name 等）',
      ' * @param options 可选配置项',
      ' * @returns 添加结果，包含 Stock 数据',
      ' */',
    ],
  },
  {
    file: 'src/services/input/batchImportParsers.ts',
    line: 394,
    jsdoc: [
      '/**',
      ' * 解析上传的 JSON 批量导入文件。',
      ' * @param file 上传的 File 对象',
      ' * @returns 解析后的批量导入行数组',
      ' */',
    ],
  },
  {
    file: 'src/services/input/batchImportExecutor.ts',
    line: 174,
    jsdoc: [
      '/**',
      ' * 带进度回调的批量导入执行器。',
      ' * @param rows 要导入的行数据',
      ' * @param options 导入选项',
      ' * @param onProgress 进度回调 (completed, total, percent)',
      ' * @returns 导入结果（成功/失败统计）',
      ' */',
    ],
  },
  {
    file: 'src/services/fetcher/orchestrator/phaseOrchestrator.ts',
    line: 168,
    jsdoc: [
      '/**',
      ' * 按维度采集数据：对一组 symbol 执行指定维度的数据采集。',
      ' * @param dimension 数据维度标识',
      ' * @param symbols 待采集的股票 symbol 列表',
      ' * @param deps 采集依赖（读取器、缓存等）',
      ' * @returns 采集结果',
      ' */',
    ],
  },
  {
    file: 'src/services/data-collector/dataSourceOrchestrator.ts',
    line: 711,
    jsdoc: [
      '/**',
      ' * 测试指定数据源的连接连通性。',
      ' * @param source 数据源标识（如 mock, market 等）',
      ' * @returns 连通性结果（ok、延迟、消息）',
      ' */',
    ],
  },
  {
    file: 'src/services/backtest/backtestMetrics.ts',
    line: 172,
    jsdoc: [
      '/**',
      ' * 从虚拟订单列表构建回测交易列表，计算均价成本。',
      ' * @param trades 虚拟订单数组',
      ' * @param _config 回测引擎配置',
      ' * @returns 回测交易列表',
      ' */',
    ],
  },

  // ======= lib/ =======
  {
    file: 'src/lib/xssSanitizer.ts',
    line: 186,
    jsdoc: [
      '/**',
      ' * 安全过滤搜索查询字符串：去除 HTML 标签、控制字符，截断长度。',
      ' * @param input 原始搜索字符串',
      ' * @param maxLength 最大允许长度（默认 100）',
      ' * @returns 安全过滤后的字符串',
      ' */',
    ],
  },
  {
    file: 'src/lib/validation.ts',
    line: 305,
    jsdoc: [
      '/**',
      ' * 脱敏 API Key：仅保留首尾 4 位，中间替换为 ****。',
      ' * @param apiKey 原始 API Key',
      ' * @returns 脱敏后的字符串',
      ' */',
    ],
  },
  {
    file: 'src/lib/safeCoerce.ts',
    line: 159,
    jsdoc: [
      '/** 安全获取字符串值的别名 */',
    ],
  },
  {
    file: 'src/lib/safeCoerce.ts',
    line: 160,
    jsdoc: [
      '/** 安全获取数字值的别名 */',
    ],
  },
  {
    file: 'src/lib/safeCoerce.ts',
    line: 161,
    jsdoc: [
      '/** 安全获取数组值的别名 */',
    ],
  },
  {
    file: 'src/lib/safeCoerce.ts',
    line: 163,
    jsdoc: [
      '/**',
      ' * 通用回退文案集合：用于 loading / empty / error / 未知 状态的展示。',
      ' */',
    ],
  },
  {
    file: 'src/lib/precision.ts',
    line: 8,
    jsdoc: [
      '/**',
      ' * 小数位精度常量：统一控制价格、涨跌幅、百分比、成交量等精度。',
      ' */',
    ],
  },
  {
    file: 'src/lib/precision.ts',
    line: 107,
    jsdoc: [
      '/**',
      ' * 安全获取数组元素（配合 noUncheckedIndexedAccess），支持越界返回 fallback。',
      ' * @param arr 数组',
      ' * @param index 索引',
      ' * @param fallback 越界时的默认值',
      ' * @returns 数组元素或默认值',
      ' */',
    ],
  },
  {
    file: 'src/lib/precision.ts',
    line: 108,
    jsdoc: [
      '/**',
      ' * 安全获取数组元素（配合 noUncheckedIndexedAccess），无 fallback 重载。',
      ' * @param arr 数组',
      ' * @param index 索引',
      ' * @returns 数组元素或 undefined',
      ' */',
    ],
  },
  {
    file: 'src/lib/precision.ts',
    line: 157,
    jsdoc: [
      '/**',
      ' * 格式化大数：值 >= 1 亿转"亿"单位，>= 1 万转"万"单位。',
      ' * @param value 数值',
      ' * @param _unit 基础单位（默认"万"）',
      ' * @returns 格式化字符串，如"12.34亿"',
      ' */',
    ],
  },
  {
    file: 'src/lib/precision.ts',
    line: 169,
    jsdoc: [
      '/**',
      ' * 根据涨跌幅值返回颜色标识（配合 COLOR_TOKENS）。',
      ' * @param value 涨跌幅值',
      ' * @returns \'up\' | \'down\' | \'neutral\'',
      ' */',
    ],
  },
  {
    file: 'src/lib/precision.ts',
    line: 176,
    jsdoc: [
      '/**',
      ' * 格式化市值为可读字符串。',
      ' * @param value 市值数值',
      ' * @returns 格式化字符串',
      ' */',
    ],
  },
  {
    file: 'src/lib/precision.ts',
    line: 181,
    jsdoc: [
      '/**',
      ' * 格式化成交量为可读字符串。',
      ' * @param value 成交量数值',
      ' * @returns 格式化字符串',
      ' */',
    ],
  },
  {
    file: 'src/lib/perf.ts',
    line: 155,
    jsdoc: [
      '/**',
      ' * 获取所有性能采样数据（只读）。',
      ' * @returns 只读性能采样数组',
      ' */',
    ],
  },
  {
    file: 'src/lib/perf.ts',
    line: 159,
    jsdoc: [
      '/**',
      ' * 清空所有性能采样数据。',
      ' */',
    ],
  },

  // ======= core/ =======
  {
    file: 'src/core/pipelineScheduler.ts',
    line: 25,
    jsdoc: [
      '/**',
      ' * 注入管道调度器依赖的服务实例。',
      ' * @param services 管道服务集合',
      ' */',
    ],
  },
  {
    file: 'src/core/feedbackOrchestrator.ts',
    line: 35,
    jsdoc: [
      '/**',
      ' * 注入反馈编排器依赖的服务实例。',
      ' * @param services 反馈服务集合',
      ' */',
    ],
  },
  {
    file: 'src/core/databridgeStrategyRouter.ts',
    line: 31,
    jsdoc: [
      '/**',
      ' * 注入策略分析器实例。',
      ' * @param analyzers 策略分析器集合',
      ' */',
    ],
  },
  {
    file: 'src/core/databridgeAdapter.ts',
    line: 19,
    jsdoc: [
      '/**',
      ' * DataBridge 适配器 — 封装对 dataBridge 的 query/forward 调用，',
      ' * 提供待处理查询追踪、自动订阅管理等功能。',
      ' */',
    ],
  },
  {
    file: 'src/core/databridgeAdapter.ts',
    line: 136,
    jsdoc: [
      '/**',
      ' * 创建 DataBridgeAdapter 实例。',
      ' * @param config 适配器配置',
      ' * @returns DataBridgeAdapter 实例',
      ' */',
    ],
  },
  {
    file: 'src/core/databridgeAdapter.ts',
    line: 142,
    jsdoc: [
      '/**',
      ' * 获取当前 DataBridgeAdapter 实例（单例）。',
      ' * @returns DataBridgeAdapter 实例或 undefined',
      ' */',
    ],
  },
  {
    file: 'src/core/databridgeAdapter.ts',
    line: 149,
    jsdoc: [
      '/**',
      ' * 销毁 DataBridgeAdapter 实例并清理订阅。',
      ' */',
    ],
  },
]

function insertJsdoc(filePath: string, lineNum: number, lines: string[]): void {
  const fullPath = path.join(ROOT, filePath)
  const content = fs.readFileSync(fullPath, 'utf-8')
  const allLines = content.split('\n')

  if (lineNum < 1 || lineNum > allLines.length) {
    console.error(`  ⚠️  ${filePath}:${lineNum} — 行号越界（文件共 ${allLines.length} 行）`)
    return
  }

  const targetLine = allLines[lineNum - 1]
  allLines.splice(lineNum - 1, 0, ...lines)
  fs.writeFileSync(fullPath, allLines.join('\n'), 'utf-8')
  console.log(`  ✅ ${filePath}:${lineNum} — 已插入 ${lines.length} 行 JSDoc`)
}

console.log('=== 批量补齐 JSDoc ===\n')

// 按文件分组，每组内按行号降序处理（防止插入导致行号偏移）
const byFile = new Map<string, typeof entries>()
for (const entry of entries) {
  const group = byFile.get(entry.file) ?? []
  group.push(entry)
  byFile.set(entry.file, group)
}

for (const [file, group] of byFile) {
  group.sort((a, b) => b.line - a.line)
  for (const entry of group) {
    insertJsdoc(entry.file, entry.line, entry.jsdoc)
  }
}

console.log('\n=== 完成 ===')
