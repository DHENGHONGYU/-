// 行业板块分析 — 整合4大SKILL模型 + 申万3级行业映射
// SKILL-N(六维度板块) + SKILL-C(四维加权) + SKILL-A(双维度量表)
// ============================================================

/** SKILL-C 四维加权评分 */
export interface SkillCScore {
  techAdvancement: { score: number; weight: number; reason: string }
  structuralScarcity: { score: number; weight: number; reason: string }
  localizationBarrier: { score: number; weight: number; reason: string }
  overtakingPotential: { score: number; weight: number; reason: string }
  composite: number
  grade: string
}

/** SKILL-A 双维度量表 */
export interface SkillAScore {
  coreValue: { score: number; reason: string }
  scarcityValue: { score: number; reason: string }
  matrixPosition: string
}

/** SKILL-N 六维度板块分析 */
export interface SkillNScore {
  rotationSignal: { score: number; reason: string }
  policyEnv: { score: number; reason: string }
  competition: { score: number; reason: string }
  techMigration: { score: number; reason: string }
  downstream: { score: number; reason: string }
  fundValuation: { score: number; reason: string }
  composite: number
}

/** 热门细分赛道 */
export interface SubTrack {
  name: string
  trend: string
  leaders: string[]
}

/** 整合 SKILL 行业分析数据结构 */
export interface SectorSkillAnalysis {
  code: string
  name: string
  swLevel1: string
  swLevel2: string
  swLevel3: string[]
  keywords: string[]

  planAlignment: { score: number; reason: string }
  policySupport: { score: number; reason: string }
  usChinaParity: { score: number; reason: string }

  skillC: SkillCScore
  skillA: SkillAScore
  skillN: SkillNScore

  composite: number
  isCore: boolean
  recommendation: string
  positionPct: string

  subTracks: SubTrack[]
  keyStocks?: Array<{ symbol: string; name: string }>
  relatedConcepts: string[]
}

// ========== 15大热门赛道整合分析数据 ==========
export const SECTOR_SKILL_ANALYSIS: SectorSkillAnalysis[] = [
  // ───────────────── AI大模型 ─────────────────
  {
    code: "AI",
    name: "AI大模型与算力",
    swLevel1: "计算机",
    swLevel2: "软件开发",
    swLevel3: ["垂直应用软件", "横向通用软件", "IT服务"],
    keywords: ["大模型", "AI芯片", "算力", "AIGC", "智算中心"],

    // 三维度评分 (十五五规划导向)
    planAlignment: { score: 5.0, reason: "十五五纲要明确列为战略必争领域，北京/上海/深圳专项规划密集出台" },
    policySupport: { score: 5.0, reason: "大基金三期3440亿重点投向AI芯片，各地智算中心补贴力度空前" },
    usChinaParity: { score: 4.0, reason: "应用层全球60%+份额(DeepSeek等)，基础模型距GPT-4o约6-9个月差距" },

    // SKILL-C 四维加权
    skillC: {
      techAdvancement: { score: 4.5, weight: 0.30, reason: "Transformer架构持续迭代，物理AI(具身智能)处于范式转换初期" },
      structuralScarcity: { score: 4.0, weight: 0.25, reason: "CUDA生态锁定效应强，高端AI芯片(≥H100)进口受限" },
      localizationBarrier: { score: 4.5, weight: 0.25, reason: "国产AI芯片(昇腾/寒武纪)快速迭代，推理场景已实现替代" },
      overtakingPotential: { score: 4.5, weight: 0.20, reason: "DeepSeek以低成本实现高性能，证明非对称路径可行" },
      composite: 4.38,
      grade: "A级",
    },

    // SKILL-A 双维度量表
    skillA: {
      coreValue: { score: 4.8, reason: "定义第四次工业革命核心底座，与物理AI深度耦合" },
      scarcityValue: { score: 4.5, reason: "复合人才全球稀缺(不足5000人)，数据资源独占性强" },
      matrixPosition: "⭐战略必争",
    },

    // SKILL-N 六维度板块分析
    skillN: {
      rotationSignal: { score: 4.5, reason: "AI主题基金持续净流入，板块成交量维持高位" },
      policyEnv: { score: 5.0, reason: "国家级战略+地方配套政策密集，政策综合得分>15" },
      competition: { score: 3.5, reason: "GPU设计差距2-3代，但应用层和推理芯片快速追赶" },
      techMigration: { score: 5.0, reason: "从数据驱动到物理规律驱动的范式跃迁刚起步" },
      downstream: { score: 4.5, reason: "企业AI渗透率<15%，巨大增量空间" },
      fundValuation: { score: 4.0, reason: "部分标的估值偏高，但龙头仍有安全边际" },
      composite: 4.42,
    },

    // 综合判定
    composite: 4.52,
    isCore: true,
    recommendation: "战略超配",
    positionPct: "15-20%",

    // 热门细分赛道推荐
    subTracks: [
      { name: "AI推理芯片", trend: "🔥热门", leaders: ["寒武纪", "海光信息"] },
      { name: "大模型应用", trend: "🔥热门", leaders: ["科大讯飞", "拓尔思"] },
      { name: "智算中心", trend: "📈上升", leaders: ["浪潮信息", "中科曙光"] },
      { name: "端侧AI", trend: "📈上升", leaders: ["瑞芯微", "全志科技"] },
    ],

    relatedConcepts: ["AI算力", "大模型", "智算中心", "芯片设计"],
  },

  // ───────────────── 半导体/集成电路 ─────────────────
  {
    code: "IC",
    name: "半导体与集成电路",
    swLevel1: "电子",
    swLevel2: "半导体",
    swLevel3: ["集成电路制造", "半导体设备", "半导体材料", "模拟芯片设计", "数字芯片设计"],
    keywords: ["芯片", "晶圆", "EDA", "光刻机", "国产替代"],

    planAlignment: { score: 5.0, reason: "大基金三期+国家集成电路纲要，优先级最高的战略产业" },
    policySupport: { score: 5.0, reason: "大基金三期3440亿，设备/材料税收优惠延续" },
    usChinaParity: { score: 3.0, reason: "消费芯片自主率<10%，设备材料更依赖进口" },

    skillC: {
      techAdvancement: { score: 3.5, weight: 0.30, reason: "先进制程差距2-3代(7nm vs 3nm)，但成熟制程(28nm+)已自主可控" },
      structuralScarcity: { score: 5.0, weight: 0.25, reason: "光刻机/EDA/高端材料100%依赖进口，禁运即瘫痪" },
      localizationBarrier: { score: 3.0, weight: 0.25, reason: "设备国产化率<20%，材料<15%，替代进程漫长" },
      overtakingPotential: { score: 3.5, weight: 0.20, reason: "Chiplet/先进封装为换道超车提供可能" },
      composite: 3.73,
      grade: "B+级",
    },

    skillA: {
      coreValue: { score: 5.0, reason: "所有高科技产业的'粮食'，产业链最核心环节" },
      scarcityValue: { score: 5.0, reason: "ASML光刻机全球唯一，高端EDA三家垄断" },
      matrixPosition: "⭐战略必争",
    },

    skillN: {
      rotationSignal: { score: 4.0, reason: "周期底部反弹+国产替代主题，资金持续关注" },
      policyEnv: { score: 5.0, reason: "最高层级政策支持，实体清单催化加速" },
      competition: { score: 2.5, reason: "设备和EDA差距显著，设计领域快速追赶" },
      techMigration: { score: 3.5, reason: "先进制程受限，Chiplet和成熟制程放量" },
      downstream: { score: 4.0, reason: "AI/汽车/IoT驱动需求持续增长" },
      fundValuation: { score: 3.5, reason: "周期底部估值合理，部分设备标的略贵" },
      composite: 3.75,
    },

    composite: 4.15,
    isCore: false,
    recommendation: "重点配置",
    positionPct: "10-15%",

    subTracks: [
      { name: "半导体设备", trend: "🔥热门", leaders: ["北方华创", "中微公司"] },
      { name: "AI芯片", trend: "🔥热门", leaders: ["寒武纪", "海光信息"] },
      { name: "存储芯片", trend: "📈上升", leaders: ["兆易创新", "长江存储"] },
      { name: "半导体材料", trend: "📈上升", leaders: ["沪硅产业", "安集科技"] },
    ],

    relatedConcepts: ["半导体设备", "芯片设计", "晶圆代工", "EDA"],
  },

  // ───────────────── 新能源(光伏风电) ─────────────────
  {
    code: "NEV_PV",
    name: "新能源(光伏风电)",
    swLevel1: "电力设备",
    swLevel2: "光伏设备",
    swLevel3: ["光伏电池组件", "逆变器", "风电整机", "储能系统"],
    keywords: ["光伏", "风电", "储能", "新能源发电", "绿电"],

    planAlignment: { score: 4.5, reason: "双碳目标核心支撑，十五五新能源装机目标持续上调" },
    policySupport: { score: 4.0, reason: "绿电交易机制完善，储能强制配储政策" },
    usChinaParity: { score: 5.0, reason: "光伏组件全球80%+份额，风电装机全球第一" },

    skillC: {
      techAdvancement: { score: 4.0, weight: 0.30, reason: "TOPCon/HJT/TBC技术路线并行，钙钛矿处于中试阶段" },
      structuralScarcity: { score: 4.5, weight: 0.25, reason: "多晶硅/硅片/组件全产业链垄断，规模壁垒极高" },
      localizationBarrier: { score: 5.0, weight: 0.25, reason: "全产业链100%国产化，从追赶者变为定义者" },
      overtakingPotential: { score: 4.0, weight: 0.20, reason: "钙钛矿叠层电池可能带来效率跃迁" },
      composite: 4.38,
      grade: "A级",
    },

    skillA: {
      coreValue: { score: 4.5, reason: "双碳战略核心支撑，能源安全的关键" },
      scarcityValue: { score: 4.5, reason: "中国主导全球供应链，产能/成本优势难以复制" },
      matrixPosition: "⭐战略必争",
    },

    skillN: {
      rotationSignal: { score: 3.5, reason: "产能过剩导致价格下行，板块承压" },
      policyEnv: { score: 4.5, reason: "双碳目标刚性，政策支持力度大" },
      competition: { score: 5.0, reason: "全球绝对主导，CR5集中度持续提升" },
      techMigration: { score: 4.0, reason: "技术迭代快，路线收敛中" },
      downstream: { score: 4.5, reason: "全球能源转型+国内新增装机双驱动" },
      fundValuation: { score: 3.0, reason: "产能过剩压制盈利，估值处于历史低位" },
      composite: 4.08,
    },

    composite: 4.45,
    isCore: true,
    recommendation: "战略超配",
    positionPct: "15-20%",

    subTracks: [
      { name: "光伏组件", trend: "📈上升", leaders: ["隆基绿能", "晶科能源"] },
      { name: "储能系统", trend: "🔥热门", leaders: ["宁德时代", "阳光电源"] },
      { name: "逆变器", trend: "📈上升", leaders: ["阳光电源", "德业股份"] },
      { name: "风电整机", trend: "📈上升", leaders: ["金风科技", "明阳智能"] },
    ],

    relatedConcepts: ["光伏", "储能", "风电", "逆变器"],
  },

  // ───────────────── 新能源汽车 ─────────────────
  {
    code: "NEV",
    name: "新能源汽车",
    swLevel1: "汽车",
    swLevel2: "乘用车",
    swLevel3: ["电动乘用车", "汽车零部件", "动力电池", "智能驾驶"],
    keywords: ["电动车", "锂电池", "智能驾驶", "充换电"],

    planAlignment: { score: 4.5, reason: "十五五新能源汽车渗透率目标60%+，政策持续加码" },
    policySupport: { score: 4.5, reason: "购置税减免延续，充电基础设施补贴，双积分政策" },
    usChinaParity: { score: 5.0, reason: "全球60%+市场份额，比亚迪销量超Tesla" },

    skillC: {
      techAdvancement: { score: 4.0, weight: 0.30, reason: "固态电池/高压快充处于工程验证阶段，智驾L2+普及" },
      structuralScarcity: { score: 4.0, weight: 0.25, reason: "锂电池全产业链垄断，但固态电池格局未定" },
      localizationBarrier: { score: 5.0, weight: 0.25, reason: "动力电池/电机/电控100%国产化" },
      overtakingPotential: { score: 4.5, weight: 0.20, reason: "智能驾驶+车路协同可能实现换道超车" },
      composite: 4.33,
      grade: "A级",
    },

    skillA: {
      coreValue: { score: 4.5, reason: "万亿级产业，能源转型+智能出行的交汇点" },
      scarcityValue: { score: 4.5, reason: "全产业链能力全球唯一，规模壁垒极高" },
      matrixPosition: "⭐战略必争",
    },

    skillN: {
      rotationSignal: { score: 4.0, reason: "智能化主题接力电动化，资金持续流入" },
      policyEnv: { score: 4.5, reason: "双碳+能源安全双驱动，政策确定性强" },
      competition: { score: 5.0, reason: "中国品牌全球份额持续提升" },
      techMigration: { score: 4.5, reason: "固态电池+智能驾驶处于技术跃迁期" },
      downstream: { score: 4.5, reason: "国内渗透率刚过半，海外空间巨大" },
      fundValuation: { score: 3.5, reason: "整车竞争激烈，电池/零部件估值合理" },
      composite: 4.33,
    },

    composite: 4.55,
    isCore: true,
    recommendation: "战略超配",
    positionPct: "15-20%",

    subTracks: [
      { name: "动力电池", trend: "🔥热门", leaders: ["宁德时代", "比亚迪"] },
      { name: "智能驾驶", trend: "🔥热门", leaders: ["德赛西威", "伯特利"] },
      { name: "固态电池", trend: "📈上升", leaders: ["赣锋锂业", "国轩高科"] },
      { name: "汽车零部件", trend: "📈上升", leaders: ["拓普集团", "三花智控"] },
    ],

    relatedConcepts: ["锂电池", "智能驾驶", "固态电池", "充换电"],
  },

  // ───────────────── 机器人/具身智能 ─────────────────
  {
    code: "ROBOT",
    name: "机器人与具身智能",
    swLevel1: "机械设备",
    swLevel2: "自动化设备",
    swLevel3: ["工业机器人", "服务机器人", "人形机器人", "减速器", "伺服系统"],
    keywords: ["人形机器人", "具身智能", "减速器", "伺服电机", "机器视觉"],

    planAlignment: { score: 5.0, reason: "北京/上海密集发布具身智能三年行动计划，列为未来产业重点" },
    policySupport: { score: 4.5, reason: "北京100亿、上海等产业基金密集落地" },
    usChinaParity: { score: 4.0, reason: "工业机器人存量全球第一(43%)，人形机器人紧随Tesla" },

    skillC: {
      techAdvancement: { score: 4.5, weight: 0.30, reason: "大模型+机器人融合(具身智能)处于范式转换初期" },
      structuralScarcity: { score: 4.0, weight: 0.25, reason: "高精度减速器/力矩传感器仍依赖进口" },
      localizationBarrier: { score: 4.0, weight: 0.25, reason: "中低端机器人国产化率高，高端减速器追赶中" },
      overtakingPotential: { score: 4.5, weight: 0.20, reason: "AI+制造优势结合，场景落地速度全球领先" },
      composite: 4.25,
      grade: "A级",
    },

    skillA: {
      coreValue: { score: 4.5, reason: "物理AI的终极载体，劳动力替代+产业升级核心" },
      scarcityValue: { score: 4.0, reason: "复合人才稀缺(机电+AI+控制)，核心零部件仍卡脖子" },
      matrixPosition: "⭐战略必争",
    },

    skillN: {
      rotationSignal: { score: 4.5, reason: "人形机器人主题热度高，资金持续涌入" },
      policyEnv: { score: 4.5, reason: "地方政策密集，产业基金纷纷设立" },
      competition: { score: 3.5, reason: "Tesla Optimus领先，但国内供应链完整" },
      techMigration: { score: 5.0, reason: "具身智能处于技术萌芽期，范式转换机会" },
      downstream: { score: 4.0, reason: "工业/服务/家庭场景广阔，渗透率极低" },
      fundValuation: { score: 3.5, reason: "主题溢价较高，需精选真正有技术的标的" },
      composite: 4.17,
    },

    composite: 4.43,
    isCore: true,
    recommendation: "战略超配",
    positionPct: "15-20%",

    subTracks: [
      { name: "人形机器人", trend: "🔥热门", leaders: ["绿的谐波", "三花智控"] },
      { name: "精密减速器", trend: "🔥热门", leaders: ["绿的谐波", "双环传动"] },
      { name: "机器视觉", trend: "📈上升", leaders: ["奥普特", "凌云光"] },
      { name: "伺服系统", trend: "📈上升", leaders: ["汇川技术", "禾川科技"] },
    ],

    relatedConcepts: ["减速器", "伺服系统", "机器视觉", "人形机器人"],
  },

  // ───────────────── 量子科技 ─────────────────
  {
    code: "QUANTUM",
    name: "量子科技",
    swLevel1: "通信",
    swLevel2: "通信设备",
    swLevel3: ["量子通信设备", "量子计算", "量子精密测量"],
    keywords: ["量子通信", "量子计算", "量子密钥", "量子精密测量"],

    planAlignment: { score: 5.0, reason: "十五五纲要列为未来产业重点，合肥国家实验室核心" },
    policySupport: { score: 4.0, reason: "国家量子专项持续投入，合肥/北京产业集聚区" },
    usChinaParity: { score: 4.0, reason: "量子通信实用化全球领先，量子计算并跑" },

    skillC: {
      techAdvancement: { score: 4.0, weight: 0.30, reason: "量子通信已商用，量子计算处于NISQ时代向容错量子计算过渡" },
      structuralScarcity: { score: 5.0, weight: 0.25, reason: "量子比特制备/测控设备极度稀缺" },
      localizationBarrier: { score: 4.5, weight: 0.25, reason: "量子通信全产业链自主，量子计算部分依赖" },
      overtakingPotential: { score: 4.5, weight: 0.20, reason: "光量子路线中国领先，超导路线并跑" },
      composite: 4.38,
      grade: "A级",
    },

    skillA: {
      coreValue: { score: 4.5, reason: "信息安全终极解决方案，下一代计算范式" },
      scarcityValue: { score: 5.0, reason: "量子物理学家全球极度稀缺，设备几乎无市场化供应" },
      matrixPosition: "⭐战略必争",
    },

    skillN: {
      rotationSignal: { score: 3.5, reason: "主题性机会为主，成交量波动大" },
      policyEnv: { score: 4.5, reason: "国家意志驱动，长期投入确定" },
      competition: { score: 4.0, reason: "量子通信领先，量子计算并跑" },
      techMigration: { score: 4.5, reason: "实用化早期，技术路线快速迭代" },
      downstream: { score: 3.0, reason: "市场规模仍小，商业化处于初期" },
      fundValuation: { score: 3.0, reason: "概念股居多，需甄别真正有技术的公司" },
      composite: 3.75,
    },

    composite: 4.43,
    isCore: true,
    recommendation: "战略超配",
    positionPct: "15-20%",

    subTracks: [
      { name: "量子通信", trend: "🔥热门", leaders: ["国盾量子", "神州信息"] },
      { name: "量子计算", trend: "📈上升", leaders: ["本源量子(未上市)", "国盾量子"] },
      { name: "抗量子密码", trend: "📈上升", leaders: ["电科网安", "格尔软件"] },
    ],

    relatedConcepts: ["量子通信", "量子计算", "信息安全"],
  },

  // ───────────────── 低空经济 ─────────────────
  {
    code: "LOWALT",
    name: "低空经济",
    swLevel1: "国防军工",
    swLevel2: "航空装备",
    swLevel3: ["无人机", "eVTOL", "通航设备", "低空基础设施"],
    keywords: ["低空经济", "eVTOL", "无人机", "通航", "空中交通"],

    planAlignment: { score: 4.5, reason: "2024年首次写入政府工作报告，十五五重点培育" },
    policySupport: { score: 4.5, reason: "深圳/合肥/广州先行示范区，空域管理改革试点" },
    usChinaParity: { score: 4.0, reason: "无人机全球70%+份额，eVTOL并跑" },

    skillC: {
      techAdvancement: { score: 4.0, weight: 0.30, reason: "eVTOL处于适航认证阶段，固态电池+轻量化材料突破" },
      structuralScarcity: { score: 3.5, weight: 0.25, reason: "低空基础设施(起降场/空管)刚起步" },
      localizationBarrier: { score: 4.5, weight: 0.25, reason: "无人机全产业链自主，eVTOL电机/电控领先" },
      overtakingPotential: { score: 4.0, weight: 0.20, reason: "城市空中交通(UAM)全球同步起步" },
      composite: 4.00,
      grade: "A-级",
    },

    skillA: {
      coreValue: { score: 4.0, reason: "万亿级新质生产力赛道，交通革命新维度" },
      scarcityValue: { score: 3.5, reason: "适航认证周期长，先发优势明显" },
      matrixPosition: "重点配置",
    },

    skillN: {
      rotationSignal: { score: 4.0, reason: "政策催化密集，主题投资热度高" },
      policyEnv: { score: 4.5, reason: "从中央到地方政策快速落地" },
      competition: { score: 4.0, reason: "无人机绝对领先，eVTOL并跑" },
      techMigration: { score: 4.0, reason: "适航标准逐步明确，技术路线收敛中" },
      downstream: { score: 3.5, reason: "物流/巡检/载人场景逐步落地" },
      fundValuation: { score: 3.0, reason: "主题炒作成分大，需谨慎甄别" },
      composite: 3.83,
    },

    composite: 4.15,
    isCore: false,
    recommendation: "重点配置",
    positionPct: "10-15%",

    subTracks: [
      { name: "eVTOL整机", trend: "🔥热门", leaders: ["亿航智能", "峰飞航空(未上市)"] },
      { name: "无人机", trend: "📈上升", leaders: ["大疆(未上市)", "航天彩虹"] },
      { name: "低空基建", trend: "📈上升", leaders: ["深城交", "莱斯信息"] },
      { name: "碳纤维", trend: "📈上升", leaders: ["光威复材", "中复神鹰"] },
    ],

    relatedConcepts: ["eVTOL", "无人机", "碳纤维", "低空基建"],
  },

  // ───────────────── 航空航天 ─────────────────
  {
    code: "AERO",
    name: "航空航天",
    swLevel1: "国防军工",
    swLevel2: "航空装备",
    swLevel3: ["航空整机", "航空发动机", "航天装备", "卫星应用"],
    keywords: ["大飞机", "C919", "航空发动机", "卫星互联网", "商业航天"],

    planAlignment: { score: 4.5, reason: "C919产业化+商业航天列入十五五，战略高度" },
    policySupport: { score: 4.0, reason: "大飞机专项+商业航天发射许可放开" },
    usChinaParity: { score: 3.5, reason: "C919刚交付，商业航天追赶SpaceX" },

    skillC: {
      techAdvancement: { score: 3.5, weight: 0.30, reason: "航发差距1-2代，商业航天追赶中" },
      structuralScarcity: { score: 4.5, weight: 0.25, reason: "高温合金/单晶叶片等核心材料壁垒极高" },
      localizationBarrier: { score: 3.0, weight: 0.25, reason: "航发核心机仍依赖进口技术" },
      overtakingPotential: { score: 3.5, weight: 0.20, reason: "商业航天有望实现差异化竞争" },
      composite: 3.63,
      grade: "B+级",
    },

    skillA: {
      coreValue: { score: 4.0, reason: "国家安全+高端制造能力的象征" },
      scarcityValue: { score: 4.5, reason: "能独立研制大飞机的国家屈指可数" },
      matrixPosition: "重点配置",
    },

    skillN: {
      rotationSignal: { score: 3.5, reason: "C919订单催化，商业航天发射密集" },
      policyEnv: { score: 4.5, reason: "国家战略意志，长期投入不变" },
      competition: { score: 3.0, reason: "Boeing/Airbus双寡头，SpaceX领先" },
      techMigration: { score: 3.5, reason: "C919进入交付爬坡期，可复用火箭研发中" },
      downstream: { score: 4.0, reason: "国产替代+卫星互联网空间巨大" },
      fundValuation: { score: 3.5, reason: "军工估值合理，民机板块溢价" },
      composite: 3.67,
    },

    composite: 4.03,
    isCore: false,
    recommendation: "重点配置",
    positionPct: "10-15%",

    subTracks: [
      { name: "C919产业链", trend: "📈上升", leaders: ["中航沈飞", "中航西飞"] },
      { name: "航空发动机", trend: "📈上升", leaders: ["航发动力", "航发控制"] },
      { name: "卫星互联网", trend: "🔥热门", leaders: ["中国卫星", "航天电子"] },
      { name: "商业航天", trend: "📈上升", leaders: ["中天火箭", "航天彩虹"] },
    ],

    relatedConcepts: ["大飞机", "航空发动机", "卫星互联网", "商业航天"],
  },

  // ───────────────── 生物医药 ─────────────────
  {
    code: "BIOTECH",
    name: "生物医药",
    swLevel1: "医药生物",
    swLevel2: "化学制药",
    swLevel3: ["创新药", "CXO", "疫苗", "血制品", "医疗器械"],
    keywords: ["创新药", "CXO", "疫苗", "基因治疗", "医疗器械"],

    planAlignment: { score: 4.5, reason: "健康中国2030核心，创新药审评加速" },
    policySupport: { score: 4.0, reason: "医保谈判常态化，创新药单独支付政策" },
    usChinaParity: { score: 3.0, reason: "CXO全球龙头，原创药差距仍大" },

    skillC: {
      techAdvancement: { score: 3.5, weight: 0.30, reason: "ADC/双抗/细胞治疗快速追赶，基因治疗起步" },
      structuralScarcity: { score: 4.0, weight: 0.25, reason: "临床资源/审评能力/制造能力是核心壁垒" },
      localizationBarrier: { score: 3.5, weight: 0.25, reason: "CXO全球领先，但原创靶点少" },
      overtakingPotential: { score: 3.5, weight: 0.20, reason: "AI+药物发现可能缩短研发周期" },
      composite: 3.63,
      grade: "B+级",
    },

    skillA: {
      coreValue: { score: 4.0, reason: "民生刚需+战略安全(疫苗/抗生素)" },
      scarcityValue: { score: 3.5, reason: "临床数据资源有价值，但全球化竞争充分" },
      matrixPosition: "标准配置",
    },

    skillN: {
      rotationSignal: { score: 3.0, reason: "板块持续低迷，资金流出" },
      policyEnv: { score: 4.0, reason: "支持创新药，但医保控费压力大" },
      competition: { score: 3.0, reason: "CXO受地缘政治影响，创新药同质化严重" },
      techMigration: { score: 3.5, reason: "ADC/双抗/细胞治疗快速迭代" },
      downstream: { score: 4.0, reason: "老龄化+消费升级，需求刚性增长" },
      fundValuation: { score: 3.5, reason: "板块估值处于历史低位，配置价值显现" },
      composite: 3.50,
    },

    composite: 3.82,
    isCore: false,
    recommendation: "标准配置",
    positionPct: "5-10%",

    subTracks: [
      { name: "创新药", trend: "📈上升", leaders: ["百济神州", "信达生物"] },
      { name: "CXO", trend: "📉低迷", leaders: ["药明康德", "康龙化成"] },
      { name: "医疗器械", trend: "📈上升", leaders: ["迈瑞医疗", "联影医疗"] },
      { name: "疫苗", trend: "📈上升", leaders: ["智飞生物", "沃森生物"] },
    ],

    relatedConcepts: ["创新药", "CXO", "医疗器械", "疫苗"],
  },

  // ───────────────── 新材料 ─────────────────
  {
    code: "MAT",
    name: "新材料",
    swLevel1: "基础化工",
    swLevel2: "化学制品",
    swLevel3: ["碳纤维", "稀土功能材料", "电子化学品", "先进陶瓷", "高温合金"],
    keywords: ["碳纤维", "稀土", "电子化学品", "先进陶瓷", "高温合金"],

    planAlignment: { score: 4.0, reason: "十五五列为战略性新兴产业，多部委联合支持" },
    policySupport: { score: 4.0, reason: "新材料首批次应用保险补偿政策" },
    usChinaParity: { score: 4.0, reason: "稀土绝对主导，碳纤维/高温合金追赶中" },

    skillC: {
      techAdvancement: { score: 3.5, weight: 0.30, reason: "T1000级碳纤维/高纯度电子气体突破中" },
      structuralScarcity: { score: 4.5, weight: 0.25, reason: "稀土冶炼分离全球垄断(91%)" },
      localizationBarrier: { score: 4.0, weight: 0.25, reason: "中低端材料国产化率高，高端追赶" },
      overtakingPotential: { score: 3.5, weight: 0.20, reason: "应用场景驱动(新能源/半导体)加速迭代" },
      composite: 3.88,
      grade: "A-级",
    },

    skillA: {
      coreValue: { score: 4.0, reason: "制造业升级的基础，'工业的粮食'" },
      scarcityValue: { score: 4.5, reason: "稀土/高性能纤维等具有资源/工艺独占性" },
      matrixPosition: "重点配置",
    },

    skillN: {
      rotationSignal: { score: 3.0, reason: "板块分散，主题性不强" },
      policyEnv: { score: 4.0, reason: "政策支持明确，但落地速度一般" },
      competition: { score: 4.0, reason: "稀土绝对主导，其他细分领域竞争激烈" },
      techMigration: { score: 3.5, reason: "材料迭代周期长，突破依赖下游需求牵引" },
      downstream: { score: 4.0, reason: "新能源/半导体/航空航天驱动需求" },
      fundValuation: { score: 3.5, reason: "细分领域龙头估值合理" },
      composite: 3.67,
    },

    composite: 4.00,
    isCore: false,
    recommendation: "标准配置",
    positionPct: "5-10%",

    subTracks: [
      { name: "碳纤维", trend: "📈上升", leaders: ["光威复材", "中复神鹰"] },
      { name: "稀土磁材", trend: "📈上升", leaders: ["北方稀土", "金力永磁"] },
      { name: "电子化学品", trend: "📈上升", leaders: ["晶瑞电材", "江化微"] },
      { name: "高温合金", trend: "📈上升", leaders: ["抚顺特钢", "钢研高纳"] },
    ],

    relatedConcepts: ["碳纤维", "稀土", "电子化学品", "高温合金"],
  },

  // ───────────────── 数字经济/SaaS ─────────────────
  {
    code: "DIGITAL",
    name: "数字经济与SaaS",
    swLevel1: "计算机",
    swLevel2: "软件开发",
    swLevel3: ["企业管理软件", "工业软件", "金融IT", "网络安全"],
    keywords: ["SaaS", "工业软件", "云计算", "网络安全", "信创"],

    planAlignment: { score: 4.0, reason: "数字中国建设整体布局规划，数据要素市场化" },
    policySupport: { score: 4.0, reason: "信创采购政策+数据要素政策密集出台" },
    usChinaParity: { score: 3.5, reason: "应用软件追赶快，工业软件/基础软件差距大" },

    skillC: {
      techAdvancement: { score: 3.5, weight: 0.30, reason: "AI+SaaS融合加速，工业软件追赶中" },
      structuralScarcity: { score: 3.5, weight: 0.25, reason: "客户粘性和数据壁垒构建中" },
      localizationBarrier: { score: 4.0, weight: 0.25, reason: "信创政策推动替代，但生态差距大" },
      overtakingPotential: { score: 4.0, weight: 0.20, reason: "AI Agent可能重构SaaS格局" },
      composite: 3.73,
      grade: "B+级",
    },

    skillA: {
      coreValue: { score: 3.5, reason: "产业数字化底座，但可被替代性较高" },
      scarcityValue: { score: 3.5, reason: "人才充裕，竞争充分" },
      matrixPosition: "标准配置",
    },

    skillN: {
      rotationSignal: { score: 3.0, reason: "板块整体低迷，AI主题局部活跃" },
      policyEnv: { score: 4.0, reason: "信创+数据要素双政策驱动" },
      competition: { score: 3.5, reason: "国内竞争充分，国际巨头压制" },
      techMigration: { score: 4.0, reason: "AI Agent+云原生重构行业" },
      downstream: { score: 4.0, reason: "企业数字化渗透率持续提升" },
      fundValuation: { score: 3.5, reason: "板块估值处于历史低位" },
      composite: 3.67,
    },

    composite: 3.80,
    isCore: false,
    recommendation: "标准配置",
    positionPct: "5-10%",

    subTracks: [
      { name: "工业软件", trend: "📈上升", leaders: ["中望软件", "概伦电子"] },
      { name: "企业管理SaaS", trend: "📈上升", leaders: ["用友网络", "金山办公"] },
      { name: "金融IT", trend: "📈上升", leaders: ["恒生电子", "同花顺"] },
      { name: "网络安全", trend: "📈上升", leaders: ["奇安信", "深信服"] },
    ],

    relatedConcepts: ["SaaS", "工业软件", "信创", "网络安全"],
  },

  // ───────────────── 氢能 ─────────────────
  {
    code: "H2",
    name: "氢能与燃料电池",
    swLevel1: "电力设备",
    swLevel2: "其他电源设备",
    swLevel3: ["燃料电池", "氢能制备", "氢储运", "加氢站"],
    keywords: ["氢能", "燃料电池", "绿氢", "电解槽", "加氢站"],

    planAlignment: { score: 4.5, reason: "十五五氢能产业规划即将出台，五大示范城市群" },
    policySupport: { score: 4.0, reason: "燃料电池汽车示范应用补贴，绿氢项目审批加速" },
    usChinaParity: { score: 3.5, reason: "电解槽产能全球60%+，但核心技术(质子交换膜)仍依赖进口" },

    skillC: {
      techAdvancement: { score: 3.5, weight: 0.30, reason: "碱性电解槽成熟，PEM/AEM/SOEC处于产业化早期" },
      structuralScarcity: { score: 3.5, weight: 0.25, reason: "核心材料(质子膜/催化剂)壁垒高" },
      localizationBarrier: { score: 3.0, weight: 0.25, reason: "碱性电解槽国产化率高，PEM膜电极依赖进口" },
      overtakingPotential: { score: 4.0, weight: 0.20, reason: "绿氢成本快速下降，有望率先实现平价" },
      composite: 3.50,
      grade: "B级",
    },

    skillA: {
      coreValue: { score: 4.0, reason: "深度脱碳终极方案，能源转型必经之路" },
      scarcityValue: { score: 3.5, reason: "技术路线多元，先发优势不显著" },
      matrixPosition: "观察布局",
    },

    skillN: {
      rotationSignal: { score: 3.0, reason: "主题性机会，资金关注度一般" },
      policyEnv: { score: 4.0, reason: "政策预期强烈，等待细则落地" },
      competition: { score: 3.0, reason: "全球同步发展，中国制氢设备领先" },
      techMigration: { score: 3.5, reason: "技术路线多元，尚未收敛" },
      downstream: { score: 3.0, reason: "成本高，应用场景有限" },
      fundValuation: { score: 3.0, reason: "板块估值偏高，盈利尚未兑现" },
      composite: 3.25,
    },

    composite: 3.65,
    isCore: false,
    recommendation: "观察布局",
    positionPct: "3-5%",

    subTracks: [
      { name: "燃料电池系统", trend: "📈上升", leaders: ["亿华通", "潍柴动力"] },
      { name: "电解槽", trend: "📈上升", leaders: ["隆基氢能", "阳光氢能"] },
      { name: "氢储运", trend: "📈上升", leaders: ["中材科技", "京城股份"] },
    ],

    relatedConcepts: ["氢能", "燃料电池", "电解槽", "绿氢"],
  },

  // ───────────────── 脑机接口 ─────────────────
  {
    code: "BCI",
    name: "脑机接口",
    swLevel1: "医药生物",
    swLevel2: "医疗器械",
    swLevel3: ["神经调控器械", "脑电设备", "康复器械"],
    keywords: ["脑机接口", "BCI", "神经调控", "脑科学"],

    planAlignment: { score: 4.5, reason: "十五五未来产业重点，北京/上海率先布局" },
    policySupport: { score: 3.5, reason: "脑科学专项+地方产业引导基金" },
    usChinaParity: { score: 3.0, reason: "Neuralink领先，国内临床试验快速追赶" },

    skillC: {
      techAdvancement: { score: 4.0, weight: 0.30, reason: "侵入式/非侵入式并行发展，医疗场景优先落地" },
      structuralScarcity: { score: 4.5, weight: 0.25, reason: "神经科学+AI+材料多学科交叉壁垒" },
      localizationBarrier: { score: 3.5, weight: 0.25, reason: "核心器件(电极/芯片)追赶中" },
      overtakingPotential: { score: 4.0, weight: 0.20, reason: "医疗场景落地可能快于消费场景" },
      composite: 4.00,
      grade: "A-级",
    },

    skillA: {
      coreValue: { score: 4.0, reason: "人机交互终极形态，医疗康复+增强现实" },
      scarcityValue: { score: 4.5, reason: "神经科学家全球极度稀缺" },
      matrixPosition: "观察布局",
    },

    skillN: {
      rotationSignal: { score: 3.0, reason: "概念性为主，成交清淡" },
      policyEnv: { score: 3.5, reason: "政策起步，投入规模有限" },
      competition: { score: 3.0, reason: "Neuralink领先，国内快速追赶" },
      techMigration: { score: 4.0, reason: "医疗应用进入临床试验阶段" },
      downstream: { score: 2.5, reason: "商业化尚早，市场规模小" },
      fundValuation: { score: 2.5, reason: "纯概念，无业绩支撑" },
      composite: 3.08,
    },

    composite: 3.68,
    isCore: false,
    recommendation: "观察布局",
    positionPct: "3-5%",

    subTracks: [
      { name: "侵入式BCI", trend: "📈上升", leaders: ["Neuralink(美)", "博睿康"] },
      { name: "非侵入式BCI", trend: "📈上升", leaders: ["BrainCo", "Neuramatrix"] },
      { name: "神经调控", trend: "📈上升", leaders: ["景昱医疗", "品驰医疗"] },
    ],

    relatedConcepts: ["脑科学", "神经调控", "康复器械"],
  },

  // ───────────────── 商业航天 ─────────────────
  {
    code: "COMSPACE",
    name: "商业航天",
    swLevel1: "国防军工",
    swLevel2: "航天装备",
    swLevel3: ["卫星制造", "火箭发射", "卫星应用", "太空旅游"],
    keywords: ["商业航天", "卫星互联网", "可复用火箭", "星链"],

    planAlignment: { score: 4.5, reason: "十五五重点培育，海南/酒泉发射场扩建" },
    policySupport: { score: 3.5, reason: "发射许可放开，民营航天准入" },
    usChinaParity: { score: 3.0, reason: "SpaceX绝对领先，国内快速追赶" },

    skillC: {
      techAdvancement: { score: 3.5, weight: 0.30, reason: "可复用火箭研发中，卫星批产能力构建" },
      structuralScarcity: { score: 4.0, weight: 0.25, reason: "发射场/频谱资源稀缺" },
      localizationBarrier: { score: 3.0, weight: 0.25, reason: "发动机/精密制造追赶中" },
      overtakingPotential: { score: 3.5, weight: 0.20, reason: "卫星互联网全球同步布局" },
      composite: 3.50,
      grade: "B级",
    },

    skillA: {
      coreValue: { score: 4.0, reason: "太空经济入口，战略制高点" },
      scarcityValue: { score: 4.0, reason: "发射场/频谱资源天然稀缺" },
      matrixPosition: "观察布局",
    },

    skillN: {
      rotationSignal: { score: 3.5, reason: "千帆/国网星座发射催化" },
      policyEnv: { score: 3.5, reason: "政策放开，但监管框架待完善" },
      competition: { score: 2.5, reason: "SpaceX一家独大，成本差距大" },
      techMigration: { score: 3.5, reason: "可复用火箭关键突破中" },
      downstream: { score: 3.5, reason: "卫星通信/遥感/导航需求增长" },
      fundValuation: { score: 3.0, reason: "主题投资为主" },
      composite: 3.25,
    },

    composite: 3.68,
    isCore: false,
    recommendation: "观察布局",
    positionPct: "3-5%",

    subTracks: [
      { name: "卫星互联网", trend: "🔥热门", leaders: ["中国卫星", "航天电子"] },
      { name: "火箭发射", trend: "📈上升", leaders: ["星际荣耀", "蓝箭航天(未上市)"] },
      { name: "卫星应用", trend: "📈上升", leaders: ["海格通信", "华力创通"] },
    ],

    relatedConcepts: ["卫星互联网", "火箭", "航天"],
  },
];

// ========== 计算综合分并排序 ==========
SECTOR_SKILL_ANALYSIS.forEach((s) => {
  s.composite = Math.round(
    (s.planAlignment.score * 0.20 +
      s.policySupport.score * 0.15 +
      s.usChinaParity.score * 0.15 +
      s.skillC.composite * 0.25 +
      s.skillA.coreValue.score * 0.10 +
      s.skillN.composite * 0.15) * 100
  ) / 100;
  s.isCore = s.composite >= 4.2;
});

/** 按综合分排序 */
export const SECTORS_SKILL_RANKED = [...SECTOR_SKILL_ANALYSIS].sort((a, b) => b.composite - a.composite);

/** 核心赛道 */
export const CORE_SKILL_SECTORS = SECTORS_SKILL_RANKED.filter((s) => s.isCore);

/** 代码映射 */
export const SECTOR_SKILL_MAP: Record<string, SectorSkillAnalysis> = SECTORS_SKILL_RANKED.reduce(
  (m, s) => { m[s.code] = s; return m; },
  {} as Record<string, SectorSkillAnalysis>
);

/** 同步获取全部板块分析 */
export function getSectorSkillAnalysis(): SectorSkillAnalysis[] {
  return SECTORS_SKILL_RANKED;
}

/** 同步获取 SKILL 板块代码→板块映射 */
export function getSectorSkillMap(): Record<string, SectorSkillAnalysis> {
  return SECTOR_SKILL_MAP;
}

/** 申万1级行业→赛道映射 */
export const SW1_TO_SECTOR: Record<string, string[]> = {
  "计算机": ["AI", "DIGITAL"],
  "电子": ["IC", "MAT"],
  "电力设备": ["NEV_PV", "H2"],
  "汽车": ["NEV"],
  "机械设备": ["ROBOT"],
  "通信": ["QUANTUM"],
  "国防军工": ["LOWALT", "AERO", "COMSPACE"],
  "医药生物": ["BIOTECH", "BCI"],
  "基础化工": ["MAT"],
};

/** 热门赛道标签 */
export const HOT_TRACKS = [
  { sector: "AI", track: "AI推理芯片", heat: 5 },
  { sector: "AI", track: "大模型应用", heat: 5 },
  { sector: "NEV", track: "智能驾驶", heat: 5 },
  { sector: "NEV", track: "动力电池", heat: 5 },
  { sector: "ROBOT", track: "人形机器人", heat: 5 },
  { sector: "ROBOT", track: "精密减速器", heat: 5 },
  { sector: "QUANTUM", track: "量子通信", heat: 4 },
  { sector: "NEV_PV", track: "储能系统", heat: 4 },
  { sector: "IC", track: "半导体设备", heat: 4 },
  { sector: "LOWALT", track: "eVTOL", heat: 4 },
  { sector: "AERO", track: "卫星互联网", heat: 4 },
  { sector: "BIOTECH", track: "创新药", heat: 3 },
  { sector: "MAT", track: "碳纤维", heat: 3 },
  { sector: "DIGITAL", track: "工业软件", heat: 3 },
];
