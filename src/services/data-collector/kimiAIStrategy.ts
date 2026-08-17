/**
 * @module kimiAIStrategy
 * @description KIMI AI 月度会员采集增强策略 — 配置层。
 *
 * 原则: 不替代数据源，只做数据加工层增强。
 * 定位: 新闻摘要 / 情感分析 / 研报解读 / 异常检测 / 跨维度交叉验证。
 *
 * 使用场景:
 *   1. Dim 05 热点新闻 — 新闻聚合 + 情感分析 + 个性化摘要
 *   2. Dim 08 研报中心 — 研报重点摘要 + 评级变化跟踪
 *   3. 异常检测 — 跨维度数据一致性校验 (如：财务数据 vs 估值变化)
 *   4. 自然语言报告 — 每日/每周采集摘要生成
 *
 * KIMI API 配置:
 *   - Endpoint: https://api.moonshot.cn/v1/chat/completions
 *   - Model: moonshot-v1-8k (免费额度) / moonshot-v1-32k (月度会员)
 *   - 月度会员: 100万 tokens/month (约 1000 次完整调用)
 *
 * 调用策略:
 *   - 每日预算: ~30 次调用 (约 30,000 tokens)
 *   - 优先级: Dim 05 新闻摘要 > Dim 08 研报解读 > 异常检测 > 日报生成
 *   - 批处理: 5-10 条新闻合并为一次调用，节省 token
 *
 * @doc [V9-DOC-DATA-051]
 */

import { KIMI_BASE_URL, getPresetById } from '@/config/llmConfig'

// ============================================================
// KIMI API 配置
// ============================================================

const kimiPreset = getPresetById('kimi')

export const KIMI_CONFIG = {
  /** API 端点 */
  endpoint: `${KIMI_BASE_URL}/v1/chat/completions`,
  /** 默认模型 (月度会员推荐 32k) */
  model: kimiPreset?.defaultModel ?? 'kimi-k2.7-code',
  /** 月度 token 预算 */
  monthlyTokenBudget: 1_000_000,
  /** 每日 token 预算 (约 30 天) */
  dailyTokenBudget: 30_000,
  /** 单次调用最大 token */
  maxTokensPerCall: 4_000,
  /** 重试次数 */
  maxRetries: 2,
  /** 超时 (ms) */
  timeoutMs: 15_000,
} as const

// ============================================================
// 预算管理
// ============================================================

/** 每日调用配额 */
export const KIMI_DAILY_QUOTA = {
  /** 新闻摘要 (Dim 05) — 最高优先级 */
  newsSummary: 10,
  /** 研报解读 (Dim 08) */
  researchDigest: 8,
  /** 异常检测 (跨维度) */
  anomalyDetection: 5,
  /** 日报生成 */
  dailyReport: 3,
  /** 弹性配额 */
  buffer: 4,
  /** 总计 */
  total: 30,
} as const

// ============================================================
// Prompt 模板
// ============================================================

/** Dim 05: 新闻摘要 + 情感分析 */
export const KIMI_PROMPT_NEWS_SUMMARY = `你是一个专业的金融新闻分析师。请对以下股票新闻进行摘要和情感分析：

股票: {symbol}
新闻列表:
{newsList}

请输出 JSON 格式:
{
  "summary": "一句话总结这些新闻的核心主题",
  "sentiment": "positive/neutral/negative",
  "sentimentScore": 0.0-1.0,
  "keyEvents": ["事件1", "事件2"],
  "marketImpact": "low/medium/high",
  "relevanceScore": 0.0-1.0
}`

/** Dim 08: 研报摘要 */
export const KIMI_PROMPT_RESEARCH_DIGEST = `你是一个专业的证券分析师。请对以下研报进行摘要：

股票: {symbol}
研报列表:
{reportList}

请输出 JSON 格式:
{
  "consensusRating": "买入/增持/中性/减持/卖出",
  "avgTargetPrice": 数字,
  "keyArguments": ["论点1", "论点2"],
  "riskFactors": ["风险1", "风险2"],
  "catalystEvents": ["催化剂1"]
}`

/** 异常检测: 跨维度数据一致性 */
export const KIMI_PROMPT_ANOMALY_DETECTION = `你是一个金融数据质量分析师。检查以下跨维度数据是否存在异常：

股票: {symbol}
数据快照:
{dataSnapshot}

请输出 JSON 格式:
{
  "anomalies": [
    {"dimension": "维度代码", "field": "字段名", "description": "异常描述", "severity": "high/medium/low"}
  ],
  "confidence": 0.0-1.0,
  "recommendation": "重新采集/忽略/人工复核"
}`

/** 日报生成 */
export const KIMI_PROMPT_DAILY_REPORT = `你是一个AI投研助手。基于以下采集数据，生成今日总结：

股票: {symbol}
采集日期: {date}
数据摘要:
{dataSummary}

请输出 JSON 格式:
{
  "title": "日报标题",
  "summary": "2-3句话核心总结",
  "keyChanges": [{"dimension": "维度", "change": "变化描述", "impact": "positive/negative/neutral"}],
  "attentionPoints": ["需要关注的点"],
  "nextActions": ["建议后续行动"]
}`

// ============================================================
// 调用优先级 (数值越小越优先)
// ============================================================

export const KIMI_TASK_PRIORITY: Record<string, number> = {
  '05': 1,   // 热点新闻 — 最高优先级
  '08': 2,   // 研报中心
  anomaly: 3, // 异常检测
  report: 4,  // 日报生成
}

// ============================================================
// 默认导出
// ============================================================

export default {
  KIMI_CONFIG,
  KIMI_DAILY_QUOTA,
  KIMI_PROMPT_NEWS_SUMMARY,
  KIMI_PROMPT_RESEARCH_DIGEST,
  KIMI_PROMPT_ANOMALY_DETECTION,
  KIMI_PROMPT_DAILY_REPORT,
  KIMI_TASK_PRIORITY,
}