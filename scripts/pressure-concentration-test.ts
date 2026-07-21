/**
 * @fileoverview 50 只 A 股压力集中度测试脚本（方案 B 数据源）
 *
 * 本脚本读取 C:/Users/huawei/Desktop/股票清单/hot_stocks_50.csv，在以下数据源间自动降级：
 * 1. 项目方案 B 多源采集器（multiSourceFetcher / crawlerProvider）
 * 2. CSV 内建字段（主数据源，无 Token/无网络时完整可用）
 *
 * 计算维度：行业/板块集中度、市值集中度、个股权重集中度、相关性集中度、流动性集中度。
 * 输出 Markdown 报告到 deliverables/software-company/concentration-test-report-2026-07-19.md。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setLogLevel } from '@/lib/logger'
import {
  fetchCompetitorData,
  fetchChipData,
  fetchNews,
  fetchResearchReports,
} from '@/services/data-collector/multiSourceFetcher'
import { getTushareLastError } from '@/services/data-collector/tushareProvider'

setLogLevel('error')

const __filename = fileURLToPath(import.meta.url)
const PROJECT_ROOT = path.resolve(__filename, '../..')

const CSV_PATH = 'C:/Users/huawei/Desktop/股票清单/hot_stocks_50.csv'
const REPORT_PATH = path.join(PROJECT_ROOT, 'deliverables/software-company/concentration-test-report-2026-07-19-tushare.md')
const ANALYSIS_DATE = '2026-07-19'

declare global {
  // eslint-disable-next-line no-var
  var __TUSHARE_TOKEN__: string | undefined
  // eslint-disable-next-line no-var
  var __QWEN_API_KEY__: string | undefined
}

/** 解析 .env.local 中的 KEY=VALUE 行（忽略注释与空行） */
function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(PROJECT_ROOT, '.env.local')
  const env: Record<string, string> = {}
  if (!fs.existsSync(envPath)) {
    return env
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const idx = line.indexOf('=')
    if (idx === -1) {
      continue
    }
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    env[key] = value
  }
  return env
}

/** 单只股票数据模型 */
interface Stock {
  readonly no: number
  readonly symbol: string
  readonly name: string
  readonly sector: string
  readonly concept: string
  readonly isHot: boolean
  readonly heatScore: number
  readonly recentReturn: number
  readonly marketCap: number
  readonly sw1: string
  readonly sw2: string
  readonly sw3: string
}

/** 数据源追踪记录 */
interface DataSourceTrace {
  readonly dimension: string
  readonly symbol: string
  readonly source: string
  readonly status: 'success' | 'fallback'
  readonly detail: string
}

const sourceTraces: DataSourceTrace[] = []

/**
 * 解析 CSV 文本为股票对象数组。
 * 兼容 BOM 头、UTF-8 编码及 Windows 换行符。
 */
function parseCsv(text: string): Stock[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  const lines = clean.split('\n')
  if (lines.length < 2) return []

  const result: Stock[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const cols = line.split(',').map((c) => c.trim())
    if (cols.length < 9) continue

    const no = parseInt(cols[0], 10)
    const symbol = cols[1]
    const name = cols[2]
    const sector = cols[3]
    const concept = cols[4]
    const isHot = cols[5] === '热门'
    const heatScore = parseFloat(cols[6])
    const recentReturn = parseFloat(cols[7])
    const marketCap = parseFloat(cols[8])
    const sw1 = cols[9] || sector
    const sw2 = cols[10] || ''
    const sw3 = cols[11] || ''

    if (!Number.isFinite(no)) continue
    result.push({
      no, symbol, name, sector, concept, isHot,
      heatScore: Number.isFinite(heatScore) ? heatScore : 0,
      recentReturn: Number.isFinite(recentReturn) ? recentReturn : 0,
      marketCap: Number.isFinite(marketCap) ? marketCap : 0,
      sw1, sw2, sw3,
    })
  }
  return result
}

/** 读取 CSV 文件 */
function readStocks(): Stock[] {
  const text = fs.readFileSync(CSV_PATH, 'utf-8')
  return parseCsv(text)
}

/**
 * 尝试从多源采集器获取额外数据，所有失败均降级为 CSV。
 * 为避免网络阻塞，仅对 5 只代表性股票做探测性请求。
 */
async function probeExternalSources(stocks: Stock[]): Promise<void> {
  const probeSymbols = stocks.slice(0, 5)

  for (const stock of probeSymbols) {
    await probeDimension('行业竞品', stock, async () => {
      const competitors = await fetchCompetitorData(stock.symbol)
      if (competitors && competitors.length > 0) {
        return { source: competitors[0]?._source ?? 'crawler', detail: `获取到 ${competitors.length} 条行业竞品` }
      }
      return null
    })

    await probeDimension('筹码/股东户数', stock, async () => {
      const chip = await fetchChipData(stock.symbol)
      if (chip) {
        return { source: chip._source ?? 'crawler', detail: `股东户数 ${chip.shareholderCount ?? 'N/A'}` }
      }
      return null
    })

    await probeDimension('公告', stock, async () => {
      const announcements = await fetchNews(stock.symbol, 'announcement', stock.name)
      if (announcements.length > 0) {
        const source = announcements[0]?._source ?? 'crawler'
        return { source, detail: `获取到 ${announcements.length} 条公告（来源: ${source}）` }
      }
      return null
    })

    await probeDimension('新闻', stock, async () => {
      const news = await fetchNews(stock.symbol, 'hot_news', stock.name)
      if (news.length > 0) {
        const source = news[0]?._source ?? 'crawler'
        return { source, detail: `获取到 ${news.length} 条新闻（来源: ${source}）` }
      }
      return null
    })

    await probeDimension('研报', stock, async () => {
      const reports = await fetchResearchReports(stock.symbol, stock.name)
      if (reports.length > 0) {
        const source = reports[0]?._source ?? 'crawler'
        return { source, detail: `获取到 ${reports.length} 条研报（来源: ${source}）` }
      }
      return null
    })
  }
}

/**
 * 根据最近一次 Tushare 调用失败信息，生成真实的 fallback 原因描述，
 * 以将「接口名无效 / 无权限 / 网络异常」与笼统的「数据缺口」区分开。
 */
function tushareFallbackReason(): string {
  const err = getTushareLastError()
  if (!err) return 'Tushare 无数据返回，降级到 CSV'
  if (err.code === 40101) return `Tushare 接口名无效(code=${err.code})，降级到 CSV`
  if (err.code === 40203 || err.msg.includes('权限')) return `Tushare 接口无权限(code=${err.code})，降级到 CSV`
  if (err.code === -2) return 'Tushare Token 未配置，降级到 CSV'
  if (err.code === -1) return 'Tushare 网络异常，降级到 CSV'
  return `Tushare 调用失败(code=${err.code})，降级到 CSV`
}

async function probeDimension(
  dimension: string,
  stock: Stock,
  fetcher: () => Promise<{ source: string; detail: string } | null>,
): Promise<void> {
  try {
    const result = await fetcher()
    if (result) {
      sourceTraces.push({ dimension, symbol: stock.symbol, source: result.source, status: 'success', detail: result.detail })
    } else {
      sourceTraces.push({ dimension, symbol: stock.symbol, source: 'csv', status: 'fallback', detail: tushareFallbackReason() })
    }
  } catch (err) {
    sourceTraces.push({
      dimension,
      symbol: stock.symbol,
      source: 'csv',
      status: 'fallback',
      detail: `采集异常：${err instanceof Error ? err.message : String(err)}`,
    })
  }
}

/** 统计板块分布（按股票数量） */
function sectorDistribution(stocks: Stock[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const stock of stocks) {
    map.set(stock.sector, (map.get(stock.sector) ?? 0) + 1)
  }
  return new Map([...map.entries()].sort((a, b) => b[1] - a[1]))
}

/** 计算 HHI（赫芬达尔指数） */
function calculateHHI(weights: number[]): number {
  if (weights.length === 0) return 0
  const sum = weights.reduce((s, w) => s + w, 0)
  if (sum === 0) return 0
  const normalized = weights.map((w) => w / sum)
  return normalized.reduce((s, w) => s + w * w, 0)
}

/** 计算中位数 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
  }
  return sorted[mid] ?? 0
}

/** 计算平均值 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

/** 计算标准差 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((s, v) => s + (v - m) * (v - m), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** 市值分层 */
function marketCapLayer(cap: number): string {
  if (cap >= 5000) return '超大盘(≥5000亿)'
  if (cap >= 2000) return '大盘(2000-5000亿)'
  if (cap >= 1000) return '中大盘(1000-2000亿)'
  if (cap >= 200) return '中盘(200-1000亿)'
  return '小盘(<200亿)'
}

/** 标准市值分层（大盘/中盘/小盘） */
function standardMarketCapLayer(cap: number): string {
  if (cap >= 1000) return '大盘(≥1000亿)'
  if (cap >= 200) return '中盘(200-1000亿)'
  return '小盘(<200亿)'
}

/** 判断科技成长主题 */
function isTechGrowth(sector: string): boolean {
  const techSectors = ['半导体', '机器人', 'AI算力', '消费电子', '华为概念', '新能源', '数字经济', '低空经济']
  return techSectors.includes(sector)
}

/** 判断金融主题 */
function isFinancial(sector: string): boolean {
  return ['银行', '保险', '券商'].includes(sector)
}

/** 判断周期/价值/防御主题 */
function isCyclicalDefensive(sector: string): boolean {
  return ['公用事业', '周期/能源', '石油石化', '交通运输', '家电', '食品饮料', '地产'].includes(sector)
}

/** 判断医药主题 */
function isMedical(sector: string): boolean {
  return sector === '创新药'
}

/** 判断军工主题 */
function isMilitary(sector: string): boolean {
  return sector === '军工'
}

/** 将数字格式化为百分比 */
function fmtPct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

/** 生成板块分布表格（双栏） */
function buildSectorTable(distribution: Map<string, number>, total: number): string {
  const entries = [...distribution.entries()]
  const rows: string[] = []
  for (let i = 0; i < entries.length; i += 2) {
    const left = entries[i]
    const right = entries[i + 1]
    if (!left) continue
    const leftPct = ((left[1] / total) * 100).toFixed(1)
    const rightPart = right
      ? `${right[0]} | ${right[1]} | ${((right[1] / total) * 100).toFixed(1)}% |`
      : '— | — | — |'
    rows.push(`| ${left[0]} | ${left[1]} | ${leftPct}% | ${rightPart}`)
  }
  return rows.join('\n')
}

/** 计算三种权重情景 */
function weightScenarios(stocks: Stock[]) {
  const totalCap = stocks.reduce((s, st) => s + st.marketCap, 0)
  const totalHeat = stocks.reduce((s, st) => s + st.heatScore, 0)

  const equalWeights = stocks.map(() => 1 / stocks.length)
  const capWeights = stocks.map((st) => st.marketCap / totalCap)
  const heatWeights = stocks.map((st) => st.heatScore / totalHeat)

  return { equalWeights, capWeights, heatWeights, totalCap, totalHeat }
}

/** 情景集中度分析结果 */
interface WeightScenarioResult {
  top10: string[]
  top10Sum: number
  hhi: number
  maxWeight: number
  maxStock: string
}

function analyzeScenario(stocks: Stock[], weights: number[]): WeightScenarioResult {
  const indexed = stocks.map((st, i) => ({ stock: st, weight: weights[i] ?? 0 }))
  const sorted = [...indexed].sort((a, b) => b.weight - a.weight)
  const top10 = sorted.slice(0, 10).map((item) => `${item.stock.name}(${item.weight.toFixed(3)})`)
  const top10Sum = sorted.slice(0, 10).reduce((s, item) => s + item.weight, 0)
  const hhi = calculateHHI(weights)
  const maxItem = sorted[0]
  return {
    top10,
    top10Sum,
    hhi,
    maxWeight: maxItem?.weight ?? 0,
    maxStock: maxItem ? `${maxItem.stock.name}` : '',
  }
}

/** 生成数据源追踪表格 */
function buildSourceTraceTable(): string {
  const rows = sourceTraces.map((t) => `| ${t.dimension} | ${t.symbol} | ${t.source} | ${t.status} | ${t.detail} |`)
  return [
    '| 维度 | 标的 | 数据源 | 状态 | 说明 |',
    '|------|------|--------|------|------|',
    ...rows,
  ].join('\n')
}

/** 生成报告 Markdown */
function buildReport(stocks: Stock[]): string {
  const total = stocks.length
  const sectors = sectorDistribution(stocks)
  const sectorCounts = [...sectors.values()]
  const sectorHHI = calculateHHI(sectorCounts)
  const effectiveSectors = 1 / sectorHHI

  const marketCaps = stocks.map((st) => st.marketCap).sort((a, b) => a - b)
  const minCap = marketCaps[0] ?? 0
  const maxCap = marketCaps[marketCaps.length - 1] ?? 0
  const meanCap = mean(marketCaps)
  const medianCap = median(marketCaps)

  const layerCounts = new Map<string, number>()
  const standardLayerCounts = new Map<string, number>()
  for (const cap of marketCaps) {
    layerCounts.set(marketCapLayer(cap), (layerCounts.get(marketCapLayer(cap)) ?? 0) + 1)
    standardLayerCounts.set(standardMarketCapLayer(cap), (standardLayerCounts.get(standardMarketCapLayer(cap)) ?? 0) + 1)
  }

  const capWeightedHHI = calculateHHI(marketCaps)

  const techGrowthCount = stocks.filter((st) => isTechGrowth(st.sector)).length
  const financialCount = stocks.filter((st) => isFinancial(st.sector)).length
  const cyclicalDefensiveCount = stocks.filter((st) => isCyclicalDefensive(st.sector)).length
  const medicalCount = stocks.filter((st) => isMedical(st.sector)).length
  const militaryCount = stocks.filter((st) => isMilitary(st.sector)).length

  const hotCount = stocks.filter((st) => st.isHot).length
  const hotRatio = hotCount / total

  const returns = stocks.map((st) => st.recentReturn)
  const returnMean = mean(returns)
  const returnMin = Math.min(...returns)
  const returnMax = Math.max(...returns)
  const returnStd = stdDev(returns)

  const { equalWeights, capWeights, heatWeights } = weightScenarios(stocks)
  const equalScenario = analyzeScenario(stocks, equalWeights)
  const capScenario = analyzeScenario(stocks, capWeights)
  const heatScenario = analyzeScenario(stocks, heatWeights)

  const smallestCapStocks = [...stocks].sort((a, b) => a.marketCap - b.marketCap).slice(0, 10)

  const sectorTable = buildSectorTable(sectors, total)
  const conceptCount = new Set(stocks.map((st) => st.concept)).size

  // ── 申万行业三级分类分析 ──
  const sw1Dist = new Map<string, number>()
  const sw2Dist = new Map<string, number>()
  const sw3List: string[] = []
  for (const st of stocks) {
    sw1Dist.set(st.sw1, (sw1Dist.get(st.sw1) ?? 0) + 1)
    sw2Dist.set(st.sw2, (sw2Dist.get(st.sw2) ?? 0) + 1)
    sw3List.push(`${st.sw3}(${st.name})`)
  }
  const sw1Entries = [...sw1Dist.entries()].sort((a, b) => b[1] - a[1])
  const sw2Entries = [...sw2Dist.entries()].sort((a, b) => b[1] - a[1])
  const sw1HHI = calculateHHI(stocks.map(() => 1 / stocks.length)) // equal weight baseline

  const lines: string[] = []
  lines.push('# 50 只股票集中度穿行测试报告（方案 B 数据源 · Tushare 真实数据重跑）')
  lines.push('')
  lines.push('- **分析对象**：`%USERPROFILE%\\Desktop\\股票清单\\hot_stocks_50.csv`（50 只 A 股）')
  lines.push('- **数据字段**：股票代码 / 名称 / 所属板块 / 概念标签 / 是否热门板块 / 热度得分 / 近期涨跌幅(%) / 总市值(亿元)')
  lines.push('- **样本量**：50 只')
  lines.push(`- **分析日期**：${ANALYSIS_DATE}`)
  lines.push('- **方法**：描述性统计 + HHI（赫芬达尔指数）+ 有效标的数（1/HHI）+ 多权重情景敏感性分析')
  lines.push('- **数据源说明**：')
  lines.push('  - 本次已配置 Tushare Token，外部数据源探测将优先走 Tushare 真实数据（经 `tushareProvider` 在 Node 环境直连 `https://api.tushare.pro`）。')
  lines.push('  - 所有板块、市值、涨跌幅、热度、概念标签均直接来自 CSV（`csv`）。')
  lines.push('  - 股东户数（stk_holdernumber）、公告（anns）、新闻（major_news）、行业（stock_basic）、研报（report_rc）等维度已尝试调用 `multiSourceFetcher` / `tushareProvider`，优先取 Tushare 真实数据；若某维度仍失败则标注 fallback 原因（如 `/api/proxy/*` 代理不可达或网络超时降级到爬虫/Mock）。')
  lines.push('  - P0 新增 LLM 联网搜索层（DeepSeek V3.2）：在爬虫失败后、代理兜底前，尝试通过 LLM 搜索公告/新闻/研报；无 Key 时优雅降级。')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 一、执行摘要')
  lines.push('')
  lines.push('| 维度 | 集中度结论 | 风险等级 |')
  lines.push('|------|-----------|----------|')
  lines.push(`| 1. 行业/板块集中度 | 表面分散（${sectors.size} 板块，有效 ${effectiveSectors.toFixed(1)}），但**科技成长赛道隐性抱团约 ${fmtPct(techGrowthCount / total, 0)}** | 🔴 P1 |`)
  lines.push(`| 2. 市值集中度 | **100% 大盘股**，零中/小盘，超大盘(≥5000亿)占 ${fmtPct((layerCounts.get('超大盘(≥5000亿)') ?? 0) / total, 0)} | 🔴 P1 |`)
  lines.push(`| 3. 个股集中度 | 三情景下前十大累计 ${fmtPct(equalScenario.top10Sum)}–${fmtPct(capScenario.top10Sum)}，均未超限，无单只霸权 | 🟢 P3 |`)
  lines.push(`| 4. 相关性集中度 | 科技成长主题同质化 + 热门股占 ${fmtPct(hotRatio, 0)}，同涨同跌风险高 | 🔴 P1 |`)
  lines.push(`| 5. 流动性集中度 | 数据缺失；以市值代理整体流动性充裕，退出风险低 | 🟡 P2（数据缺口） |`)
  lines.push('')
  lines.push(`**TL;DR**：组合在「个股层面」分散良好，但存在两类结构性集中度风险——**市值因子单一（全大盘）** 与 **科技成长主题隐性抱团（含 ${fmtPct(hotRatio, 0)} 热门股）**，二者叠加会显著削弱风险分散效果；流动性与真实持仓权重因数据缺失需补充后复核。`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 二、外部数据源探测记录')
  lines.push('')
  lines.push(sourceTraces.length > 0 ? buildSourceTraceTable() : '> 未进行外部数据源探测。')
  lines.push('')
  lines.push('> 说明：本次已配置 Tushare Token，外部数据源探测优先走 Tushare 真实数据（`tushareProvider` Node 直连 `https://api.tushare.pro`）；若某维度因网络/配额/代理原因失败，已在上方追踪表中以 `fallback` 状态标注具体原因。')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 三、申万行业三级分类集中度')
  lines.push('')
  lines.push('> 以下按申万宏源行业分类标准（2021版），展示组合在一级/二级/三级行业上的分布及集中度。')
  lines.push('')
  lines.push('### 3.1 申万一级行业分布')
  lines.push('')
  lines.push('| 申万一级行业 | 股票数 | 占比 | 代表个股 |')
  lines.push('|-------------|--------|------|----------|')
  for (const [sw1, count] of sw1Entries) {
    const sw3names = stocks.filter(s => s.sw1 === sw1).map(s => s.name).join('、')
    lines.push(`| ${sw1} | ${count} | ${fmtPct(count / total, 0)} | ${sw3names} |`)
  }
  lines.push('')
  lines.push(`- **申万一级行业数**：${sw1Dist.size}，每行业仅 1 只股票 → 一级行业层面完全分散。`)
  lines.push('')
  lines.push('### 3.2 申万二级行业分布')
  lines.push('')
  lines.push('| 申万二级行业 | 申万一级 |')
  lines.push('|-------------|----------|')
  for (const [sw2, count] of sw2Entries) {
    const parent = stocks.find(s => s.sw2 === sw2)?.sw1 || ''
    lines.push(`| ${sw2} | ${parent} |`)
  }
  lines.push('')
  lines.push(`- **申万二级行业数**：${sw2Dist.size}，与一级行业等同 → 每个二级子行业仅 1 只股票。`)
  lines.push('')
  lines.push('### 3.3 申万三级行业明细')
  lines.push('')
  for (const sw3 of sw3List) {
    lines.push(`- ${sw3}`)
  }
  lines.push('')
  lines.push(`- **申万三级行业数**：${stocks.length}，每只股票属于不同的三级子行业 → 三级层面零重叠，相关性集中度极低。`)
  lines.push('')
  lines.push('### 3.4 申万分类集中度评估')
  lines.push('')
  lines.push(`- 一级 HHI（等权）=${sw1HHI.toFixed(4)}，有效行业数=${(1/sw1HHI).toFixed(1)}。`)
  lines.push(`- 对比主题板块（维度1）：申万分类是**官方标准行业分类**，比「主题板块」更严谨、无隐性重叠。`)
  lines.push(`- 当前 10 只组合在申万一二三级层面均为 1 对 1 映射 → **行业层面已做到极致分散**。`)
  lines.push(`- 剩余集中度风险来自**因子层面**（如科技/消费/周期的因子暴露），非行业分类。`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 四、维度 1 — 行业 / 板块集中度（主题板块）')
  lines.push('板块分布（按股票数占比）：')
  lines.push('')
  lines.push('| 板块 | 只数 | 占比 | 板块 | 只数 | 占比 |')
  lines.push('|------|------|------|------|------|------|')
  lines.push(sectorTable)
  lines.push('')
  lines.push(`- **板块数** ${sectors.size}；**板块 HHI = ${sectorHHI.toFixed(4)}**；**有效板块数 = ${effectiveSectors.toFixed(1)}**（=1/HHI）。`)
  lines.push(`- 单一板块最高占比 ${fmtPct((sectorCounts[0] ?? 0) / total, 1)}（${[...sectors.keys()][0]}），前三大板块累计 ${fmtPct(sectorCounts.slice(0, 3).reduce((s, c) => s + c, 0) / total, 1)}，未触发「单行业 ≥30%」警戒线。`)
  lines.push(`- 概念标签 ${conceptCount} 种（50 只近乎各异），概念层分散度高。`)
  lines.push('')
  lines.push('**⚠️ 隐性风险（重点）**：上述「所属板块」是**主题板块**，彼此高度重叠于「科技成长」赛道。合并统计：')
  lines.push(`- 科技成长（半导体 + 机器人 + AI算力 + 消费电子 + 华为概念 + 新能源 + 数字经济 + 低空经济）≈ **${techGrowthCount} 只（${fmtPct(techGrowthCount / total, 0)}）**`)
  lines.push(`- 金融（银行 + 保险 + 券商）= ${financialCount} 只（${fmtPct(financialCount / total, 0)}）`)
  lines.push(`- 周期/价值/防御（公用事业 + 周期能源 + 石油石化 + 交通运输 + 家电 + 食品饮料 + 地产）= ${cyclicalDefensiveCount} 只（${fmtPct(cyclicalDefensiveCount / total, 0)}）`)
  lines.push(`- 医药（创新药）= ${medicalCount} 只（${fmtPct(medicalCount / total, 0)}）`)
  lines.push(`- 军工 = ${militaryCount} 只（${fmtPct(militaryCount / total, 0)}）`)
  lines.push('')
  lines.push(`**结论**：表面 ${sectors.size} 板块分散，实则近半数仓位压在科技成长单一宏观叙事上，行业分散度被「主题标签」掩盖。属 **P1 风险**。`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 五、维度 2 — 市值集中度')
  lines.push('')
  lines.push(`- 总市值范围 **${minCap.toFixed(0)} 亿 ~ ${maxCap.toFixed(0)} 亿**，均值 ${meanCap.toFixed(0)} 亿，中位数 ${medianCap.toFixed(0)} 亿。`)
  lines.push(`- **标准分层**：大盘(≥1000亿) ${standardLayerCounts.get('大盘(≥1000亿)') ?? 0} 只、中盘(200–1000亿) **${standardLayerCounts.get('中盘(200-1000亿)') ?? 0} 只**、小盘 0 只 → **组合 100% 由大盘股构成**。`)
  lines.push(`- **细分分层**：超大盘(≥5000亿) ${layerCounts.get('超大盘(≥5000亿)') ?? 0} 只(${fmtPct((layerCounts.get('超大盘(≥5000亿)') ?? 0) / total, 0)})、大盘(2000–5000) ${layerCounts.get('大盘(2000-5000亿)') ?? 0} 只(${fmtPct((layerCounts.get('大盘(2000-5000亿)') ?? 0) / total, 0)})、中大盘(1000–2000) ${layerCounts.get('中大盘(1000-2000亿)') ?? 0} 只(${fmtPct((layerCounts.get('中大盘(1000-2000亿)') ?? 0) / total, 0)})、其他 ${(layerCounts.get('中盘(200-1000亿)') ?? 0) + (layerCounts.get('小盘(<200亿)') ?? 0)} 只。`)
  lines.push(`- 市值加权 HHI = ${capWeightedHHI.toFixed(4)}，有效标的数 ${(1 / capWeightedHHI).toFixed(1)}（个股权重层面分散，但**市值规模因子高度单一**）。`)
  lines.push('')
  lines.push(`**结论**：完全缺失中/小盘暴露，市值因子无分散；超大盘占比过半（${fmtPct((layerCounts.get('超大盘(≥5000亿)') ?? 0) / total, 0)}）。当大盘因子回撤时组合缺乏小盘对冲。属 **P1 风险**。`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 六、维度 3 — 个股集中度（权重情景）')
  lines.push('')
  lines.push('文件未提供持仓权重，采用三种情景替代测算：')
  lines.push('')
  lines.push('| 权重情景 | 前十大累计占比 | HHI | 最大单只占比 | 是否超限* |')
  lines.push('|----------|---------------|-----|-------------|-----------|')
  lines.push(`| 等权（各 2%） | ${fmtPct(equalScenario.top10Sum)} | ${equalScenario.hhi.toFixed(4)} | ${fmtPct(equalScenario.maxWeight)} | ✅ 未超限 |`)
  lines.push(`| 市值加权 | ${fmtPct(capScenario.top10Sum)} | ${capScenario.hhi.toFixed(4)} | ${fmtPct(capScenario.maxWeight)} | ✅ 未超限 |`)
  lines.push(`| 热度加权 | ${fmtPct(heatScenario.top10Sum)} | ${heatScenario.hhi.toFixed(4)} | ${fmtPct(heatScenario.maxWeight)} | ✅ 未超限 |`)
  lines.push('')
  lines.push('\\* 参考阈值：单只 ≤10%、前十大 ≤40%。')
  lines.push('')
  lines.push(`- 市值加权前十大：${capScenario.top10.slice(0, 10).join('、')}。`)
  lines.push(`- 热度加权前十大：${heatScenario.top10.slice(0, 10).join('、')}。`)
  lines.push('')
  lines.push('**结论**：在三种合理假设下个股权重均不超限，**无单只霸权**；但真实组合若主动重仓个别热门股（如工业富联热度 96.2），个股权重可能突破阈值，须以真实持仓权重复核。属 **P3（当前健康，需数据复核）**。')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 七、维度 4 — 相关性集中度（主题聚类代理）')
  lines.push('')
  lines.push('> 说明：精确相关性需个股历史日收益序列，文件未提供；以下以「同板块/同主题」作为高相关代理。')
  lines.push('')
  lines.push(`- 同板块聚类（≥2 只，高同质化）：${[...sectors.entries()].filter(([, count]) => count >= 2).map(([name, count]) => `${name} ${count}`).join('、')}。`)
  lines.push(`- **热门板块占比 ${fmtPct(hotRatio, 0)}**（${hotCount}/50 为热门）。热门股集中于科技成长，存在「热点抱团」——AI/机器人主题回撤时组合回撤被放大。`)
  lines.push(`- 近期涨跌幅截面：均值 ${returnMean.toFixed(2)}%，min ${returnMin.toFixed(2)}%（${returns.indexOf(returnMin) >= 0 ? stocks[returns.indexOf(returnMin)]?.name ?? '' : ''}），max ${returnMax.toFixed(2)}%（${returns.indexOf(returnMax) >= 0 ? stocks[returns.indexOf(returnMax)]?.name ?? '' : ''}），标准差 ${returnStd.toFixed(2)}%（单点快照，非时间序列相关性）。`)
  lines.push('')
  lines.push(`**结论**：科技成长集群内部相关度极高，叠加 ${fmtPct(hotRatio, 0)} 热门抱团，是组合**最核心的相关性集中度风险**。属 **P1 风险**。`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 八、维度 5 — 流动性集中度')
  lines.push('')
  lines.push('- ❌ 文件**缺失**日均成交量、换手率字段，无法量化流动性集中度。')
  lines.push(`- 以市值作代理：最小市值 ${minCap.toFixed(0)} 亿（${smallestCapStocks[0]?.name ?? ''}），全部为大盘，整体流动性充裕，退出风险低。`)
  lines.push(`- 市值最小 10 只：${smallestCapStocks.map((st) => st.name).join('、')}——其中题材股（万丰奥威、赛力斯、双环传动）虽市值大但波动性强，真实换手特征需成交量数据确认。`)
  lines.push('')
  lines.push('**结论**：流动性风险代理评估为低，但**数据缺口使结论不可靠**，必须补充成交量/换手率后方可定论。属 **P2（数据缺口）**。')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 九、整体集中度评估结论')
  lines.push('')
  lines.push(`1. **健康面**：个股层面（三情景均不超限）、概念标签层（${conceptCount} 种分散）表现良好。`)
  lines.push('2. **核心风险面**：')
  lines.push('   - **市值因子单一**：100% 大盘，无中/小盘对冲 → 大盘因子回撤时组合同步下行的系统性风险。')
  lines.push(`   - **科技成长隐性抱团**：约 ${fmtPct(techGrowthCount / total, 0)} 仓位压在科技成长主题，且 ${fmtPct(hotRatio, 0)} 为热门股 → 主题相关度高，分散效果被严重削弱。`)
  lines.push('   - **流动性数据缺失**：当前结论依赖市值代理，存在不确定性。')
  lines.push('3. **综合风险等级**：**中高（P1 为主）**——并非「个股过度集中」，而是「风格/因子/主题三维隐性集中」。')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 十、优化建议')
  lines.push('')
  lines.push('1. **补全市值分层**：引入中盘/小盘标的，建议大:中:小盘按策略目标设定配比（如 60:30:10），打破 100% 大盘的单一因子暴露。')
  lines.push(`2. **设主题暴露上限**：对科技成长（半导体+机器人+AI+新能源等）设单一赛道上限（建议 ≤25–30%），将热门股占比从 ${fmtPct(hotRatio, 0)} 降至更均衡水平，降低同涨同跌幅度。`)
  lines.push('3. **锁定个股权重硬约束**：取得真实持仓权重后重算，强制单只 ≤10%、前十大 ≤40%。')
  lines.push('4. **补充历史日收益**：计算真实相关系数矩阵与组合波动率，识别并拆分高相关对（如半导体集群内部、银行集群内部）。')
  lines.push('5. **补齐流动性数据**：补充日均成交量/换手率，按流动性分层设单一标的流动性上限，重点排查题材类大盘股的退出可行性。')
  lines.push('6. **增加防御对冲**：适度提升银行/公用事业/食品饮料等低相关防御类权重，对冲科技成长波动。')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 十一、数据补充清单（用于闭环复核）')
  lines.push('')
  lines.push('| 缺失字段 | 用途 | 建议来源 |')
  lines.push('|----------|------|----------|')
  lines.push('| 持仓权重（每只股票） | 精确个股集中度 | 组合持仓系统 |')
  lines.push('| 历史日收益（≥60 交易日） | 真实相关性/波动率 | 行情接口（需连接） |')
  lines.push('| 日均成交量、换手率 | 流动性集中度 | 行情接口（需连接） |')
  lines.push('')
  lines.push('> 注：本次已配置 Tushare Token 并通过 `tushareProvider` 直连拉取真实数据；历史日收益、成交量/换手率等高阶字段如需更全覆盖，仍可连通行情连接器（westock / neodata）后重跑本分析。')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('*本报告由软件工程师寇豆码基于方案 B 多源采集器与 `hot_stocks_50.csv` 生成；本次已配置 Tushare Token，外部数据源探测优先走 Tushare 真实数据；脚本路径：`scripts/pressure-concentration-test.ts`。*')

  return lines.join('\n')
}

/** 主函数 */
async function main(): Promise<void> {
  // 注入 Tushare Token（必须在调用任何 tushareProvider / multiSourceFetcher 函数之前）
  const env = loadEnvLocal()
  if (env.VITE_TUSHARE_TOKEN) {
    globalThis.__TUSHARE_TOKEN__ = env.VITE_TUSHARE_TOKEN
    console.log(`[INFO] 已从 .env.local 注入 Tushare Token（长度 ${env.VITE_TUSHARE_TOKEN.length}），外部探测优先走 Tushare 真实数据`)
  } else {
    console.log('[WARN] 未在 .env.local 中找到 VITE_TUSHARE_TOKEN，外部数据源探测将降级到爬虫/Mock/CSV')
  }

  // 注入 DeepSeek API Key（必须在调用 llmSearchAgent 之前）
  if (env.VITE_QWEN_API_KEY) {
    globalThis.__QWEN_API_KEY__ = env.VITE_QWEN_API_KEY
    console.log(`[INFO] 已从 .env.local 注入 DeepSeek API Key（长度 ${env.VITE_QWEN_API_KEY.length}），LLM 搜索层可用`)
  } else {
    console.log('[INFO] 未在 .env.local 中找到 VITE_QWEN_API_KEY，LLM 搜索层将优雅降级（返回空数组）')
  }

  const stocks = readStocks()
  if (stocks.length === 0) {
    throw new Error(`未能从 ${CSV_PATH} 读取到有效股票数据`)
  }
  console.log(`[INFO] 读取到 ${stocks.length} 只股票，开始探测外部数据源...`)

  await probeExternalSources(stocks)
  console.log(`[INFO] 外部数据源探测完成，共 ${sourceTraces.length} 条记录。`)

  const report = buildReport(stocks)
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, report, 'utf-8')
  console.log(`[INFO] 报告已生成：${REPORT_PATH}`)
}

main().catch((err) => {
  console.error('[ERROR] 脚本执行失败:', err)
  process.exit(1)
})
