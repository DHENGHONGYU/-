/**
 * @doc []
 */
// ============================================================
// 板块评分数据 — 十五五规划20大新兴行业
// 三维度评分: 规划契合度 / 政策支持力度 / 中美同等热度
// 综合分≥4.2 = 核心稀缺资源板块
// ============================================================

import type { SectorDefinition, SectorStockMapping } from '@/data/types'

/** 维度权重配置 */
export const SECTOR_WEIGHTS = {
  plan: 0.35,    // 十五五规划契合度权重
  policy: 0.30,  // 政策支持力度权重
  parity: 0.35,  // 中美同等热度权重
};

/** 核心稀缺板块分数线 */
export const CORE_SECTOR_THRESHOLD = 4.2;

/** 十五五规划20大新兴行业板块定义 + 三维度评分 */
export const SECTOR_DEFINITIONS: SectorDefinition[] = [
  // ========== 战略性新兴产业（当前重点）==========
  {
    code: "AI",
    name: "人工智能",
    category: "新兴产业",
    description: "大模型、AI芯片、智能体、计算机视觉、自然语言处理",
    keywords: ["人工智能", "大模型", "AI芯片", "机器学习", "深度学习"],
    dimensions: { planAlignment: 5.0, policySupport: 5.0, usChinaParity: 4.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0, // 运行时计算
    isCore: false, // 运行时计算
    usChina: {
      chinaShare: "全球开源大模型60%+",
      usStatus: "尖端模型领先7个月",
      gap: "应用层领先，基础层追赶",
    },
    keyStocks: [
      { symbol: "688981.SH", name: "中芯国际" },
      { symbol: "688256.SH", name: "寒武纪" },
      { symbol: "002230.SZ", name: "科大讯飞" },
      { symbol: "688787.SH", name: "海天瑞声" },
    ],
    relatedConcepts: ["AI算力", "大模型", "智能芯片"],
  },
  {
    code: "IC",
    name: "集成电路",
    category: "新兴产业",
    description: "芯片设计、晶圆制造、封测、设备材料、EDA/IP",
    keywords: ["半导体", "芯片", "集成电路", "晶圆", "EDA"],
    dimensions: { planAlignment: 5.0, policySupport: 5.0, usChinaParity: 3.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "全球芯片消费50%+",
      usStatus: "主导设计+高端制造",
      gap: "制造差距2-3代，设备材料卡脖子",
    },
    keyStocks: [
      { symbol: "688981.SH", name: "中芯国际" },
      { symbol: "688012.SH", name: "中微公司" },
      { symbol: "688019.SH", name: "安集科技" },
      { symbol: "002371.SZ", name: "北方华创" },
    ],
    relatedConcepts: ["半导体设备", "芯片设计", "晶圆代工"],
  },
  {
    code: "NEV",
    name: "新能源汽车",
    category: "新兴产业",
    description: "电动车、动力电池、智能驾驶、充换电基础设施",
    keywords: ["新能源汽车", "电动车", "锂电池", "智能驾驶"],
    dimensions: { planAlignment: 4.5, policySupport: 4.5, usChinaParity: 5.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "全球60%+",
      usStatus: "Tesla领先",
      gap: "规模领先，品牌溢价追赶",
    },
    keyStocks: [
      { symbol: "002594.SZ", name: "比亚迪" },
      { symbol: "300750.SZ", name: "宁德时代" },
      { symbol: "601127.SH", name: "赛力斯" },
      { symbol: "300014.SZ", name: "亿纬锂能" },
    ],
    relatedConcepts: ["锂电池", "充电桩", "自动驾驶"],
  },
  {
    code: "BATTERY",
    name: "新型电池",
    category: "新兴产业",
    description: "固态电池、钠离子电池、储能系统、回收技术",
    keywords: ["固态电池", "储能", "钠电池", "电池回收"],
    dimensions: { planAlignment: 4.5, policySupport: 4.5, usChinaParity: 4.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "全球产能70%+",
      usStatus: "Solid Power追赶",
      gap: "规模绝对领先，固态电池接近",
    },
    keyStocks: [
      { symbol: "300750.SZ", name: "宁德时代" },
      { symbol: "002709.SZ", name: "天赐材料" },
      { symbol: "300073.SZ", name: "当升科技" },
    ],
    relatedConcepts: ["锂电池", "储能", "新能源"],
  },
  {
    code: "ROBOT",
    name: "机器人/具身智能",
    category: "新兴产业",
    description: "工业机器人、人形机器人、服务机器人、核心零部件",
    keywords: ["机器人", "人形机器人", "具身智能", "减速器", "伺服电机"],
    dimensions: { planAlignment: 5.0, policySupport: 4.5, usChinaParity: 4.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "工业机器人存量43%全球",
      usStatus: "Tesla Optimus/Boston Dynamics",
      gap: "应用规模领先，高端减速器追赶",
    },
    keyStocks: [
      { symbol: "002050.SZ", name: "三花智控" },
      { symbol: "688017.SH", name: "绿的谐波" },
      { symbol: "300124.SZ", name: "汇川技术" },
      { symbol: "688160.SH", name: "步科股份" },
    ],
    relatedConcepts: ["减速器", "伺服系统", "机器视觉"],
  },
  {
    code: "BIOTECH",
    name: "生物医药",
    category: "新兴产业",
    description: "创新药、细胞基因治疗、疫苗、高端医疗器械",
    keywords: ["生物医药", "创新药", "CXO", "基因治疗", "疫苗"],
    dimensions: { planAlignment: 4.5, policySupport: 4.0, usChinaParity: 3.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "全球API生产主导",
      usStatus: "创新药绝对领先",
      gap: "CXO全球龙头，原创药差距大",
    },
    keyStocks: [
      { symbol: "603259.SH", name: "药明康德" },
      { symbol: "688235.SH", name: "百济神州" },
      { symbol: "300122.SZ", name: "智飞生物" },
      { symbol: "600276.SH", name: "恒瑞医药" },
    ],
    relatedConcepts: ["创新药", "CXO", "医疗器械"],
  },
  {
    code: "AEROSPACE",
    name: "航空航天",
    category: "新兴产业",
    description: "国产大飞机、商业航天、卫星互联网、航空发动机",
    keywords: ["大飞机", "商业航天", "卫星", "航空发动机"],
    dimensions: { planAlignment: 4.5, policySupport: 4.0, usChinaParity: 3.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "C919交付爬坡",
      usStatus: "Boeing/Lockheed Martin",
      gap: "大飞机起步，商业航天追赶",
    },
    keyStocks: [
      { symbol: "600893.SH", name: "航发动力" },
      { symbol: "600372.SH", name: "中航机载" },
      { symbol: "688002.SH", name: "睿创微纳" },
    ],
    relatedConcepts: ["大飞机", "卫星导航", "军工"],
  },
  {
    code: "LOWALT",
    name: "低空经济",
    category: "新兴产业",
    description: "eVTOL、无人机、低空物流、通航基础设施",
    keywords: ["低空经济", "eVTOL", "无人机", "通航"],
    dimensions: { planAlignment: 4.5, policySupport: 4.5, usChinaParity: 4.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "无人机全球70%+",
      usStatus: "Joby/Archer追赶",
      gap: "无人机领先，eVTOL并跑",
    },
    keyStocks: [
      { symbol: "002050.SZ", name: "三花智控" },
      { symbol: "002241.SZ", name: "歌尔股份" },
      { symbol: "300900.SZ", name: "广联航空" },
    ],
    relatedConcepts: ["无人机", "eVTOL", "碳纤维"],
  },
  {
    code: "NEW_MAT",
    name: "新材料",
    category: "新兴产业",
    description: "碳纤维、稀土功能材料、先进陶瓷、石墨烯、超导材料",
    keywords: ["新材料", "碳纤维", "稀土", "石墨烯", "超导"],
    dimensions: { planAlignment: 4.0, policySupport: 4.0, usChinaParity: 4.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "稀土控制60%开采+91%精炼",
      usStatus: "高端材料领先",
      gap: "稀土绝对主导，高端有差距",
    },
    keyStocks: [
      { symbol: "600111.SH", name: "北方稀土" },
      { symbol: "600516.SH", name: "方大炭素" },
      { symbol: "300699.SZ", name: "光威复材" },
    ],
    relatedConcepts: ["稀土", "碳纤维", "先进陶瓷"],
  },
  {
    code: "MARINE",
    name: "海洋经济",
    category: "新兴产业",
    description: "海洋工程装备、海洋生物医药、海水淡化、海洋能",
    keywords: ["海洋经济", "海工装备", "海洋能", "海水淡化"],
    dimensions: { planAlignment: 4.0, policySupport: 3.5, usChinaParity: 3.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "造船新接订单2/3全球",
      usStatus: "海洋科技领先",
      gap: "造船领先，深海有差距",
    },
    keyStocks: [
      { symbol: "601989.SH", name: "中国重工" },
      { symbol: "600150.SH", name: "中国船舶" },
    ],
    relatedConcepts: ["造船", "海工装备", "海洋能"],
  },

  // ========== 未来产业（前瞻布局）==========
  {
    code: "QUANTUM",
    name: "量子科技",
    category: "未来产业",
    description: "量子通信、量子计算、量子精密测量",
    keywords: ["量子", "量子通信", "量子计算"],
    dimensions: { planAlignment: 5.0, policySupport: 4.0, usChinaParity: 4.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "量子通信实用化全球第一",
      usStatus: "IBM/Google量子计算领先",
      gap: "通信领先，计算追赶",
    },
    keyStocks: [
      { symbol: "688027.SH", name: "国盾量子" },
      { symbol: "300520.SZ", name: "科大国创" },
    ],
    relatedConcepts: ["量子通信", "量子计算"],
  },
  {
    code: "BIO_MFG",
    name: "生物制造",
    category: "未来产业",
    description: "合成生物学、生物化工、生物能源、酶工程",
    keywords: ["生物制造", "合成生物", "生物化工", "酶工程"],
    dimensions: { planAlignment: 4.5, policySupport: 4.0, usChinaParity: 3.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "发酵工程全球领先",
      usStatus: "Amyris/Ginkgo领先",
      gap: "制造能力强，原创平台追赶",
    },
    keyStocks: [
      { symbol: "688065.SH", name: "凯赛生物" },
      { symbol: "300381.SZ", name: "溢多利" },
    ],
    relatedConcepts: ["合成生物", "生物化工"],
  },
  {
    code: "FUSION",
    name: "氢能与核聚变",
    category: "未来产业",
    description: "绿氢制备、氢储运、氢燃料电池、可控核聚变",
    keywords: ["氢能", "核聚变", "绿氢", "燃料电池"],
    dimensions: { planAlignment: 4.5, policySupport: 4.0, usChinaParity: 3.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "电解槽产能全球60%+",
      usStatus: "Commonwealth Fusion领先",
      gap: "制氢领先，储运和聚变追赶",
    },
    keyStocks: [
      { symbol: "002733.SZ", name: "雄韬股份" },
      { symbol: "300471.SZ", name: "厚普股份" },
      { symbol: "688339.SH", name: "亿华通" },
    ],
    relatedConcepts: ["氢能源", "燃料电池", "储能"],
  },
  {
    code: "BCI",
    name: "脑机接口",
    category: "未来产业",
    description: "侵入式/非侵入式脑机接口、神经调控、医疗康复",
    keywords: ["脑机接口", "BCI", "神经调控", "医疗康复"],
    dimensions: { planAlignment: 4.5, policySupport: 3.5, usChinaParity: 3.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "临床试验进展迅速",
      usStatus: "Neuralink领先",
      gap: "临床应用追赶，基础研究有差距",
    },
    keyStocks: [
      { symbol: "300818.SZ", name: "耐普矿机" },
    ],
    relatedConcepts: ["脑科学", "医疗康复"],
  },
  {
    code: "6G",
    name: "6G通信",
    category: "未来产业",
    description: "太赫兹通信、卫星互联网、空天地一体化网络",
    keywords: ["6G", "太赫兹", "卫星互联网", "天地一体化"],
    dimensions: { planAlignment: 4.5, policySupport: 4.0, usChinaParity: 3.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "5G基站全球60%",
      usStatus: "Starlink领先",
      gap: "地面5G领先，低轨卫星追赶",
    },
    keyStocks: [
      { symbol: "600498.SH", name: "烽火通信" },
      { symbol: "600118.SH", name: "中国卫星" },
    ],
    relatedConcepts: ["通信设备", "卫星互联网"],
  },
  {
    code: "COMM_SPACE",
    name: "商业航天",
    category: "未来产业",
    description: "可重复使用火箭、卫星制造、太空互联网、太空旅游",
    keywords: ["商业航天", "可重复火箭", "卫星互联网", "太空"],
    dimensions: { planAlignment: 4.5, policySupport: 3.5, usChinaParity: 3.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "发射次数全球第二",
      usStatus: "SpaceX绝对领先",
      gap: "追赶中，成本差距大",
    },
    keyStocks: [
      { symbol: "600118.SH", name: "中国卫星" },
      { symbol: "688523.SH", name: "航天环宇" },
    ],
    relatedConcepts: ["卫星", "火箭", "航天"],
  },
  {
    code: "MED_DEV",
    name: "高端医疗器械",
    category: "未来产业",
    description: "CT/MRI、手术机器人、植入器械、生命支持设备",
    keywords: ["医疗器械", "影像设备", "手术机器人", "植入器械"],
    dimensions: { planAlignment: 4.0, policySupport: 4.0, usChinaParity: 2.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "中低端主导，高端突破",
      usStatus: "GE/Siemens/Medtronic垄断",
      gap: "高端设备差距明显",
    },
    keyStocks: [
      { symbol: "300760.SZ", name: "迈瑞医疗" },
      { symbol: "688016.SH", name: "心脉医疗" },
      { symbol: "688617.SH", name: "惠泰医疗" },
    ],
    relatedConcepts: ["医疗影像", "手术机器人", "高值耗材"],
  },
  {
    code: "C919",
    name: "国产大飞机",
    category: "未来产业",
    description: "C919/C929、航空发动机、机载系统、供应链",
    keywords: ["大飞机", "C919", "航空发动机", "机载系统"],
    dimensions: { planAlignment: 4.5, policySupport: 4.0, usChinaParity: 2.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "C919开始交付",
      usStatus: "Boeing/Airbus双寡头",
      gap: "刚起步，差距巨大",
    },
    keyStocks: [
      { symbol: "600760.SH", name: "中航沈飞" },
      { symbol: "600893.SH", name: "航发动力" },
    ],
    relatedConcepts: ["大飞机", "航空", "军工"],
  },

  // ========== 战略基础产业 ==========
  {
    code: "PV_WIND",
    name: "光伏风电",
    category: "战略基础",
    description: "光伏组件、逆变器、风电整机、储能配套",
    keywords: ["光伏", "风电", "逆变器", "新能源发电"],
    dimensions: { planAlignment: 4.5, policySupport: 4.0, usChinaParity: 5.0 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "光伏组件80%+, 风电装机全球第一",
      usStatus: "First Solar/Siemens",
      gap: "绝对主导地位",
    },
    keyStocks: [
      { symbol: "601012.SH", name: "隆基绿能" },
      { symbol: "300274.SZ", name: "阳光电源" },
      { symbol: "002202.SZ", name: "金风科技" },
      { symbol: "688303.SH", name: "大全能源" },
    ],
    relatedConcepts: ["光伏", "风电", "逆变器", "储能"],
  },
  {
    code: "DIGITAL",
    name: "数字经济",
    category: "战略基础",
    description: "云计算、大数据、工业互联网、区块链、物联网",
    keywords: ["数字经济", "云计算", "大数据", "工业互联网"],
    dimensions: { planAlignment: 4.0, policySupport: 4.0, usChinaParity: 3.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "云市场全球第二",
      usStatus: "AWS/Azure/Google Cloud",
      gap: "规模追赶，生态有差距",
    },
    keyStocks: [
      { symbol: "688111.SH", name: "金山办公" },
      { symbol: "600570.SH", name: "恒生电子" },
      { symbol: "002410.SZ", name: "广联达" },
    ],
    relatedConcepts: ["云计算", "SaaS", "工业互联网"],
  },
  {
    code: "GREEN",
    name: "绿色环保",
    category: "战略基础",
    description: "环保设备、资源循环利用、碳捕集、污染治理",
    keywords: ["环保", "碳中和", "循环经济", "污染治理"],
    dimensions: { planAlignment: 4.0, policySupport: 4.0, usChinaParity: 3.5 },
    weight: SECTOR_WEIGHTS,
    composite: 0,
    isCore: false,
    usChina: {
      chinaShare: "环保产业全球领先",
      usStatus: "技术先进但规模小",
      gap: "规模领先，部分技术追赶",
    },
    keyStocks: [
      { symbol: "603588.SH", name: "高能环境" },
      { symbol: "300187.SZ", name: "永清环保" },
    ],
    relatedConcepts: ["环保", "碳中和", "循环经济"],
  },
];

// ========== 计算综合评分 & 标记核心板块 ==========
function computeScores(): SectorDefinition[] {
  return SECTOR_DEFINITIONS.map((s) => {
    const composite =
      s.dimensions.planAlignment * s.weight.plan +
      s.dimensions.policySupport * s.weight.policy +
      s.dimensions.usChinaParity * s.weight.parity;
    return { ...s, composite: Math.round(composite * 100) / 100, isCore: composite >= CORE_SECTOR_THRESHOLD };
  });
}

/** 带评分的板块定义（已计算综合分） */
export const SECTORS_WITH_SCORES = computeScores();

/** 核心稀缺板块（≥4.2） */
export const CORE_SECTORS = SECTORS_WITH_SCORES.filter((s) => s.isCore);

/** 按综合分排序的全部板块 */
export const SECTORS_RANKED = [...SECTORS_WITH_SCORES].sort((a, b) => b.composite - a.composite);

/** 板块代码→板块映射 */
export const SECTOR_MAP: Record<string, SectorDefinition> = SECTORS_WITH_SCORES.reduce(
  (map, s) => { map[s.code] = s; return map; },
  {} as Record<string, SectorDefinition>
);

// ========== 板块-股票映射（基于概念关键词匹配）==========
export function matchStocksToSectors(stocks: Array<{ symbol: string; name: string; conceptTags?: string[] }>): SectorStockMapping[] {
  const mappings: SectorStockMapping[] = SECTORS_WITH_SCORES.map((sector) => ({
    sectorCode: sector.code,
    sectorName: sector.name,
    stockSymbols: [],
    matchType: "primary" as const,
  }));

  const mappingByCode = new Map(mappings.map((m) => [m.sectorCode, m]));

  for (const stock of stocks) {
    matchStockByKeywords(stock, mappingByCode);
    matchStockByKeyStocks(stock, mappingByCode);
  }

  return mappings.filter((m) => m.stockSymbols.length > 0);
}

function addSymbolToMapping(
  mappingByCode: Map<string, SectorStockMapping>,
  sectorCode: string,
  symbol: string,
): void {
  const mapping = mappingByCode.get(sectorCode);
  if (mapping && !mapping.stockSymbols.includes(symbol)) {
    mapping.stockSymbols.push(symbol);
  }
}

function matchStockByKeywords(
  stock: { symbol: string; name: string; conceptTags?: string[] },
  mappingByCode: Map<string, SectorStockMapping>,
): void {
  const tags = stock.conceptTags ?? [];
  const nameLower = stock.name.toLowerCase();

  for (const sector of SECTORS_WITH_SCORES) {
    const matched = sector.keywords.some((kw) =>
      tags.some((t) => t.includes(kw)) || nameLower.includes(kw)
    );
    if (matched) {
      addSymbolToMapping(mappingByCode, sector.code, stock.symbol);
    }
  }
}

function matchStockByKeyStocks(
  stock: { symbol: string; name: string; conceptTags?: string[] },
  mappingByCode: Map<string, SectorStockMapping>,
): void {
  for (const sector of SECTORS_WITH_SCORES) {
    const isKeyStock = sector.keyStocks.some((ks) => ks.symbol === stock.symbol);
    if (isKeyStock) {
      addSymbolToMapping(mappingByCode, sector.code, stock.symbol);
    }
  }
}

/** 获取某板块在股票池中的匹配股票 */
export function getSectorPoolStocks(
  sectorCode: string,
  poolStocks: Array<{ symbol: string; name: string; v6Composite?: number }>
): Array<{ symbol: string; name: string; v6Composite: number }> {
  const sector = SECTOR_MAP[sectorCode];
  if (!sector) return [];

  return poolStocks
    .filter((s) =>
      sector.keyStocks.some((ks) => ks.symbol === s.symbol)
    )
    .map((s) => ({ ...s, v6Composite: s.v6Composite ?? 0 }));
}

/** 三维度评分说明 */
export const DIMENSION_DESC = {
  planAlignment: {
    name: "十五五规划契合度",
    weight: "35%",
    desc: "板块在十五五规划纲要中被提及的频次、定位层级（支柱产业/新兴产业/未来产业）",
    criteria: [
      "5分 = 列入专栏专项/支柱产业",
      "4分 = 明确列为新兴产业重点",
      "3分 = 纲要提及但非重点",
      "2分 = 间接关联",
      "1分 = 无直接关联",
    ],
  },
  policySupport: {
    name: "政策支持力度",
    weight: "30%",
    desc: "产业政策密集度、资金/税收优惠、央企国企布局、地方配套政策",
    criteria: [
      "5分 = 国家级重大专项+万亿级基金",
      "4分 = 多部委联合支持",
      "3分 = 单一部委支持",
      "2分 = 地方政策为主",
      "1分 = 政策支持有限",
    ],
  },
  usChinaParity: {
    name: "中美同等热度",
    weight: "35%",
    desc: "全球市场份额、技术竞争力、人才资本投入、产业链完整度",
    criteria: [
      "5分 = 中国全球领先/主导",
      "4分 = 并跑/局部领先",
      "3分 = 追赶中差距缩小",
      "2分 = 差距明显",
      "1分 = 大幅落后",
    ],
  },
};
