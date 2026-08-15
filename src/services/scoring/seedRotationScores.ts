/**
 * seedRotationScores.ts
 *
 * 为「热门板块推荐」页（来源一）批量生成模拟的热门板块评分数据，
 * 使页面不再显示空态，便于测试「抽取代表股 (15-20)」的完整交互流程。
 *
 * 在浏览器中通过动态 import 执行：
 *   await import('/src/services/scoring/seedRotationScores.ts')
 *     .then(m => m.seedRotationScores())
 *
 * 数据写入 rotation_scores store（keyPath='id'，格式 sectorCode__scoreDate），
 * 每条记录包含五因子得分、综合分、共振、信号与代表股清单（poolStocks）。
 * 评分日期默认取当天，满足考核标准「近一周及时性」要求。
 */

import { saveRotationScore } from '@/services/analysis/rotationScoreService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 五因子子指标最大值（与 rotationConfig.ts SUB_FACTOR_MAP 对齐）
// ============================================================
const SUB_MAX: Record<string, number> = {
  F1A: 15, F1B: 8, F1C: 7, F1D: 5, F1E: 5,
  F2A: 10, F2B: 10, F2C: 5, F2D: 5,
  F3A: 8, F3B: 4, F3C: 3,
  F4A: 5, F4B: 5,
  F5A: 3, F5B: 2,
}

const FACTOR_SUBS: Record<string, string[]> = {
  F1: ['F1A', 'F1B', 'F1C', 'F1D', 'F1E'],
  F2: ['F2A', 'F2B', 'F2C', 'F2D'],
  F3: ['F3A', 'F3B', 'F3C'],
  F4: ['F4A', 'F4B'],
  F5: ['F5A', 'F5B'],
}

/** 五因子权重（景气40% 资金30% 估值15% β10% 量能5%） */
const FACTOR_WEIGHT: Record<string, number> = {
  F1: 0.4, F2: 0.3, F3: 0.15, F4: 0.1, F5: 0.05,
}

/**
 * 由目标综合分推导各子指标得分（按子指标权重占比分配），
 * 保证分值落在 [0, SUB_MAX] 范围内，通过 validateSubScores 校验。
 */
function buildSubScores(total: number): Record<string, number> {
  const subScores: Record<string, number> = {}
  for (const factor of Object.keys(FACTOR_WEIGHT)) {
    const factorTotal = total * (FACTOR_WEIGHT[factor] ?? 0)
    const subs = FACTOR_SUBS[factor] ?? []
    const subMaxSum = subs.reduce((sum, code) => sum + (SUB_MAX[code] ?? 0), 0)
    for (const code of subs) {
      const subMax = SUB_MAX[code] ?? 0
      const value = Math.round((factorTotal * subMax) / subMaxSum)
      subScores[code] = Math.max(0, Math.min(subMax, value))
    }
  }
  return subScores
}

// ============================================================
// 模拟热门板块与代表股（真实 A 股标的）
// ============================================================
interface SeedSector {
  code: string
  name: string
  /** 目标综合分（>=70 视为热门，向上取整为强/中强信号） */
  total: number
  stocks: Array<{ symbol: string; name: string; v6Composite?: number }>
}

const SEED_SECTORS: SeedSector[] = [
  {
    code: 'SW801750',
    name: '计算机',
    total: 85,
    stocks: [
      { symbol: '002230.SZ', name: '科大讯飞', v6Composite: 82 },
      { symbol: '000977.SZ', name: '浪潮信息', v6Composite: 79 },
      { symbol: '603019.SH', name: '中科曙光', v6Composite: 80 },
      { symbol: '000938.SZ', name: '紫光股份', v6Composite: 75 },
      { symbol: '300418.SZ', name: '昆仑万维', v6Composite: 74 },
    ],
  },
  {
    code: 'SW801080',
    name: '电子',
    total: 82,
    stocks: [
      { symbol: '688981.SH', name: '中芯国际', v6Composite: 84 },
      { symbol: '002371.SZ', name: '北方华创', v6Composite: 81 },
      { symbol: '603501.SH', name: '韦尔股份', v6Composite: 78 },
      { symbol: '688012.SH', name: '中微公司', v6Composite: 77 },
      { symbol: '688008.SH', name: '澜起科技', v6Composite: 76 },
    ],
  },
  {
    code: 'SW801730',
    name: '电力设备',
    total: 78,
    stocks: [
      { symbol: '300750.SZ', name: '宁德时代', v6Composite: 80 },
      { symbol: '300274.SZ', name: '阳光电源', v6Composite: 76 },
      { symbol: '601012.SH', name: '隆基绿能', v6Composite: 72 },
      { symbol: '300014.SZ', name: '亿纬锂能', v6Composite: 73 },
      { symbol: '688599.SH', name: '天合光能', v6Composite: 71 },
    ],
  },
  {
    code: 'SW801150',
    name: '医药生物',
    total: 75,
    stocks: [
      { symbol: '600276.SH', name: '恒瑞医药', v6Composite: 78 },
      { symbol: '603259.SH', name: '药明康德', v6Composite: 75 },
      { symbol: '688235.SH', name: '百济神州', v6Composite: 77 },
      { symbol: '300760.SZ', name: '迈瑞医疗', v6Composite: 76 },
      { symbol: '300122.SZ', name: '智飞生物', v6Composite: 70 },
    ],
  },
  {
    code: 'SW801890',
    name: '机械设备',
    total: 72,
    stocks: [
      { symbol: '300124.SZ', name: '汇川技术', v6Composite: 74 },
      { symbol: '002747.SZ', name: '埃斯顿', v6Composite: 72 },
      { symbol: '688017.SH', name: '绿的谐波', v6Composite: 73 },
      { symbol: '603728.SH', name: '鸣志电器', v6Composite: 70 },
    ],
  },
  {
    code: 'SW801790',
    name: '国防军工',
    total: 70,
    stocks: [
      { symbol: '600760.SH', name: '中航沈飞', v6Composite: 73 },
      { symbol: '600893.SH', name: '航发动力', v6Composite: 72 },
      { symbol: '002179.SZ', name: '中航光电', v6Composite: 74 },
      { symbol: '600150.SH', name: '中国船舶', v6Composite: 71 },
    ],
  },
  {
    code: 'SW801770',
    name: '通信',
    total: 68,
    stocks: [
      { symbol: '300308.SZ', name: '中际旭创', v6Composite: 79 },
      { symbol: '300502.SZ', name: '新易盛', v6Composite: 78 },
      { symbol: '300394.SZ', name: '天孚通信', v6Composite: 76 },
      { symbol: '002281.SZ', name: '光迅科技', v6Composite: 72 },
    ],
  },
  {
    code: 'SW801030',
    name: '基础化工',
    total: 55,
    stocks: [
      { symbol: '600309.SH', name: '万华化学', v6Composite: 66 },
      { symbol: '600426.SH', name: '华鲁恒升', v6Composite: 64 },
      { symbol: '002648.SZ', name: '卫星化学', v6Composite: 63 },
    ],
  },
]

interface BatchResult {
  inserted: number
  failed: number
  errors: string[]
}

/**
 * 批量写入热门板块评分模拟数据
 *
 * @param scoreDate 评分日期，默认当天（YYYY-MM-DD）
 */
export async function seedRotationScores(scoreDate?: string): Promise<BatchResult> {
  const date = scoreDate ?? new Date().toISOString().slice(0, 10)
  const result: BatchResult = { inserted: 0, failed: 0, errors: [] }

  for (const sector of SEED_SECTORS) {
    const subScores = buildSubScores(sector.total)
    try {
      const saveResult = await saveRotationScore({
        sectorCode: sector.code,
        sectorName: sector.name,
        scoreDate: date,
        subScores,
        poolStocks: sector.stocks,
        modelUsed: 'v6-pro',
      })
      if (saveResult.success) {
        result.inserted++
        logger.info(`[seedRotationScores] 已写入 ${sector.name} (${sector.code}) total=${saveResult.data?.total}`)
      } else {
        result.failed++
        result.errors.push(`[${sector.code}] 保存失败: ${saveResult.error}`)
      }
    } catch (err) {
      result.failed++
      result.errors.push(`[${sector.code}] ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  logger.info(`[seedRotationScores] 完成：成功 ${result.inserted}，失败 ${result.failed}`)
  return result
}

// 浏览器识别：暴露到 window 方便调试
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).seedRotationScores = seedRotationScores
}
