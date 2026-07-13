/**
 * 批量修复 tsc 既存错误：
 * 1. scoreDocService.ts — 添加 dataLayer import + 清理未使用的 imports
 * 2. rotationSignalDetector.ts — 同上
 * 3. intelligentScoreService.ts — 清理未使用的 imports
 * 4. v6ScoreService.ts — 导出 buildFinancialData
 * 5. useIntelligentScorePage.ts — 补全 v6EngineCalculation
 * 6. intelligentScoreStore.ts — 补全 v6EngineCalculation
 * 7. intelligentScoreStore.test.ts — 补全 v6EngineCalculation
 */
/**
 * @file batch-fix-tsc.ts
 * @description 批量修复 tsc 既存类型错误（如导入清理、字段补全、导出修复）
 * @status 孤立脚本（未在 package.json 中引用）
 * @category 未接入审计流水线 — 评估后接入
 * @maintainer 待定
 * @lastVerified 2026-07-13
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = process.cwd()

interface Fix {
  file: string
  description: string
  apply: (content: string) => string
}

function read(f: string): string {
  return fs.readFileSync(path.join(ROOT, f), 'utf-8')
}

function write(f: string, content: string): void {
  fs.writeFileSync(path.join(ROOT, f), content, 'utf-8')
}

const fixes: Fix[] = [
  // =============================================================
  // 1. scoreDocService.ts — 添加 dataLayer import + 清理 dataBridge
  // =============================================================
  {
    file: 'src/services/analysis/scoreDocService.ts',
    description: '添加 dataLayer import，清理未使用的 dataBridge import',
    apply: (c) => {
      return c
        .replace(
          "import { dataBridge } from '@/core/databridge'\nimport { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'\nimport type { DataLayerResult, FileLibraryStats, ScoreDocVersion, V6LayerScore } from '@/data/types'",
          "import { dataBridge } from '@/core/databridge'\nimport { dataLayer } from '@/data/dataLayer'\nimport { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'\nimport type { DataLayerResult, FileLibraryStats, ScoreDocVersion, V6LayerScore } from '@/data/types'"
        )
    },
  },
  // =============================================================
  // 2. rotationSignalDetector.ts — 添加 dataLayer import + 清理
  // =============================================================
  {
    file: 'src/services/scoring/rotationSignalDetector.ts',
    description: '添加 dataLayer import，清理未使用的 imports',
    apply: (c) => {
      // Replace the import block
      return c
        .replace(
          "import { dataBridge } from '@/core/databridge'\nimport { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'\nimport { checkStrategyScoreFreshness } from '@/core/freshnessGuard'\nimport type { Stock, DailyQuotes, RotationSectorScore } from '@/data/types'",
          "import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'\nimport { checkStrategyScoreFreshness } from '@/core/freshnessGuard'\nimport { dataLayer } from '@/data/dataLayer'\nimport type { Stock, DailyQuotes, RotationSectorScore } from '@/data/types'"
        )
    },
  },
  // =============================================================
  // 3. intelligentScoreService.ts — 清理未使用的 imports
  // =============================================================
  {
    file: 'src/services/scoring/intelligentScoreService.ts',
    description: '清理未使用的 dataBridge/ENVELOPE_ACTION/STORE_NAME imports',
    apply: (c) => {
      return c
        .replace(
          "import { calculateWeightedScore, getEnabledStockFactorNames } from '@/config/scoreFactors'\nimport { dataBridge } from '@/core/databridge'\nimport { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'\nimport type { DataLayerResult, DailyQuotes, DimensionScore, IntelligentScore, Stock } from '@/data/types'",
          "import { getEnabledStockFactorNames } from '@/config/scoreFactors'\nimport type { DataLayerResult, DailyQuotes, DimensionScore, IntelligentScore, Stock } from '@/data/types'"
        )
    },
  },
  // =============================================================
  // 4. v6ScoreService.ts — 导出 buildFinancialData
  // =============================================================
  {
    file: 'src/services/scoring/v6ScoreService.ts',
    description: 'export buildFinancialData (让 intelligentScoreService 可导入)',
    apply: (c) => {
      return c.replace(
        'async function buildFinancialData(symbol: string): Promise<FinancialData> {',
        'export async function buildFinancialData(symbol: string): Promise<FinancialData> {',
      )
    },
  },
  // =============================================================
  // 5. useIntelligentScorePage.ts — 补全 v6EngineCalculation 字段
  // =============================================================
  {
    file: 'src/hooks/cabin/useIntelligentScorePage.ts',
    description: 'STEP_LABELS + INITIAL_PROGRESS 补全 v6EngineCalculation',
    apply: (c) => {
      return c
        .replace(
          '  fetchBasicData: { label: \'读取基础数据\', description: \'从数据采集层获取标的字段\' },\n  readSupplementaryFiles:',
          '  fetchBasicData: { label: \'读取基础数据\', description: \'从数据采集层获取标的字段\' },\n  v6EngineCalculation: { label: \'V6 引擎计算\', description: \'调用六维评分引擎进行基本面分析\' },\n  readSupplementaryFiles:',
        )
        .replace(
          '  fetchBasicData: \'pending\',\n  readSupplementaryFiles:',
          '  fetchBasicData: \'pending\',\n  v6EngineCalculation: \'pending\',\n  readSupplementaryFiles:',
        )
    },
  },
  // =============================================================
  // 6. intelligentScoreStore.ts — 补全 v6EngineCalculation 字段
  // =============================================================
  {
    file: 'src/store/intelligentScoreStore.ts',
    description: 'STEP_LABELS + INITIAL_PROGRESS 补全 v6EngineCalculation',
    apply: (c) => {
      return c
        .replace(
          '  fetchBasicData: { label: \'读取基础数据\', description: \'从数据采集层获取标的字段\' },\n  readSupplementaryFiles:',
          '  fetchBasicData: { label: \'读取基础数据\', description: \'从数据采集层获取标的字段\' },\n  v6EngineCalculation: { label: \'V6 引擎计算\', description: \'调用六维评分引擎进行基本面分析\' },\n  readSupplementaryFiles:',
        )
        .replace(
          '  fetchBasicData: \'pending\',\n  readSupplementaryFiles:',
          '  fetchBasicData: \'pending\',\n  v6EngineCalculation: \'pending\',\n  readSupplementaryFiles:',
        )
    },
  },
  // =============================================================
  // 7. intelligentScoreStore.test.ts — 补全 v6EngineCalculation 字段
  // =============================================================
  {
    file: 'src/store/intelligentScoreStore.test.ts',
    description: '测试中的进度对象补全 v6EngineCalculation',
    apply: (c) => {
      return c
        .replace(
          '  fetchBasicData: \'pending\',\n  readSupplementaryFiles:',
          '  fetchBasicData: \'pending\',\n  v6EngineCalculation: \'pending\',\n  readSupplementaryFiles:',
        )
        .replace(
          '  fetchBasicData: \'done\',\n  readSupplementaryFiles:',
          '  fetchBasicData: \'done\',\n  v6EngineCalculation: \'done\',\n  readSupplementaryFiles:',
        )
    },
  },
]

console.log('=== 批量修复 tsc 错误 ===\n')

for (const fix of fixes) {
  try {
    const content = read(fix.file)
    const updated = fix.apply(content)
    if (updated === content) {
      console.log(`  ⚠️  ${fix.file} — 未变更（匹配失败？）`)
    } else {
      write(fix.file, updated)
      console.log(`  ✅ ${fix.file} — ${fix.description}`)
    }
  } catch (err) {
    console.error(`  ❌ ${fix.file} — ${err}`)
  }
}

console.log('\n=== 完成 ===')
