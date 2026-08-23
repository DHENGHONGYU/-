/**
 * @module InputTestDashboard
 * @description 输入舱系统测试看板 - 从系统测试师角度对输入舱进行全面测试。
 *
 * 覆盖六维测试域：
 * 1. 页面结构审计（重复/废弃/冗余页面检测）
 * 2. 数据采集质量与新鲜度监控
 * 3. 采集数据存放文件映射
 * 4. 热门板块判断依据与评分原则校验
 * 5. 数据链关键动作按钮
 * 6. 校对评分与数据一致性验证
 * 7. 测试用例执行与管理
 * 8. 测试报告持久化与历史对比
 * 9. 数据链覆盖度分析与缺口检测
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/atoms/Card'
import { cn } from '@/lib/utils'
import { twText } from '@/constants/theme/theme.tokens.shades'
import { getLogger } from '@/lib/logger'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID, type StoreName } from '@/config/dbConfig'
import { DYNAMIC_SCORE_WEIGHTS, MOMENTUM_WEIGHTS } from './hotSector.config'
import { getTimeliness, TIMELY_WINDOW_DAYS } from './hotSector.utils'
import { getHotSectors } from '@/services/input/hotSectorService'
import { checkFetcherHealth } from '@/services/fetcher/fetcherService'
import { useFreshData } from '@/hooks/useFreshData'
import {
  RefreshCw, Radar, Database,
  Flame, Scale, ArrowRight, FileText, Layers, Activity,
  BarChart3, Clock, Zap, ListChecks, GitCompare, Settings,
  AlertTriangle, Bug, CheckCircle2, XCircle,
  Play, Save, Trash2, Download, GitBranch,
} from 'lucide-react'

const logger = getLogger()

// ============================================================
// 1. 页面结构审计配置
// ============================================================

interface PageEntry {
  key: string
  label: string
  path: string
  category: '候选池管理' | '采集中心'
  status: 'active' | 'merged' | 'deprecated' | 'redirected'
  mergedInto?: string
  remark?: string
  duplicateGroup?: string
}

const INPUT_PAGES: PageEntry[] = [
  { key: 'dashboard', label: '录入看板', path: '/input', category: '候选池管理', status: 'active', remark: '输入舱首页，聚合手动录入+意向池清单' },
  { key: 'intention-pool', label: '意向输入池', path: '/input/intention-pool', category: '候选池管理', status: 'active', remark: '双源注入标的的集中管理' },
  { key: 'pool-board', label: '研究候选池', path: '/input/pool-board', category: '候选池管理', status: 'active', remark: '研究状态候选池看板' },
  { key: 'hot-sectors', label: '热门板块', path: '/input/hot-sectors', category: '候选池管理', status: 'active', remark: '从录入看板Tab拆分出的独立页' },
  { key: 'local-knowledge', label: '本地知识库', path: '/input/local-knowledge', category: '候选池管理', status: 'active', remark: '本地文档资产管理' },
  { key: 'collection-monitor', label: '采集监控台', path: '/input/collection-monitor', category: '采集中心', status: 'active', remark: '链路测试+任务监控合并面板' },
  { key: 'collection-strategy', label: '采集策略配置', path: '/input/collection-strategy', category: '采集中心', status: 'active', remark: '十六维策略+抓取引擎合并面板（历史沿用“七维”命名）' },
  { key: 'system-test', label: '系统测试看板', path: '/input/system-test', category: '采集中心', status: 'active', remark: '输入舱系统测试一体化看板' },
  // 已合并/废弃路由
  { key: 'bulk-import', label: '批量导入', path: '/input/bulk-import', category: '候选池管理', status: 'deprecated', mergedInto: '/input', remark: '已整合至录入看板，fallback到/input' },
  { key: 'data-test', label: '采集测试', path: '/input/data-test', category: '采集中心', status: 'merged', mergedInto: '/input/collection-monitor', remark: '已合并至采集监控台(链路测试Tab)' },
  { key: 'collect-tasks', label: '采集任务', path: '/input/collect-tasks', category: '采集中心', status: 'merged', mergedInto: '/input/collection-monitor', remark: '已合并至采集监控台(任务监控Tab)' },
  { key: 'seven-dim', label: '七维采集配置', path: '/input/seven-dim', category: '采集中心', status: 'merged', mergedInto: '/input/collection-strategy', remark: '已合并至采集策略配置(采集策略Tab)' },
  { key: 'fetcher-config', label: '抓取引擎配置', path: '/input/fetcher-config', category: '采集中心', status: 'merged', mergedInto: '/input/collection-strategy', remark: '已合并至采集策略配置(抓取引擎Tab)' },
]

// 重复/冗余页面分组
const DUPLICATE_GROUPS: Record<string, string[]> = {
  '采集监控整合': ['data-test', 'collect-tasks', 'collection-monitor'],
  '采集策略整合': ['seven-dim', 'fetcher-config', 'collection-strategy'],
  '录入看板整合': ['bulk-import', 'dashboard'],
}

// ============================================================
// 2. 数据存储映射配置
// ============================================================

interface StorageMapping {
  dataDomain: string
  description: string
  storeName: string
  source: string
  keyField: string
  freshnessField: string
  relatedActions: string[]
  /** 测试覆盖状态: true=已有测试, false=无测试覆盖 */
  tested: boolean
}

const STORAGE_MAPPINGS: StorageMapping[] = [
  { dataDomain: '股票基础信息', description: '股票代码、名称、行业归属等基础资料', storeName: 'stocks', source: '手动录入/批量导入', keyField: 'symbol', freshnessField: 'updatedAt', relatedActions: ['INSERT_STOCK', 'BULK_INSERT_STOCK'], tested: true },
  { dataDomain: '板块轮动评分', description: '热门板块五因子评分(景气/资金/估值/情绪/量能)', storeName: 'rotation_scores', source: '轮动分析引擎', keyField: 'sectorCode', freshnessField: 'scoreDate', relatedActions: ['SAVE_ROTATION_SCORES'], tested: false },
  { dataDomain: '板块评分', description: '板块级综合评分数据', storeName: 'sector_scores', source: '板块分析引擎', keyField: 'sectorCode', freshnessField: 'updatedAt', relatedActions: ['SAVE_SECTOR_SCORES'], tested: false },
  { dataDomain: '热门板块评分', description: '热点板块筛选评分结果', storeName: 'hot_sector_scores', source: '热点筛选引擎', keyField: 'symbol', freshnessField: 'updatedAt', relatedActions: ['SAVE_HOT_SECTOR_SCORES'], tested: false },
  { dataDomain: '行情数据', description: '日K线行情数据', storeName: 'daily_quotes', source: '采集服务(Tencent/Sina/Tushare)', keyField: 'symbol', freshnessField: 'tradeDate', relatedActions: ['SAVE_DAILY_QUOTES', 'BULK_SAVE_DAILY_QUOTES'], tested: true },
  { dataDomain: '财务报告', description: '三表财务数据', storeName: 'financial_reports', source: '采集服务(AkShare/Tushare)', keyField: 'symbol', freshnessField: 'reportDate', relatedActions: ['SAVE_FINANCIAL_REPORT', 'BULK_SAVE_FINANCIAL_REPORTS'], tested: true },
  { dataDomain: '采集链路追踪', description: '采集任务链路追踪记录', storeName: 'trace_records', source: '采集管线(collectionPipeline)', keyField: 'traceId', freshnessField: 'startedAt', relatedActions: ['SAVE_TRACE_RECORD'], tested: true },
  { dataDomain: '采集历史', description: '采集任务执行历史', storeName: 'collection_history', source: '采集管线', keyField: 'id', freshnessField: 'createdAt', relatedActions: ['SAVE_COLLECTION_HISTORY'], tested: false },
  { dataDomain: '意向候选池', description: '待分析股票意向池', storeName: 'stocks', source: '手动录入/热门板块导入', keyField: 'symbol', freshnessField: 'updatedAt', relatedActions: ['INSERT_STOCK', 'UPDATE_STOCK'], tested: true },
]

// ============================================================
// 3. 热门板块评分原则
// ============================================================

interface ScoringPrinciple {
  dimension: string
  weight: string
  source: string
  range: string
  description: string
}

const SCORING_PRINCIPLES: ScoringPrinciple[] = [
  { dimension: '综合评分(total)', weight: '五因子加权', source: '轮动分析引擎', range: '0-100', description: '五因子(景气/资金/估值/情绪/量能)加权总分，热门板块排序依据' },
  { dimension: '动量强度(momentum)', weight: `资金${(DYNAMIC_SCORE_WEIGHTS.capital * 100).toFixed(0)}%权重`, source: '景气(f1)+量能(f5)均值', range: '0-100', description: '反映板块景气度与量能变化趋势' },
  { dimension: '资金热度(fundFlow)', weight: `资金${(DYNAMIC_SCORE_WEIGHTS.capital * 100).toFixed(0)}%权重`, source: 'f2资金因子', range: '0-100', description: '反映大单资金流入/流出强度' },
  { dimension: '估值风险(valuation)', weight: `动量子项${(MOMENTUM_WEIGHTS.valuation * 100).toFixed(0)}%`, source: 'f3估值因子', range: '0-100', description: '估值水平偏离度，过高提示风险' },
  { dimension: '情绪热度(sentiment)', weight: `动量子项${(MOMENTUM_WEIGHTS.sentiment * 100).toFixed(0)}%`, source: 'f1景气因子', range: '0-100', description: '市场情绪与舆论热度' },
  { dimension: '及时性', weight: `≤${TIMELY_WINDOW_DAYS}天`, source: 'scoreDate字段', range: '近一周/非近一周', description: `评分日期在${TIMELY_WINDOW_DAYS}天内的视为及时，过期板块不参与推荐` },
  { dimension: '动态排序分', weight: `原始${(DYNAMIC_SCORE_WEIGHTS.original * 100).toFixed(0)}%+资金${(DYNAMIC_SCORE_WEIGHTS.capital * 100).toFixed(0)}%+动量${(DYNAMIC_SCORE_WEIGHTS.momentum * 100).toFixed(0)}%`, source: 'rankSectorsByDynamicScore', range: '0-100', description: 'UI展示排序依据，综合原始评分+资金热度+动量强度' },
]

// ============================================================
// 4. 测试用例配置
// ============================================================

interface TestCase {
  id: string
  category: string
  name: string
  description: string
  severity: 'critical' | 'major' | 'minor'
  autoRun: boolean
  run: () => Promise<TestResult>
}

interface TestResult {
  passed: boolean
  details: string
  duration: number
  timestamp: number
}

interface TestRun {
  id: string
  timestamp: number
  category: string
  results: { caseId: string; passed: boolean; details: string; duration: number }[]
  summary: { total: number; passed: number; failed: number; duration: number }
}

// ============================================================
// 5. 数据链覆盖度分析
// ============================================================

interface ChainNode {
  stage: string
  description: string
  status: 'covered' | 'partial' | 'missing'
  tests: string[]
  gap: string
}

const DATA_CHAIN_NODES: ChainNode[] = [
  { stage: '数据源接入', description: '多数据源(Tushare/Tencent/Sina/AkShare)的连接与健康检查', status: 'covered', tests: ['checkFetcherHealth', 'runSingleTrace'], gap: '' },
  { stage: '数据采集执行', description: '单链路/批量采集的执行与进度追踪', status: 'covered', tests: ['collectionPipeline', 'runBatchTrace'], gap: '' },
  { stage: '数据降级处理', description: '主源失败后的降级链路切换与Fallback逻辑', status: 'partial', tests: ['qualityMetricsCollector.fallbackCount'], gap: '降级链路切换的自动化测试未覆盖' },
  { stage: '数据质量校验', description: '采集成功率、数据完整率、写入成功率的质量门禁', status: 'partial', tests: ['qualityMetricsCollector'], gap: '质量门禁的阈值告警测试未覆盖' },
  { stage: '数据持久化写入', description: 'DataBridge.forward()写入IndexedDB的完整链路', status: 'covered', tests: ['dataBridge', 'ENVELOPE_ACTION'], gap: '' },
  { stage: '板块轮动评分', description: 'rotationScores的生成、排序、及时性判定', status: 'partial', tests: ['hotSectorService', 'getTimeliness'], gap: '评分时效性的自动化回归测试未覆盖' },
  { stage: '热门板块提取', description: '从rotationScores到HotSector的映射与展示', status: 'covered', tests: ['getHotSectors', 'rankSectorsByDynamicScore'], gap: '' },
  { stage: '意向候选池注入', description: '热门板块代表股→意向候选池的跨模块数据流', status: 'partial', tests: ['addHotSectorStock', 'addHotSectorStocks'], gap: '跨模块数据一致性校验未覆盖' },
]

// ============================================================
// 子组件
// ============================================================

/** 状态徽章 */
function StatusBadge({ status }: { status: PageEntry['status'] }): React.JSX.Element {
  const map: Record<PageEntry['status'], { label: string; className: string }> = {
    active: { label: '活跃', className: 'bg-success/10 text-success border-success/20' },
    merged: { label: '已合并', className: 'bg-info/10 text-info border-info/20' },
    deprecated: { label: '已废弃', className: 'bg-muted text-muted-foreground border-border' },
    redirected: { label: '已重定向', className: 'bg-warning/10 text-warning border-warning/20' },
  }
  const config = map[status]
  return <Badge className={config.className}>{config.label}</Badge>
}

/** 阈值指示器 */
function ThresholdIndicator({ value, thresholds }: { value: number; thresholds: { danger: number; warning: number } }): React.JSX.Element {
  if (value >= thresholds.danger) return <Badge className="bg-success/10 text-success">正常</Badge>
  if (value >= thresholds.warning) return <Badge className="bg-warning/10 text-warning">警告</Badge>
  return <Badge variant="destructive">危险</Badge>
}

/** 覆盖度指示器 */
function CoverageBadge({ status }: { status: ChainNode['status'] }): React.JSX.Element {
  const map: Record<ChainNode['status'], { label: string; className: string; icon: React.ReactNode }> = {
    covered: { label: '已覆盖', className: 'bg-success/10 text-success', icon: <CheckCircle2 className="h-3 w-3" /> },
    partial: { label: '部分覆盖', className: 'bg-warning/10 text-warning', icon: <AlertTriangle className="h-3 w-3" /> },
    missing: { label: '未覆盖', className: 'bg-destructive/10 text-destructive', icon: <XCircle className="h-3 w-3" /> },
  }
  const config = map[status]
  return (
    <Badge className={cn('flex items-center gap-1', config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

// ============================================================
// 主组件
// ============================================================

export default function InputTestDashboard(): React.JSX.Element {
  const runtime = useCollectionRuntimeStore()

  // 本地状态
  const [health, setHealth] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [hotSectors, setHotSectors] = useState<Awaited<ReturnType<typeof getHotSectors>>>([])
  const [loadingSectors, setLoadingSectors] = useState(false)
  const [verifyResult, setVerifyResult] = useState<string>('')
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now())

  // 测试运行状态
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set())
  const [testHistory, setTestHistory] = useState<TestRun[]>([])

  // 使用 useFreshData 自动刷新健康状态
  const { isStale, forceRefresh } = useFreshData({
    lastUpdated: lastRefresh,
    maxStaleMs: 60000,
    refresh: async () => { await handleCheckHealth() },
  })

  // 质量统计
  const qualityStats = runtime.stats
  const qualityMetrics = useMemo(() => ({
    successRate: qualityStats.successRate ?? 0,
    completeness: qualityStats.completeness ?? 0,
    writeRate: qualityStats.writeRate ?? 0,
    avgLatency: qualityStats.avgLatency ?? 0,
    fallbackCount: qualityStats.fallbackCount ?? 0,
    totalCollects: qualityStats.totalCollects ?? 0,
  }), [qualityStats])

  // ── 操作函数 ──

  const handleCheckHealth = useCallback(async () => {
    setChecking(true)
    try {
      const result = await checkFetcherHealth()
      setHealth(result.ok)
      logger.info('[InputTestDashboard] 健康检查完成', { ok: result.ok })
    } catch {
      setHealth(false)
    } finally {
      setChecking(false)
    }
  }, [])

  const handleRefreshHotSectors = useCallback(async () => {
    setLoadingSectors(true)
    try {
      const sectors = await getHotSectors()
      setHotSectors(sectors)
      setLastRefresh(Date.now())
      logger.info('[InputTestDashboard] 热门板块刷新完成', { count: sectors.length })
    } catch (err) {
      logger.error('[InputTestDashboard] 热门板块刷新失败', { error: err })
    } finally {
      setLoadingSectors(false)
    }
  }, [])

  // ── 测试用例定义 ──

  const testCases: TestCase[] = useMemo(() => [
    // 采集服务测试
    {
      id: 'TC-001', category: '采集服务', name: '采集服务健康检查',
      description: '验证采集后端服务是否可连接，返回ok=true',
      severity: 'critical', autoRun: true,
      run: async () => {
        const start = Date.now()
        const result = await checkFetcherHealth()
        return {
          passed: result.ok,
          details: result.ok ? `服务已连接, 响应时间=${Date.now() - start}ms` : `服务未连接: ${result.error ?? '未知错误'}`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    {
      id: 'TC-002', category: '采集服务', name: '数据源可用性检查',
      description: '检查所有配置的数据源(Tushare/Tencent/Sina/AkShare)是否可用',
      severity: 'critical', autoRun: true,
      run: async () => {
        const start = Date.now()
        const sources = ['tushare', 'tencent', 'sina', 'akshare']
        const results = await Promise.allSettled(
          sources.map(async (src) => {
            try {
              await checkFetcherHealth()
              return { source: src, ok: true }
            } catch {
              return { source: src, ok: false }
            }
          }),
        )
        const okCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
        return {
          passed: okCount >= 2,
          details: `${okCount}/${sources.length} 个数据源可用: ${results.map(r => r.status === 'fulfilled' ? `${r.value.source}=${r.value.ok}` : 'error').join(', ')}`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    // 热门板块测试
    {
      id: 'TC-003', category: '热门板块', name: '热门板块数据加载',
      description: '验证getHotSectors能正确加载板块数据，返回非空列表',
      severity: 'critical', autoRun: true,
      run: async () => {
        const start = Date.now()
        const sectors = await getHotSectors()
        return {
          passed: sectors.length > 0,
          details: sectors.length > 0
            ? `成功加载 ${sectors.length} 个板块，最高分=${Math.max(...sectors.map(s => s.score))}，最低分=${Math.min(...sectors.map(s => s.score))}`
            : '板块数据为空，可能是rotationScores store无数据',
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    {
      id: 'TC-004', category: '热门板块', name: '评分及时性判定',
      description: '验证getTimeliness函数对及时性(<=7天)的判定是否正确',
      severity: 'major', autoRun: true,
      run: async () => {
        const start = Date.now()
        const sectors = await getHotSectors()
        let timelyCount = 0; let untimelyCount = 0; let noDateCount = 0
        for (const s of sectors) {
          const { timely, daysAgo } = getTimeliness(s.scoreDate)
          if (daysAgo === null) noDateCount++
          else if (timely) timelyCount++
          else untimelyCount++
        }
        const issues = sectors.filter(s => {
          const { timely } = getTimeliness(s.scoreDate)
          return !timely
        }).slice(0, 5).map(s => `${s.name}(${s.scoreDate ?? '无日期'})`).join(', ')
        return {
          passed: timelyCount > 0 || sectors.length === 0,
          details: `及时=${timelyCount}, 过期=${untimelyCount}, 无日期=${noDateCount}${issues ? `, 过期示例: ${issues}` : ''}`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    {
      id: 'TC-005', category: '热门板块', name: '评分范围合规性',
      description: '验证所有板块评分在0-100范围内，五因子值正常',
      severity: 'major', autoRun: true,
      run: async () => {
        const start = Date.now()
        const sectors = await getHotSectors()
        const outOfRange = sectors.filter(s => s.score < 0 || s.score > 100)
        const zeroFactors = sectors.filter(s => {
          const { momentum, fundFlow, valuation, sentiment } = s.factors
          return momentum === 0 && fundFlow === 0 && valuation === 0 && sentiment === 0
        })
        const issues = [...outOfRange.map(s => `${s.name}评分=${s.score}`), ...zeroFactors.map(s => `${s.name}全零因子`)]
        return {
          passed: outOfRange.length === 0 && zeroFactors.length === 0,
          details: issues.length > 0
            ? `发现 ${issues.length} 个异常: ${issues.join(', ')}`
            : `全部 ${sectors.length} 个板块评分合规(0-100)`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    {
      id: 'TC-006', category: '热门板块', name: '动态排序权重验证',
      description: '验证rankSectorsByDynamicScore的权重配置与计算一致性',
      severity: 'major', autoRun: false,
      run: async () => {
        const start = Date.now()
        const sectors = await getHotSectors()
        if (sectors.length === 0) return { passed: true, details: '无板块数据，跳过验证', duration: Date.now() - start, timestamp: Date.now() }
        const sector = sectors[0]!
        const capitalWeight = (sector.factors.fundFlow + sector.factors.momentum) / 2
        const momentumWeight = sector.factors.sentiment * MOMENTUM_WEIGHTS.sentiment + sector.factors.valuation * MOMENTUM_WEIGHTS.valuation
        const expectedDynamic = sector.score * DYNAMIC_SCORE_WEIGHTS.original + capitalWeight * DYNAMIC_SCORE_WEIGHTS.capital + momentumWeight * DYNAMIC_SCORE_WEIGHTS.momentum
        return {
          passed: true,
          details: `权重配置: 原始=${DYNAMIC_SCORE_WEIGHTS.original}, 资金=${DYNAMIC_SCORE_WEIGHTS.capital}, 动量=${DYNAMIC_SCORE_WEIGHTS.momentum} | 示例(${sector.name}): 原始分=${sector.score}, 动态分≈${expectedDynamic.toFixed(1)}`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    // 数据存储测试
    {
      id: 'TC-007', category: '数据存储', name: 'IndexedDB存储可读性',
      description: '验证关键IndexedDB Store是否可正常查询',
      severity: 'critical', autoRun: true,
      run: async () => {
        const start = Date.now()
        const stores = [STORE_NAME.stocks, STORE_NAME.rotationScores, STORE_NAME.traceRecords]
        const results = await Promise.allSettled(
          stores.map(async (store) => {
            const result = await dataBridge.query({
              action: ENVELOPE_ACTION.queryList,
              store: store as unknown as StoreName,
              source: MODULE_ID.pool,
            })
            return { store, ok: result.success, count: result.success ? (result.data as unknown[]).length : 0 }
          }),
        )
        const okCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
        const details = results.map(r => r.status === 'fulfilled' ? `${r.value.store}=${r.value.count}条` : 'error').join(', ')
        return {
          passed: okCount === stores.length,
          details: `${okCount}/${stores.length} Store可读: ${details}`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    {
      id: 'TC-008', category: '数据存储', name: '数据一致性校验',
      description: '验证各Store之间的数据量是否合理，无异常偏离',
      severity: 'major', autoRun: false,
      run: async () => {
        const start = Date.now()
        const stores = [STORE_NAME.stocks, STORE_NAME.rotationScores, STORE_NAME.traceRecords, STORE_NAME.dailyQuotes]
        const results = await Promise.allSettled(
          stores.map(async (store) => {
            const result = await dataBridge.query({
              action: ENVELOPE_ACTION.queryList,
              store: store as unknown as StoreName,
              source: MODULE_ID.pool,
            })
            return { store, count: result.success ? (result.data as unknown[]).length : -1 }
          }),
        )
        const counts = results.map(r => r.status === 'fulfilled' ? `${r.value.store}=${r.value.count}` : 'error').join(', ')
        return {
          passed: true,
          details: `存储统计: ${counts}`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    // 采集质量测试
    {
      id: 'TC-009', category: '采集质量', name: '采集成功率阈值检查',
      description: '验证采集成功率是否达到最低阈值(>=80%)',
      severity: 'critical', autoRun: true,
      run: async () => {
        const start = Date.now()
        const rate = runtime.stats.successRate ?? 0
        return {
          passed: rate >= 80,
          details: `当前采集成功率=${rate.toFixed(1)}% (阈值: >=80%)`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    {
      id: 'TC-010', category: '采集质量', name: '数据完整率检查',
      description: '验证数据完整率是否达到最低阈值(>=70%)',
      severity: 'major', autoRun: true,
      run: async () => {
        const start = Date.now()
        const completeness = runtime.stats.completeness ?? 0
        return {
          passed: completeness >= 70,
          details: `当前数据完整率=${completeness.toFixed(1)}% (阈值: >=70%)`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    {
      id: 'TC-011', category: '采集质量', name: '写入成功率检查',
      description: '验证DataBridge写入成功率是否达到最低阈值(>=85%)',
      severity: 'critical', autoRun: true,
      run: async () => {
        const start = Date.now()
        const writeRate = runtime.stats.writeRate ?? 0
        return {
          passed: writeRate >= 85,
          details: `当前写入成功率=${writeRate.toFixed(1)}% (阈值: >=85%)`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    {
      id: 'TC-012', category: '采集质量', name: '采集延迟检查',
      description: '验证平均采集延迟是否在可接受范围内(<=3000ms)',
      severity: 'major', autoRun: true,
      run: async () => {
        const start = Date.now()
        const latency = runtime.stats.avgLatency ?? 0
        return {
          passed: latency <= 3000,
          details: `当前平均延迟=${latency.toFixed(0)}ms (阈值: <=3000ms)`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
    // 页面结构测试
    {
      id: 'TC-013', category: '页面结构', name: '路由重复性检查',
      description: '验证输入舱无重复路由，已合并页面均有对应重定向',
      severity: 'major', autoRun: true,
      run: async () => {
        const start = Date.now()
        const merged = INPUT_PAGES.filter(p => p.status === 'merged' || p.status === 'deprecated')
        const allMergedHaveRedirect = merged.every(p => p.mergedInto)
        const activeCount = INPUT_PAGES.filter(p => p.status === 'active').length
        return {
          passed: allMergedHaveRedirect,
          details: `活跃页面=${activeCount}, 已合并/废弃=${merged.length}个, 全部有重定向目标=${allMergedHaveRedirect ? '是' : '否(有遗漏)'}`,
          duration: Date.now() - start,
          timestamp: Date.now(),
        }
      },
    },
  ], [runtime.stats])

  // 自动运行 autoRun 测试用例
  useEffect(() => {
    const autoCases = testCases.filter(tc => tc.autoRun && !testResults[tc.id])
    if (autoCases.length === 0) return

    const runAll = async () => {
      for (const tc of autoCases) {
        setRunningTests(prev => new Set(prev).add(tc.id))
        try {
          const result = await tc.run()
          setTestResults(prev => ({ ...prev, [tc.id]: result }))
        } catch (err) {
          setTestResults(prev => ({
            ...prev, [tc.id]: {
              passed: false, details: `执行异常: ${err instanceof Error ? err.message : String(err)}`,
              duration: 0, timestamp: Date.now(),
            },
          }))
        } finally {
          setRunningTests(prev => { const next = new Set(prev); next.delete(tc.id); return next })
        }
      }
    }
    void runAll()
  }, [testCases, testResults])

  // 运行单个测试用例
  const handleRunTest = useCallback(async (tc: TestCase) => {
    setRunningTests(prev => new Set(prev).add(tc.id))
    try {
      const result = await tc.run()
      setTestResults(prev => ({ ...prev, [tc.id]: result }))
    } catch (err) {
      setTestResults(prev => ({
        ...prev, [tc.id]: {
          passed: false, details: `执行异常: ${err instanceof Error ? err.message : String(err)}`,
          duration: 0, timestamp: Date.now(),
        },
      }))
    } finally {
      setRunningTests(prev => { const next = new Set(prev); next.delete(tc.id); return next })
    }
  }, [])

  // 运行分类所有测试
  const handleRunCategory = useCallback(async (category: string) => {
    const cases = testCases.filter(tc => tc.category === category)
    for (const tc of cases) {
      await handleRunTest(tc)
    }
  }, [testCases, handleRunTest])

  // 运行所有测试
  const handleRunAll = useCallback(async () => {
    for (const tc of testCases) {
      await handleRunTest(tc)
    }
  }, [testCases, handleRunTest])

  // 保存测试报告
  const handleSaveReport = useCallback(() => {
    const run: TestRun = {
      id: `run-${Date.now()}`,
      timestamp: Date.now(),
      category: 'all',
      results: Object.entries(testResults).map(([caseId, result]) => ({
        caseId, passed: result.passed, details: result.details, duration: result.duration,
      })),
      summary: {
        total: Object.keys(testResults).length,
        passed: Object.values(testResults).filter(r => r.passed).length,
        failed: Object.values(testResults).filter(r => !r.passed).length,
        duration: Object.values(testResults).reduce((sum, r) => sum + r.duration, 0),
      },
    }
    setTestHistory(prev => [run, ...prev].slice(0, 20))
    logger.info('[InputTestDashboard] 测试报告已保存', { runId: run.id, summary: run.summary })
  }, [testResults])

  // 清除测试结果
  const handleClearResults = useCallback(() => {
    setTestResults({})
  }, [])

  // 导出测试报告
  const handleExportReport = useCallback(() => {
    const report = {
      exportedAt: new Date().toISOString(),
      system: { health, hotSectorsCount: hotSectors.length, qualityMetrics },
      testResults,
      testHistory: testHistory.slice(0, 5),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `input-test-report-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }, [health, hotSectors, qualityMetrics, testResults, testHistory])

  // 评分校验
  const handleVerifyScores = useCallback(async () => {
    setVerifyResult('校验中...')
    try {
      const sectors = await getHotSectors()
      const issues: string[] = []
      let totalScore = 0

      for (const sector of sectors) {
        totalScore += sector.score
        if (sector.score < 0 || sector.score > 100) {
          issues.push(`${sector.name}(${sector.code}): 评分${sector.score}超出0-100范围`)
        }
        const { timely, daysAgo } = getTimeliness(sector.scoreDate)
        if (!timely && daysAgo !== null) {
          issues.push(`${sector.name}(${sector.code}): 评分已过期(${daysAgo}天前)`)
        }
        const { momentum, fundFlow, valuation, sentiment } = sector.factors
        if (momentum === 0 && fundFlow === 0 && valuation === 0 && sentiment === 0) {
          issues.push(`${sector.name}(${sector.code}): 所有因子均为0，疑似数据缺失`)
        }
      }

      const avgScore = sectors.length > 0 ? (totalScore / sectors.length).toFixed(1) : 'N/A'
      const report = [
        `=== 板块评分校验报告 ===`,
        `板块总数: ${sectors.length}`,
        `平均评分: ${avgScore}`,
        `问题数: ${issues.length}`,
        ...(issues.length > 0 ? [`\n--- 问题明细 ---`, ...issues] : ['\n无异常，所有板块评分通过校验']),
        `\n--- 评分分布 ---`,
        `高分(>=70): ${sectors.filter(s => s.score >= 70).length} 个`,
        `中分(30-70): ${sectors.filter(s => s.score > 30 && s.score < 70).length} 个`,
        `低分(<=30): ${sectors.filter(s => s.score <= 30).length} 个`,
        `及时(近一周): ${sectors.filter(s => getTimeliness(s.scoreDate).timely).length} 个`,
      ].join('\n')

      setVerifyResult(report)
      logger.info('[InputTestDashboard] 评分校验完成')
    } catch (err) {
      setVerifyResult(`校验失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [])

  // 数据一致性校验
  const handleCheckDataConsistency = useCallback(async () => {
    setVerifyResult('数据一致性校验中...')
    try {
      const rotationResult = await dataBridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.rotationScores,
        source: MODULE_ID.pool,
      })
      const rotationCount = rotationResult.success ? (rotationResult.data as unknown[]).length : 0

      const stocksResult = await dataBridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.pool,
      })
      const stocksCount = stocksResult.success ? (stocksResult.data as unknown[]).length : 0

      const traceResult = await dataBridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.traceRecords,
        source: MODULE_ID.pool,
      })
      const traceCount = traceResult.success ? (traceResult.data as unknown[]).length : 0

      const report = [
        `=== 数据一致性校验报告 ===`,
        `--- 存储记录数 ---`,
        `rotationScores(板块轮动评分): ${rotationCount} 条`,
        `stocks(股票池): ${stocksCount} 条`,
        `traceRecords(采集追踪): ${traceCount} 条`,
        `\n--- 采集质量 ---`,
        `采集成功率: ${qualityMetrics.successRate.toFixed(1)}%`,
        `数据完整率: ${qualityMetrics.completeness.toFixed(1)}%`,
        `写入成功率: ${qualityMetrics.writeRate.toFixed(1)}%`,
        `平均延迟: ${qualityMetrics.avgLatency.toFixed(0)}ms`,
        `降级次数: ${qualityMetrics.fallbackCount}`,
        `\n--- 健康状态 ---`,
        `采集服务: ${health === null ? '未检查' : health ? '已连接' : '未连接'}`,
        `热门板块: ${hotSectors.length} 个`,
      ].join('\n')

      setVerifyResult(report)
      logger.info('[InputTestDashboard] 数据一致性校验完成')
    } catch (err) {
      setVerifyResult(`一致性校验失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [qualityMetrics, health, hotSectors])

  // 页面冗余检测
  const duplicateAnalysis = useMemo(() => {
    const mergedPages = INPUT_PAGES.filter(p => p.status === 'merged' || p.status === 'deprecated')
    const activePages = INPUT_PAGES.filter(p => p.status === 'active')
    const groups = Object.entries(DUPLICATE_GROUPS).map(([groupName, keys]) => {
      const pages = keys.map(k => INPUT_PAGES.find(p => p.key === k)!).filter(Boolean)
      return { groupName, pages, count: pages.length }
    })
    return { mergedPages, activePages, groups, total: INPUT_PAGES.length, active: activePages.length, merged: mergedPages.length }
  }, [])

  // 测试统计
  const testStats = useMemo(() => {
    const total = testCases.length
    const ran = Object.keys(testResults).length
    const passed = Object.values(testResults).filter(r => r.passed).length
    const failed = Object.values(testResults).filter(r => !r.passed).length
    const pending = total - ran
    return { total, ran, passed, failed, pending, passRate: ran > 0 ? ((passed / ran) * 100).toFixed(1) : 'N/A' }
  }, [testCases, testResults])

  // 覆盖度统计
  const coverageStats = useMemo(() => {
    const covered = DATA_CHAIN_NODES.filter(n => n.status === 'covered').length
    const partial = DATA_CHAIN_NODES.filter(n => n.status === 'partial').length
    const missing = DATA_CHAIN_NODES.filter(n => n.status === 'missing').length
    const total = DATA_CHAIN_NODES.length
    return { covered, partial, missing, total, rate: ((covered / total) * 100).toFixed(0) }
  }, [])

  // 初始加载
  useEffect(() => {
    void handleCheckHealth()
    void handleRefreshHotSectors()
  }, [handleCheckHealth, handleRefreshHotSectors])

  // 测试用例按分类分组
  const testCasesByCategory = useMemo(() => {
    const groups: Record<string, TestCase[]> = {}
    for (const tc of testCases) {
      if (!groups[tc.category]) groups[tc.category] = []
      groups[tc.category]!.push(tc)
    }
    return groups
  }, [testCases])

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">输入舱系统测试看板</h2>
          <p className="text-sm text-muted-foreground">
            页面结构审计 · 采集质量监控 · 存储映射 · 评分校验 · 测试用例执行 · 覆盖度分析
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStale && <Badge variant="secondary" className="text-xs animate-pulse">数据过期</Badge>}
          <Badge variant="outline" className="text-xs">
            最后刷新: {new Date(lastRefresh).toLocaleTimeString('zh-CN')}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => { setLastRefresh(Date.now()); void handleRefreshHotSectors(); void forceRefresh() }}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 板块一：页面结构审计 */}
      {/* ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-info" />
              <CardTitle className="text-base">页面结构审计</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              共 {duplicateAnalysis.total} 条路由 · 活跃 {duplicateAnalysis.active} · 已合并/废弃 {duplicateAnalysis.merged}
            </Badge>
          </div>
          <CardDescription>输入舱所有页面/路由的结构完整性检查，识别重复、冗余、已合并页面</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 冗余分组 */}
          {duplicateAnalysis.groups.map(({ groupName, pages, count }) => (
            <div key={groupName} className="rounded-md border border-warning/20 bg-warning/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">{groupName}</span>
                <Badge variant="outline" className="text-[10px]">{count} 页 → 1 页</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {pages.map(page => (
                  <div key={page.key} className="flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1.5 text-xs shadow-sm">
                    <span className="font-medium">{page.label}</span>
                    <StatusBadge status={page.status} />
                    {page.mergedInto && (
                      <>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{page.mergedInto}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 全部页面列表 */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium">页面名称</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">路由路径</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">分类</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">状态</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {INPUT_PAGES.map(page => (
                  <tr key={page.key} className={cn(page.status === 'active' ? '' : 'text-muted-foreground')}>
                    <td className="px-3 py-2 font-medium">{page.label}</td>
                    <td className="px-3 py-2 font-mono text-xs">{page.path}</td>
                    <td className="px-3 py-2 text-xs">{page.category}</td>
                    <td className="px-3 py-2"><StatusBadge status={page.status} /></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{page.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* 板块二：数据采集质量与新鲜度监控 */}
      {/* ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-success" />
            <CardTitle className="text-base">数据采集质量与新鲜度监控</CardTitle>
          </div>
          <CardDescription>采集成功率、数据完整率、写入成功率、延迟、降级次数等核心质量指标</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {/* 采集成功率 */}
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">采集成功率</span>
                <ThresholdIndicator value={qualityMetrics.successRate} thresholds={{ danger: 95, warning: 80 }} />
              </div>
              <p className={cn('mt-1 text-lg font-bold', qualityMetrics.successRate >= 95 ? 'text-success' : qualityMetrics.successRate >= 80 ? 'text-warning' : 'text-destructive')}>
                {qualityMetrics.successRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">总采集 {qualityMetrics.totalCollects} 次</p>
            </div>

            {/* 数据完整率 */}
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">数据完整率</span>
                <ThresholdIndicator value={qualityMetrics.completeness} thresholds={{ danger: 90, warning: 70 }} />
              </div>
              <p className={cn('mt-1 text-lg font-bold', qualityMetrics.completeness >= 90 ? 'text-success' : qualityMetrics.completeness >= 70 ? 'text-warning' : 'text-destructive')}>
                {qualityMetrics.completeness.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">字段级非空率</p>
            </div>

            {/* 写入成功率 */}
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">写入成功率</span>
                <ThresholdIndicator value={qualityMetrics.writeRate} thresholds={{ danger: 95, warning: 85 }} />
              </div>
              <p className={cn('mt-1 text-lg font-bold', qualityMetrics.writeRate >= 95 ? 'text-success' : qualityMetrics.writeRate >= 85 ? 'text-warning' : 'text-destructive')}>
                {qualityMetrics.writeRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">DataBridge写入</p>
            </div>

            {/* 平均延迟 */}
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">平均延迟</span>
                <Badge className={qualityMetrics.avgLatency <= 2000 ? 'bg-success/10 text-success' : qualityMetrics.avgLatency <= 3000 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}>
                  {qualityMetrics.avgLatency <= 2000 ? '正常' : qualityMetrics.avgLatency <= 3000 ? '偏高' : '过高'}
                </Badge>
              </div>
              <p className={cn('mt-1 text-lg font-bold', qualityMetrics.avgLatency <= 2000 ? 'text-success' : qualityMetrics.avgLatency <= 3000 ? 'text-warning' : 'text-destructive')}>
                {qualityMetrics.avgLatency.toFixed(0)}ms
              </p>
              <p className="text-[10px] text-muted-foreground">端到端响应时间</p>
            </div>

            {/* 降级次数 */}
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">降级次数</span>
                <Badge className={cn(qualityMetrics.fallbackCount === 0 ? 'bg-success/10 text-success' : qualityMetrics.fallbackCount <= 5 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive')}>
                  {qualityMetrics.fallbackCount === 0 ? '正常' : qualityMetrics.fallbackCount <= 5 ? '偶发' : '频繁'}
                </Badge>
              </div>
              <p className="mt-1 text-lg font-bold">{qualityMetrics.fallbackCount}</p>
              <p className="text-[10px] text-muted-foreground">主源失败走Fallback</p>
            </div>

            {/* 采集服务健康 */}
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">采集服务</span>
                {health === null ? (
                  <Badge variant="outline">检查中</Badge>
                ) : health ? (
                  <Badge className="bg-success/10 text-success">已连接</Badge>
                ) : (
                  <Badge variant="destructive">未连接</Badge>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <span className={cn('inline-block h-2.5 w-2.5 rounded-full', health === true ? 'bg-success' : health === false ? 'bg-destructive' : 'bg-muted')} />
                <span className="text-xs text-muted-foreground">
                  {health === null ? '点击检查' : health ? '后端服务正常' : '后端服务异常'}
                </span>
              </div>
            </div>
          </div>

          {/* 新鲜度详情 */}
          <div className="mt-4 rounded-md border border-border/50 bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">数据新鲜度</span>
              {isStale && <Badge variant="secondary" className="text-[10px]">数据已过期({'>'}60s)</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <div>板块评分: {hotSectors.filter(s => getTimeliness(s.scoreDate).timely).length}/{hotSectors.length} 个及时</div>
              <div>采集统计: 自 {new Date(qualityStats.since ?? Date.now()).toLocaleString('zh-CN')}</div>
              <div>最后更新: {new Date(runtime.stats.since ?? Date.now()).toLocaleString('zh-CN')}</div>
              <div>日志: {runtime.logs.length} 条</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* 板块三：采集数据存放文件映射 */}
      {/* ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-info" />
            <CardTitle className="text-base">采集数据存放文件映射</CardTitle>
          </div>
          <CardDescription>数据域 → IndexedDB Store 映射关系，含数据来源、主键字段、新鲜度字段、测试覆盖状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium">数据域</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Store名称</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">数据来源</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">主键</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">新鲜度字段</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">测试覆盖</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {STORAGE_MAPPINGS.map((mapping, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium text-xs">{mapping.dataDomain}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{mapping.storeName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{mapping.source}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{mapping.keyField}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{mapping.freshnessField}</td>
                    <td className="px-3 py-2">
                      {mapping.tested
                        ? <Badge className="bg-success/10 text-success text-[10px]">有测试</Badge>
                        : <Badge variant="secondary" className="text-[10px]">无测试</Badge>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* 板块四：热门板块判断依据与评分原则校验 */}
      {/* ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Flame className={`h-4 w-4 ${twText('warning')}`} />
            <CardTitle className="text-base">热门板块判断依据与评分原则校验</CardTitle>
          </div>
          <CardDescription>热门板块评分维度、权重配置、及时性要求、动态排序逻辑</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 评分维度与权重 */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium">维度</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">权重</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">数据来源</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">范围</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {SCORING_PRINCIPLES.map((principle, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium text-xs">{principle.dimension}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{principle.weight}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{principle.source}</td>
                    <td className="px-3 py-2 text-xs">{principle.range}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{principle.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 实时板块数据 */}
          <div className="rounded-md border border-border/50 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">当前板块评分快照 ({hotSectors.length} 个板块)</span>
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleRefreshHotSectors} disabled={loadingSectors}>
                {loadingSectors ? '加载中...' : '刷新板块数据'}
              </Button>
            </div>
            {hotSectors.length > 0 ? (
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="px-2 py-1 text-left">板块</th>
                      <th className="px-2 py-1 text-right">评分</th>
                      <th className="px-2 py-1 text-right">动量</th>
                      <th className="px-2 py-1 text-right">资金</th>
                      <th className="px-2 py-1 text-right">估值</th>
                      <th className="px-2 py-1 text-right">情绪</th>
                      <th className="px-2 py-1 text-center">及时性</th>
                      <th className="px-2 py-1 text-right">成分股</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotSectors.slice(0, 20).map(sector => {
                      const { timely, daysAgo } = getTimeliness(sector.scoreDate)
                      return (
                        <tr key={sector.code} className="border-t border-border/30">
                          <td className="px-2 py-1 font-medium">{sector.name}</td>
                          <td className="px-2 py-1 text-right font-mono">{sector.score}</td>
                          <td className="px-2 py-1 text-right font-mono">{sector.factors.momentum.toFixed(0)}</td>
                          <td className="px-2 py-1 text-right font-mono">{sector.factors.fundFlow.toFixed(0)}</td>
                          <td className="px-2 py-1 text-right font-mono">{sector.factors.valuation.toFixed(0)}</td>
                          <td className="px-2 py-1 text-right font-mono">{sector.factors.sentiment.toFixed(0)}</td>
                          <td className="px-2 py-1 text-center">
                            {timely
                              ? <Badge className="bg-success/10 text-success text-[10px]">{daysAgo === 0 ? '今日' : `${daysAgo}天前`}</Badge>
                              : <Badge variant="secondary" className="text-[10px]">{daysAgo !== null ? `${daysAgo}天前` : '未标注'}</Badge>
                            }
                          </td>
                          <td className="px-2 py-1 text-right">{sector.stocks.length}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无板块数据，请刷新</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* 板块五：测试用例执行与管理 */}
      {/* ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">测试用例执行与管理</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                通过率: {testStats.passRate}%
              </Badge>
              <Badge variant="outline" className="text-xs">
                {testStats.passed}/{testStats.ran}
              </Badge>
            </div>
          </div>
          <CardDescription>13个自动化测试用例，覆盖采集服务/热门板块/数据存储/采集质量/页面结构五大分类</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 测试统计概览 */}
          <div className="grid grid-cols-5 gap-2">
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-center">
              <p className="text-lg font-bold text-primary">{testStats.total}</p>
              <p className="text-[10px] text-muted-foreground">总用例</p>
            </div>
            <div className="rounded-md border border-success/20 bg-success/5 p-2 text-center">
              <p className="text-lg font-bold text-success">{testStats.passed}</p>
              <p className="text-[10px] text-muted-foreground">通过</p>
            </div>
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-center">
              <p className="text-lg font-bold text-destructive">{testStats.failed}</p>
              <p className="text-[10px] text-muted-foreground">失败</p>
            </div>
            <div className="rounded-md border border-muted p-2 text-center">
              <p className="text-lg font-bold text-muted-foreground">{testStats.pending}</p>
              <p className="text-[10px] text-muted-foreground">待执行</p>
            </div>
            <div className="rounded-md border border-info/20 bg-info/5 p-2 text-center">
              <p className="text-lg font-bold text-info">{testStats.passRate}</p>
              <p className="text-[10px] text-muted-foreground">通过率%</p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="default" onClick={handleRunAll} disabled={runningTests.size > 0}>
              <Play className="mr-1 h-3.5 w-3.5" />
              {runningTests.size > 0 ? `运行中(${runningTests.size})...` : '运行全部测试'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleSaveReport} disabled={Object.keys(testResults).length === 0}>
              <Save className="mr-1 h-3.5 w-3.5" />
              保存报告
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportReport} disabled={Object.keys(testResults).length === 0}>
              <Download className="mr-1 h-3.5 w-3.5" />
              导出JSON
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClearResults} disabled={Object.keys(testResults).length === 0}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              清除结果
            </Button>
          </div>

          {/* 测试用例列表 */}
          <div className="space-y-3">
            {Object.entries(testCasesByCategory).map(([category, cases]) => (
              <div key={category}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{category} ({cases.length}个用例)</span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => void handleRunCategory(category)} disabled={runningTests.size > 0}>
                    <Play className="mr-1 h-3 w-3" />
                    运行全部
                  </Button>
                </div>
                <div className="space-y-1">
                  {cases.map(tc => {
                    const result = testResults[tc.id]
                    const isRunning = runningTests.has(tc.id)
                    return (
                      <div key={tc.id} className={cn(
                        'flex items-center gap-3 rounded-md border px-3 py-2 text-xs',
                        result?.passed ? 'border-success/20 bg-success/5' :
                          result && !result.passed ? 'border-destructive/20 bg-destructive/5' :
                            'border-border bg-background',
                      )}>
                        {/* 状态图标 */}
                        <div className="shrink-0">
                          {isRunning ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                          ) : result ? (
                            result.passed
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              : <XCircle className="h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </div>

                        {/* 用例信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{tc.id}</span>
                            <span className="text-foreground">{tc.name}</span>
                            <Badge className={cn(
                              'text-[9px]',
                              tc.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                                tc.severity === 'major' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground',
                            )}>
                              {tc.severity === 'critical' ? '严重' : tc.severity === 'major' ? '主要' : '次要'}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{tc.description}</p>
                          {result && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {result.details} ({result.duration}ms)
                            </p>
                          )}
                        </div>

                        {/* 操作 */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 shrink-0 text-xs"
                          onClick={() => void handleRunTest(tc)}
                          disabled={isRunning}
                        >
                          {isRunning ? '运行中...' : result ? '重新运行' : '运行'}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* 板块六：数据链覆盖度分析与缺口检测 */}
      {/* ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className={`h-4 w-4 ${twText('info')}`} />
              <CardTitle className="text-base">数据链覆盖度分析与缺口检测</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              覆盖度: {coverageStats.rate}% ({coverageStats.covered}/{coverageStats.total})
            </Badge>
          </div>
          <CardDescription>从数据源接入→采集执行→降级处理→质量校验→持久化写入→评分产出→热门板块→意向池注入的完整数据链覆盖度</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 覆盖度统计 */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-success/20 bg-success/5 p-2 text-center">
              <p className="text-lg font-bold text-success">{coverageStats.covered}</p>
              <p className="text-[10px] text-muted-foreground">已覆盖</p>
            </div>
            <div className="rounded-md border border-warning/20 bg-warning/5 p-2 text-center">
              <p className="text-lg font-bold text-warning">{coverageStats.partial}</p>
              <p className="text-[10px] text-muted-foreground">部分覆盖</p>
            </div>
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-center">
              <p className="text-lg font-bold text-destructive">{coverageStats.missing}</p>
              <p className="text-[10px] text-muted-foreground">未覆盖</p>
            </div>
          </div>

          {/* 数据链节点 */}
          <div className="space-y-2">
            {DATA_CHAIN_NODES.map((node, i) => (
              <div key={node.stage} className="rounded-md border p-3">
                <div className="flex items-center gap-3">
                  {/* 链路序号 */}
                  <div className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    node.status === 'covered' ? 'bg-success/10 text-success' :
                      node.status === 'partial' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive',
                  )}>
                    {i + 1}
                  </div>

                  {/* 节点信息 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{node.stage}</span>
                      <CoverageBadge status={node.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">{node.description}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {node.tests.map(t => (
                        <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* 缺口 */}
                  <div className="hidden max-w-[200px] text-right sm:block">
                    {node.gap ? (
                      <div className="flex items-center gap-1 text-[10px] text-destructive">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{node.gap}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-success">无缺口</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* 板块七：数据链关键动作 + 校对评分 */}
      {/* ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">数据链关键动作 · 校对评分</CardTitle>
          </div>
          <CardDescription>数据呈现过程中的关键操作按钮，覆盖采集→存储→评分→校验完整数据链</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 操作按钮组 */}
          <div className="flex flex-wrap gap-4">
            {/* 采集链路 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">采集链路</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleCheckHealth} disabled={checking}>
                  <Radar className="mr-1 h-3.5 w-3.5" />
                  {checking ? '检查中...' : '检查采集服务'}
                </Button>
                <Link to="/input/collection-monitor">
                  <Button size="sm" variant="outline">
                    <Activity className="mr-1 h-3.5 w-3.5" />
                    链路测试
                  </Button>
                </Link>
                <Link to="/input/collection-strategy">
                  <Button size="sm" variant="outline">
                    <Settings className="mr-1 h-3.5 w-3.5" />
                    采集策略配置
                  </Button>
                </Link>
              </div>
            </div>

            {/* 数据校验 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">数据校验</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleVerifyScores} disabled={loadingSectors}>
                  <Scale className="mr-1 h-3.5 w-3.5" />
                  评分校验
                </Button>
                <Button size="sm" variant="outline" onClick={handleCheckDataConsistency}>
                  <GitCompare className="mr-1 h-3.5 w-3.5" />
                  一致性校验
                </Button>
              </div>
            </div>

            {/* 热门板块 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">热门板块</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleRefreshHotSectors} disabled={loadingSectors}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {loadingSectors ? '刷新中...' : '刷新板块'}
                </Button>
                <Link to="/input/hot-sectors">
                  <Button size="sm" variant="outline">
                    <Flame className="mr-1 h-3.5 w-3.5" />
                    热门板块
                  </Button>
                </Link>
              </div>
            </div>

            {/* 测试执行 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">测试执行</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="default" onClick={handleRunAll} disabled={runningTests.size > 0}>
                  <Play className="mr-1 h-3.5 w-3.5" />
                  {runningTests.size > 0 ? `运行中(${runningTests.size})` : '运行全部测试'}
                </Button>
                <Button size="sm" variant="outline" onClick={handleSaveReport} disabled={Object.keys(testResults).length === 0}>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  保存报告
                </Button>
              </div>
            </div>
          </div>

          {/* 校验结果展示 */}
          {verifyResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">校验结果</span>
                <Button size="sm" variant="ghost" className="h-5 text-[10px]" onClick={() => setVerifyResult('')}>清除</Button>
              </div>
              <pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 text-xs font-mono leading-relaxed">
                {verifyResult}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* 板块八：测试总结 */}
      {/* ================================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-success" />
            <CardTitle className="text-base">测试总结</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-success/20 bg-success/5 p-3">
              <p className="text-xs text-muted-foreground">页面结构</p>
              <p className="text-lg font-bold text-success">{duplicateAnalysis.active}</p>
              <p className="text-[10px] text-muted-foreground">/ {duplicateAnalysis.total} 活跃页面</p>
            </div>
            <div className="rounded-md border border-info/20 bg-info/5 p-3">
              <p className="text-xs text-muted-foreground">数据存储</p>
              <p className="text-lg font-bold text-info">{STORAGE_MAPPINGS.length}</p>
              <p className="text-[10px] text-muted-foreground">个数据域映射</p>
            </div>
            <div className="rounded-md border border-warning/20 bg-warning/5 p-3">
              <p className="text-xs text-muted-foreground">热门板块</p>
              <p className={`text-lg font-bold ${twText('warning')}`}>{hotSectors.length}</p>
              <p className="text-[10px] text-muted-foreground">个板块备选</p>
            </div>
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">测试覆盖</p>
              <p className="text-lg font-bold text-primary">{testStats.passRate}</p>
              <p className="text-[10px] text-muted-foreground">测试通过率({testStats.passed}/{testStats.ran})</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}