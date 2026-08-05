/**
 * scripts/verify-logger.mts
 * 验证 4 个模块新增的 logger.info 是否生效。
 * 用法：node_modules/.bin/tsx scripts/verify-logger.mts
 * 期望：控制台出现以下 [INFO] 标记（见下方 EXPECTED_MARKS）
 */
import { setLogLevel, getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { ChipAnomalyDetector } from '@/services/orchestration/chipAnomalyDetector'
import { semanticSearcher } from '@/services/data-sync-search/semanticSearcher'
import type { SearchItem } from '@/types/modules/data-sync.types'

const logger = getLogger()

const EXPECTED_MARKS = [
  'ChipAnomalyDetector] detectAnomalies 首次快照',
  'ChipAnomalyDetector] detectAnomalies 入口',
  'ChipAnomalyDetector] holder_count_change 触发',
  'ChipAnomalyDetector] concentration_change 触发',
  'ChipAnomalyDetector] institutional_change 触发',
  'semanticSearch] search 入口',
  'semanticSearch] 查询向量化完成',
]

const actualMarks = new Set<string>()

async function main() {
  setLogLevel('info')
  logger.info('[VERIFY] ========== logger 验证开始 ==========')

  // -------------------- 阶段 1：ChipAnomalyDetector --------------------
  logger.info('[VERIFY] ====== 阶段 1：ChipAnomalyDetector ======')

  const detector = new ChipAnomalyDetector({
    holderCountThreshold: 10,
    concentrationThreshold: 15,
    autoDetect: true,
    watchSymbols: [],
  })

  detector.start()

  // 第一次 emit：首次快照 → 应该触发 "detectAnomalies 首次快照"
  eventBus.emit(EVENT_NAMES.STOCKS_CHANGED, {
    symbol: '600519.SH',
    holderCount: 100000,
    concentration: 60,
    institutionalRatio: 0.4,
  } as unknown as Record<string, unknown>)

  // 第二次 emit：股东人数下降 20%（>10%阈值）+ 集中度升 20%（>15%阈值）+ 机构持仓升 50%（>22.5%阈值 = concentration*1.5）
  // institutionalRatio 阈值 = 15 * 1.5 = 22.5 %；从 0.4 (40%) → 0.6 (60%)，变化 = (0.6-0.4)/0.4*100 = 50% > 22.5%
  eventBus.emit(EVENT_NAMES.STOCKS_CHANGED, {
    symbol: '600519.SH',
    holderCount: 80000,  // (80000-100000)/100000*100 = -20%
    concentration: 72,   // (72-60)/60*100 = +20%
    institutionalRatio: 0.6, // (0.6-0.4)/0.4*100 = +50%；instThreshold = 15*1.5 = 22.5
  } as unknown as Record<string, unknown>)

  // 第三次 emit：另一股票首次快照，不会触发异动
  eventBus.emit(EVENT_NAMES.STOCKS_CHANGED, {
    symbol: '000001.SZ',
    holderCount: 500000,
    concentration: 45,
    institutionalRatio: 0.2,
  } as unknown as Record<string, unknown>)

  detector.stop()

  // -------------------- 阶段 2：semanticSearcher --------------------
  logger.info('[VERIFY] ====== 阶段 2：semanticSearcher ======')

  const mockDocs: SearchItem[] = [
    {
      source: 'local-doc',
      id: 'doc-001',
      timestamp: '2026-08-01T10:00:00Z',
      title: 'V9 架构分层规范',
      snippet: '本项目采用六层架构分层，包括表现层、路由层、服务层、核心层、数据层、工具层。禁止跨层调用。',
      details: { tier: 'T1' },
    },
    {
      source: 'code-file',
      id: 'doc-002',
      timestamp: '2026-08-02T10:00:00Z',
      title: 'DataBridge 信封协议',
      snippet: '所有数据访问必须通过 DataBridge 信封协议，由 ENVELOPE_ACTION 路由到对应的 Handler。禁止直接操作 dataLayer。',
      details: { module: 'databridge' },
    },
    {
      source: 'local-doc',
      id: 'doc-003',
      timestamp: '2026-08-03T10:00:00Z',
      title: '筹码异动检测',
      snippet: '筹码异动检测器每日收盘后扫描股东人数变化超过阈值的股票，记录异动事件并通知策略引擎。',
      details: { module: 'chipAnomalyDetector' },
    },
  ]

  semanticSearcher.index(mockDocs)
  const searchResult = semanticSearcher.search('架构 数据 协议', 5)

  logger.info('[VERIFY] semanticSearch 结果数 = ' + searchResult.length)
  searchResult.forEach((r, i) => {
    logger.info(`[VERIFY]   结果 #${i + 1} score=${r.score.toFixed(4)} id=${r.item.id} title=${r.item.title}`)
  })

  // -------------------- 阶段 3：验证实际打印了哪些标记 --------------------
  // 由于我们直接在控制台看输出，这里不做自动断言，仅生成报告
  logger.info('[VERIFY] ========== 结果汇总 ==========')
  logger.info('[VERIFY] 以下标记应已出现：')
  EXPECTED_MARKS.forEach((m) => {
    logger.info(`[VERIFY]   ✅ 期望: [INFO] ${m}`)
  })
  logger.info('[VERIFY] 以上期望标记如未出现，说明对应 logger.info 未被执行或条件分支未命中')
  logger.info('[VERIFY] ========== logger 验证结束 ==========')

  // 实际计数
  logger.info('[VERIFY] 已执行的阶段：ChipAnomalyDetector (2 个首次快照 + 1 次三分支触发) + SemanticSearcher (1 次 search + TF-IDF 向量化)')
  logger.info('[VERIFY] 服务层 logger 验证完成。React 组件 (IndustryV4Radar/SubIndicatorBar) 需 vitest+jsdom 渲染，见 scripts/verify-logger-components.test.tsx')
}

main().catch((err) => {
  console.error('[VERIFY] FATAL', err)
  process.exit(1)
})
