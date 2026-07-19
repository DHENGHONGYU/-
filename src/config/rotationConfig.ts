/**
 * @doc [V9-DOC-BACK-012, V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
 */
import type {
  MarketStyle,
  RotationAlertLevel,
  RotationFactor,
  RotationScoreBucket,
  RotationSignalGrade,
  RotationSubFactor,
} from '@/data/types'

/** 市场风格周期定义 */
export const MARKET_STYLES: Record<
  MarketStyle,
  {
    name: string
    label: string
    color: string
    gzDesc: string
    valueDesc: string
    lowPosMax: string
    focusPos: string
    cashMin: string
    declineNature: string
  }
> = {
  growth: {
    name: '成长主导期',
    label: '成长',
    color: '#3b82f6',
    gzDesc: '创业板指月涨幅 > 沪深300月涨幅 + 5% 且持续>2周',
    valueDesc: '取消纯低估值埋伏；高景气估值放宽至+3σ；回调多为杀估值',
    lowPosMax: '≤30%',
    focusPos: '25%~35%',
    cashMin: '≥40%',
    declineNature: '杀估值为主，可适度容忍',
  },
  value: {
    name: '价值修复期',
    label: '价值',
    color: '#10b981',
    gzDesc: '沪深300月涨幅 > 创业板指月涨幅 + 5% 且持续>2周',
    valueDesc: '启用原版均值回归σ阈值；正常执行低位分批布局',
    lowPosMax: '≤50%',
    focusPos: '25%~35%',
    cashMin: '≥35%',
    declineNature: '需区分杀估值/杀业绩/杀逻辑',
  },
  balanced: {
    name: '均衡震荡期',
    label: '均衡',
    color: '#8b5cf6',
    gzDesc: '以上均不满足',
    valueDesc: '单板块仓位≤15%；现金≥35%；入场门槛+5分',
    lowPosMax: '≤25%',
    focusPos: '20%~30%',
    cashMin: '≥40%',
    declineNature: '多为杀业绩',
  },
}

/** 五大因子定义 */
export const ROTATION_FACTORS: RotationFactor[] = [
  {
    code: 'F1',
    name: '景气因子',
    weight: 0.4,
    maxScore: 40,
    subCount: 5,
    role: '唯一趋势主导，买入核心依据',
    color: '#ef4444',
    subs: [
      {
        code: 'F1A',
        name: '行业景气合成指数',
        score: 15,
        calcMethod: '参考中采/财新PMI或自建景气模型',
        dataSource: '宏观数据库',
        freq: '月频',
        fullRule: '景气>50且环比上行→15分',
        midRule: '景气40~50或环比持平→8~10分',
        zeroRule: '景气<30或连续下行→0分',
        redLine: '连续两期<45→禁止加仓',
      },
      {
        code: 'F1B',
        name: '板块单季净利润环比',
        score: 8,
        calcMethod: '板块内个股加权平均单季净利润环比增速(%)',
        dataSource: '万得/iFind行业数据',
        freq: '季频',
        fullRule: '环比增速>10%→8分',
        midRule: '环比增速5~10%→5分',
        zeroRule: '环比增速≤0%→0分',
        redLine: '连续两期下行→景气恶化线',
      },
      {
        code: 'F1C',
        name: '行业竞争格局',
        score: 7,
        calcMethod: 'CR3集中度(%) + 趋势(提升/稳定/下降)',
        dataSource: '万得行业集中度数据',
        freq: '季频',
        fullRule: 'CR3>60%且趋势提升→7分',
        midRule: 'CR3 40~60%且提升→5分；>60%但下降→3分',
        zeroRule: 'CR3<30%→0分',
      },
      {
        code: 'F1D',
        name: '板块ROE质量',
        score: 5,
        calcMethod: '板块ROE中位数(%) + 稳定性(连续3期)',
        dataSource: '万得/iFind行业数据',
        freq: '季频',
        fullRule: 'ROE>15%且稳定→5分',
        midRule: 'ROE 12~15%→3分；8~12%→1分',
        zeroRule: 'ROE<8%或>15%但不稳定→0分',
      },
      {
        code: 'F1E',
        name: '前瞻拐点预告',
        score: 5,
        calcMethod: '行业政策/技术/需求拐点信号',
        dataSource: '研报+政策公告',
        freq: '月频',
        fullRule: '明确拐点→5分',
        midRule: '模糊利好→3分',
        zeroRule: '无信号→0分',
        redLine: '入场必要条件之一',
      },
    ],
  },
  {
    code: 'F2',
    name: '资金因子',
    weight: 0.3,
    maxScore: 30,
    subCount: 4,
    role: '确认机构态度，买入共振条件',
    color: '#f59e0b',
    subs: [
      {
        code: 'F2A',
        name: '北向资金持仓变动',
        score: 10,
        calcMethod: '北向资金持仓市值变动(亿元)',
        dataSource: '沪深港通数据',
        freq: '日频→3周平滑',
        fullRule: '强劲净流入→10分',
        midRule: '转向净流入→6分；收窄→3分',
        zeroRule: '净流出→0分',
        redLine: '连续3周净流出→直接归零',
      },
      {
        code: 'F2B',
        name: '主力资金净流入',
        score: 10,
        calcMethod: '大单净流入÷板块流通市值(%)',
        dataSource: '行情软件',
        freq: '日频→3周平滑',
        fullRule: '强劲净流入→10分',
        midRule: '转向净流入→6分；收窄→3分',
        zeroRule: '净流出→0分',
        redLine: '同上',
      },
      {
        code: 'F2C',
        name: '融资余额变动',
        score: 5,
        calcMethod: '融资余额环比增速(%)',
        dataSource: '两融数据',
        freq: '周频',
        fullRule: '环比增速>5%→5分',
        midRule: '环比增速>0%→3分',
        zeroRule: '环比增速≤0%→0分',
        redLine: '连续缩减→资金破位线',
      },
      {
        code: 'F2D',
        name: 'ETF资金流向',
        score: 5,
        calcMethod: '板块ETF净申购/赎回(%)',
        dataSource: 'ETF数据',
        freq: '周频',
        fullRule: '净申购>3%→5分',
        midRule: '净申购>0%→3分',
        zeroRule: '净赎回→0分',
        redLine: '连续赎回→警示',
      },
    ],
  },
  {
    code: 'F3',
    name: '估值因子',
    weight: 0.15,
    maxScore: 15,
    subCount: 3,
    role: '仅做赔率参考，不独立触发买入',
    color: '#3b82f6',
    subs: [
      {
        code: 'F3A',
        name: 'PE/PB近5年历史分位',
        score: 8,
        calcMethod: 'PE/PB在近5年中的百分位(%)',
        dataSource: '万得/东财',
        freq: '月频',
        fullRule: '分位<12%→8分',
        midRule: '12~20%→6分；20~35%→4分；35~50%→2分',
        zeroRule: '分位≥50%→0分',
      },
      {
        code: 'F3B',
        name: '股息率',
        score: 4,
        calcMethod: '近12个月股息÷当前股价(%)',
        dataSource: '行情软件',
        freq: '月频',
        fullRule: '价值≥4.2%/成长≥3.8%→4分',
        midRule: '达标80%→2分',
        zeroRule: '<80%→0分',
        redLine: '绑定分红稳定性',
      },
      {
        code: 'F3C',
        name: '复合回报率预期',
        score: 3,
        calcMethod: '基于景气+估值+ROE的预期年化回报(%)',
        dataSource: '自建模型',
        freq: '季频',
        fullRule: '>20%→3分',
        midRule: '15~20%→2分；10~15%→1分',
        zeroRule: '<10%→0分',
      },
    ],
  },
  {
    code: 'F4',
    name: 'β+相关系数',
    weight: 0.1,
    maxScore: 10,
    subCount: 2,
    role: '风格匹配度，轮动触发条件',
    color: '#8b5cf6',
    subs: [
      {
        code: 'F4A',
        name: 'β系数偏离',
        score: 5,
        calcMethod: '板块相对大盘的敏感度(滚动回归)',
        dataSource: '计算(滚动回归)',
        freq: '周频',
        fullRule: 'β<0.45→5分',
        midRule: '0.45~0.9→3分；0.9~1.9→1分',
        zeroRule: 'β>1.9→0分',
        redLine: 'β>1.9才判定极致高估',
      },
      {
        code: 'F4B',
        name: 'ρ相关系数',
        score: 5,
        calcMethod: '板块与主线板块收益率相关系数',
        dataSource: '计算',
        freq: '月频',
        fullRule: 'ρ<-0.35→5分',
        midRule: '-0.35~0→3分',
        zeroRule: 'ρ>0→0分',
        redLine: '0~-0.3仅观察不建仓',
      },
    ],
  },
  {
    code: 'F5',
    name: '量能因子',
    weight: 0.05,
    maxScore: 5,
    subCount: 2,
    role: '量价确认，过滤脉冲信号',
    color: '#06b6d4',
    subs: [
      {
        code: 'F5A',
        name: '量比(相对60日均量)',
        score: 3,
        calcMethod: '当日成交额÷60日均成交额',
        dataSource: '行情软件',
        freq: '日频',
        fullRule: '0.7~1.3→3分',
        midRule: '<0.45→1分',
        zeroRule: '>2.2→-1分(爆量扣分)；中间→0分',
      },
      {
        code: 'F5B',
        name: '换手率变化',
        score: 2,
        calcMethod: '换手率环比变化方向',
        dataSource: '行情软件',
        freq: '日频',
        fullRule: '上升→2分',
        midRule: '持平→1分',
        zeroRule: '下降→0分',
        redLine: '缩量下跌→警示',
      },
    ],
  },
]

/** 子指标元数据映射（按 code 快速查找） */
export const SUB_FACTOR_MAP = ROTATION_FACTORS.flatMap((f) => f.subs).reduce(
  (map, sub) => {
    map[sub.code] = sub
    return map
  },
  {} as Record<string, RotationSubFactor>,
)

/** 信号分级 */
export const SIGNAL_GRADES: RotationSignalGrade[] = [
  {
    minResonance: 9,
    maxResonance: 10,
    label: '强信号',
    signalType: '右侧共振',
    position: '全仓位运行',
    action: '景气锁仓，维持高仓位',
    color: '#10b981',
    bg: 'bg-emerald-50',
  },
  {
    minResonance: 7,
    maxResonance: 8,
    label: '中强信号',
    signalType: '双共振',
    position: '加至目标仓位',
    action: '分2笔各30%计划仓位加仓',
    color: '#22c55e',
    bg: 'bg-green-50',
  },
  {
    minResonance: 5,
    maxResonance: 6,
    label: '中信号',
    signalType: '双共振',
    position: '首仓试探',
    action: '首仓40%试探，等待确认',
    color: '#3b82f6',
    bg: 'bg-blue-50',
  },
  {
    minResonance: 3,
    maxResonance: 4,
    label: '弱信号',
    signalType: '左侧侦察',
    position: '仅观察',
    action: '仅标注标签，不操作',
    color: '#f59e0b',
    bg: 'bg-amber-50',
  },
  {
    minResonance: 0,
    maxResonance: 2,
    label: '无信号',
    signalType: '无信号',
    position: '空仓',
    action: '不操作，继续观察',
    color: '#9ca3af',
    bg: 'bg-slate-50',
  },
]

/** 综合得分分档 */
export const SCORE_BUCKETS: RotationScoreBucket[] = [
  {
    min: 75,
    label: '聚焦主升区',
    pos: '25%~35%',
    desc: '常态持仓，高景气锁仓',
    color: '#10b981',
  },
  {
    min: 55,
    label: '埋伏建仓区',
    pos: '分批建仓，上限30%',
    desc: '分两笔：首仓60%，回踩5日线加40%',
    color: '#3b82f6',
  },
  {
    min: 35,
    label: '回避区',
    pos: '不建仓，已持仓<10%',
    desc: '等待分值上穿55分埋伏线',
    color: '#f59e0b',
  },
  {
    min: 0,
    label: '冷落观察池',
    pos: '0%~5%',
    desc: '只跟踪，无任何加仓计划',
    color: '#9ca3af',
  },
]

/** 高景气抛售预警 */
export const ALERT_LEVELS: RotationAlertLevel[] = [
  {
    code: 'green',
    name: '常态锁仓',
    color: '#10b981',
    condition: '景气≥58且无两期环比回落 + 拥挤<88%',
    action: '只允许5-10%小幅波段止盈，底仓≥60%',
  },
  {
    code: 'yellow',
    name: '黄色减仓',
    color: '#f59e0b',
    condition: '景气>58且环比↓ + 资金增速<12%',
    action: '总持仓降至≤20%，保留一半以上底仓',
  },
  {
    code: 'orange',
    name: '橙色降仓',
    color: '#f97316',
    condition: '景气<50 + 北向减持',
    action: '仓位压缩≤8%，仅保留龙头底仓',
  },
  {
    code: 'red',
    name: '红色清仓',
    color: '#ef4444',
    condition: '景气<45 + 资金流出',
    action: '全仓清仓，转入达标低位板块',
  },
]

/** 三条禁令 */
export const THREE_BANS = [
  {
    code: 'ban1',
    name: '景气恶化线',
    desc: '景气连续两期<45；前瞻业绩下调占比>30%',
    consequence: '永久停止新增买入/定投补仓',
    color: '#ef4444',
  },
  {
    code: 'ban2',
    name: '资金破位线',
    desc: '周度主力连续3周净流出；成交额<0.45×60日均量',
    consequence: '持仓只择机减仓',
    color: '#f97316',
  },
  {
    code: 'ban3',
    name: '回撤风控线',
    desc: '个股成本回撤>12%；板块指数回撤>15%',
    consequence: '严禁越跌补仓',
    color: '#f59e0b',
  },
]

/** 默认跟踪板块（申万一级） */
export const DEFAULT_SECTORS = [
  { code: 'SW801080', name: '电子', style: 'growth' as MarketStyle },
  { code: 'SW801750', name: '计算机', style: 'growth' as MarketStyle },
  { code: 'SW801770', name: '通信', style: 'growth' as MarketStyle },
  { code: 'SW801890', name: '机械设备', style: 'growth' as MarketStyle },
  { code: 'SW801880', name: '汽车', style: 'growth' as MarketStyle },
  { code: 'SW801730', name: '电力设备', style: 'growth' as MarketStyle },
  { code: 'SW801150', name: '医药生物', style: 'value' as MarketStyle },
  { code: 'SW801030', name: '基础化工', style: 'value' as MarketStyle },
  { code: 'SW801710', name: '建筑材料', style: 'value' as MarketStyle },
  { code: 'SW801720', name: '建筑装饰', style: 'value' as MarketStyle },
  { code: 'SW801170', name: '交通运输', style: 'value' as MarketStyle },
  { code: 'SW801200', name: '商贸零售', style: 'value' as MarketStyle },
  { code: 'SW801210', name: '社会服务', style: 'balanced' as MarketStyle },
  { code: 'SW801140', name: '轻工制造', style: 'balanced' as MarketStyle },
  { code: 'SW801130', name: '纺织服饰', style: 'balanced' as MarketStyle },
]
