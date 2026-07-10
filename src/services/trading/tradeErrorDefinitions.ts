/**
 * @module tradeErrorDefinitions
 * @description 交易错误类型定义与错误定义表（PR-7 步骤 7.1 提取）。
 *
 * 从 tradeErrorClassifier.ts 拆分（PR-7 方案 A），负责：
 * - 5 个公共类型定义（ErrorSeverity / TradeErrorType / TradeErrorDef /
 *   DetectedError / ErrorClassificationResult）
 * - 12 类错误定义表（ERROR_DEFINITIONS）
 * - 严重等级扣分权重（SEVERITY_PENALTY）
 *
 * 本模块是 PR-7 拆分的基石层，无外部依赖（纯类型与常量），
 * 被 classifier / detectors / utils 三个子模块共同依赖。
 *
 * 行为等价性：本模块所有内容均为原 tradeErrorClassifier.ts 行 22-202 的 1:1 迁移，
 * 不改任何值、不调整顺序、不重命名。原文件未导出的 ERROR_DEFINITIONS 和
 * SEVERITY_PENALTY 在此导出（供 detectors / classifier 主入口使用）。
 *
 * @see tradeErrorClassifier.ts — 主入口（re-export 本模块类型与常量）
 * @see tradeErrorDetectors.ts — 检测器（import 本模块类型与常量）
 * @see tradeErrorUtils.ts — 辅助函数（import 本模块类型）
 */

// ============================================================
// 类型定义
// ============================================================

/** 错误严重等级 */
export type ErrorSeverity = 'critical' | 'major' | 'minor'

/** 12 类交易错误枚举 */
export enum TradeErrorType {
  /** 追涨杀跌 */
  CHASE_HIGH_SELL_LOW = 'chase_high_sell_low',
  /** 提前止盈 */
  EARLY_PROFIT_TAKING = 'early_profit_taking',
  /** 扛单不止损 */
  NO_STOP_LOSS = 'no_stop_loss',
  /** 逆势加仓 */
  AGAINST_TREND_ADDING = 'against_trend_adding',
  /** 贪鱼尾 */
  GREEDY_TAIL_CHASING = 'greedy_tail_chasing',
  /** 违反计划 */
  PLAN_VIOLATION = 'plan_violation',
  /** 重仓豪赌 */
  HEAVY_GAMBLING = 'heavy_gambling',
  /** 报复性交易 */
  REVENGE_TRADING = 'revenge_trading',
  /** FOMO 入场 */
  FOMO_ENTRY = 'fomo_entry',
  /** 忽视止损 */
  IGNORE_STOP_LOSS = 'ignore_stop_loss',
  /** 犹豫错过 */
  HESITATION_MISS = 'hesitation_miss',
  /** 过度交易 */
  OVERTRADING = 'overtrading',
}

/** 单类错误定义 */
export interface TradeErrorDef {
  /** 错误类型 */
  type: TradeErrorType
  /** 中文名称 */
  name: string
  /** 严重等级 */
  severity: ErrorSeverity
  /** 心理根源 */
  psychologicalRoot: string
  /** 检测描述 */
  detectionDescription: string
}

/** 检测到的错误实例 */
export interface DetectedError {
  /** 错误类型 */
  type: TradeErrorType
  /** 中文名称 */
  name: string
  /** 严重等级 */
  severity: ErrorSeverity
  /** 心理根源 */
  psychologicalRoot: string
  /** 关联的订单 ID 列表 */
  relatedOrderIds: string[]
  /** 发生次数 */
  count: number
  /** 扣分 */
  penalty: number
}

/** 分类结果 */
export interface ErrorClassificationResult {
  /** 检测到的错误列表 */
  errors: DetectedError[]
  /** 纪律评分 0-100 */
  disciplineScore: number
  /** 总扣分 */
  totalPenalty: number
  /** 严重错误数 */
  criticalCount: number
  /** 重要错误数 */
  majorCount: number
  /** 轻微错误数 */
  minorCount: number
  /** 错误总数 */
  totalErrors: number
}

// ============================================================
// 12 类错误定义表
// ============================================================

/**
 * ERROR_DEFINITIONS
 */
export const ERROR_DEFINITIONS: TradeErrorDef[] = [
  {
    type: TradeErrorType.CHASE_HIGH_SELL_LOW,
    name: '追涨杀跌',
    severity: 'critical',
    psychologicalRoot: '贪婪与恐惧交替，缺乏独立判断，从众心理',
    detectionDescription: '买入后价格快速回落（>5%）或卖出后价格快速反弹（>5%），表明入场/出场时机由情绪驱动',
  },
  {
    type: TradeErrorType.EARLY_PROFIT_TAKING,
    name: '提前止盈',
    severity: 'major',
    psychologicalRoot: '对利润的恐惧，害怕回吐浮盈，缺乏持仓信心',
    detectionDescription: '盈利交易中收益率低于预设目标（如 <3%），且卖出后股价继续上涨 >5%',
  },
  {
    type: TradeErrorType.NO_STOP_LOSS,
    name: '扛单不止损',
    severity: 'critical',
    psychologicalRoot: '损失厌恶，不愿承认错误，赌徒心理',
    detectionDescription: '持仓亏损超过 -10% 仍未止损，或日内从盈利转为大幅亏损',
  },
  {
    type: TradeErrorType.AGAINST_TREND_ADDING,
    name: '逆势加仓',
    severity: 'critical',
    psychologicalRoot: '过度自信，想摊平成本，拒绝接受失败',
    detectionDescription: '价格下跌趋势中连续买入加仓，试图摊薄成本',
  },
  {
    type: TradeErrorType.GREEDY_TAIL_CHASING,
    name: '贪鱼尾',
    severity: 'major',
    psychologicalRoot: '贪婪，追求完美，想抓住最后一段利润',
    detectionDescription: '趋势尾端入场，买入后价格即反转，或卖出后价格继续上涨',
  },
  {
    type: TradeErrorType.PLAN_VIOLATION,
    name: '违反计划',
    severity: 'critical',
    psychologicalRoot: '缺乏纪律，自我控制力弱，临场冲动',
    detectionDescription: '交易行为与预设交易计划不一致（如超出仓位限制、未按止损执行）',
  },
  {
    type: TradeErrorType.HEAVY_GAMBLING,
    name: '重仓豪赌',
    severity: 'critical',
    psychologicalRoot: '急功近利，想快速翻本或暴富，风险意识不足',
    detectionDescription: '单笔交易仓位超过总资金的 30% 或集中持仓单一标的',
  },
  {
    type: TradeErrorType.REVENGE_TRADING,
    name: '报复性交易',
    severity: 'major',
    psychologicalRoot: '愤怒、不甘心，想立刻挽回损失',
    detectionDescription: '亏损后短时间内（<30分钟）频繁开仓，试图追回损失',
  },
  {
    type: TradeErrorType.FOMO_ENTRY,
    name: 'FOMO入场',
    severity: 'major',
    psychologicalRoot: '害怕错过，跟风心理，同伴压力',
    detectionDescription: '股价快速拉升时追高入场，缺乏基本面或技术面支撑',
  },
  {
    type: TradeErrorType.IGNORE_STOP_LOSS,
    name: '忽视止损',
    severity: 'critical',
    psychologicalRoot: '侥幸心理，过度自信，不愿接受小损失',
    detectionDescription: '设置了止损但未执行，或从未设置止损位',
  },
  {
    type: TradeErrorType.HESITATION_MISS,
    name: '犹豫错过',
    severity: 'minor',
    psychologicalRoot: '过度谨慎，完美主义，害怕犯错',
    detectionDescription: '明确的交易信号出现后未及时执行，错失良好入场机会',
  },
  {
    type: TradeErrorType.OVERTRADING,
    name: '过度交易',
    severity: 'minor',
    psychologicalRoot: '交易成瘾，无聊，寻求刺激',
    detectionDescription: '单日交易次数超过阈值（如 >10 笔），且多数交易无明显逻辑',
  },
]

// ============================================================
// 扣分权重
// ============================================================

/**
 * SEVERITY_PENALTY
 */
export const SEVERITY_PENALTY: Record<ErrorSeverity, number> = {
  critical: 15,
  major: 8,
  minor: 3,
}
