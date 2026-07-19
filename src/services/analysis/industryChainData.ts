/**
 * industryChainData — 产业链关系定义
 *
 * 基于现有 SECTOR_DEFINITIONS 推导行业上下游关系，
 * 供 IndustryChainWidget 可视化使用。
  * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

export interface IndustryNode {
  id: string
  name: string
  category: string
  /** 在产业链中的位置：上游/中游/下游/横向 */
  chainPosition: 'upstream' | 'midstream' | 'downstream' | 'horizontal'
  /** 关联的核心概念 */
  keywords: string[]
  /** 典型标的 */
  exampleStocks: { symbol: string; name: string }[]
}

export interface IndustryEdge {
  source: string
  target: string
  /** 关系类型：供应/竞争/协同/替代 */
  relation: 'supply' | 'competition' | 'synergy' | 'substitute'
}

export interface IndustryChain {
  nodes: IndustryNode[]
  edges: IndustryEdge[]
}

/**
 * 产业链节点与关系定义
 *
 * 基于「十五五规划20大新兴行业」构建的轻量产业链图谱。
 * 后续可从知识图谱数据源自动生成。
 */
export const INDUSTRY_CHAIN: IndustryChain = {
  nodes: [
    // ===== 上游：基础技术与材料 =====
    { id: 'IC',  name: '集成电路',     category: '新兴产业', chainPosition: 'upstream', keywords: ['芯片', '半导体', '晶圆'], exampleStocks: [{ symbol: '688981.SH', name: '中芯国际' }] },
    { id: 'AI',  name: '人工智能',     category: '新兴产业', chainPosition: 'midstream', keywords: ['大模型', 'AI芯片', '智能体'], exampleStocks: [{ symbol: '688256.SH', name: '寒武纪' }] },
    { id: 'QT',  name: '量子信息',     category: '未来产业', chainPosition: 'upstream', keywords: ['量子计算', '量子通信'], exampleStocks: [] },
    { id: 'NE',  name: '新能源',       category: '新兴产业', chainPosition: 'upstream', keywords: ['光伏', '风电', '储能'], exampleStocks: [{ symbol: '300750.SZ', name: '宁德时代' }] },
    { id: 'NS',  name: '新材料',       category: '新兴产业', chainPosition: 'upstream', keywords: ['碳纤维', '超导', '纳米'], exampleStocks: [] },

    // ===== 中游：应用技术与平台 =====
    { id: 'CL',  name: '云计算',       category: '数字产业', chainPosition: 'midstream', keywords: ['IaaS', 'PaaS', 'SaaS'], exampleStocks: [{ symbol: '688111.SH', name: '金山办公' }] },
    { id: 'BD',  name: '大数据',       category: '数字产业', chainPosition: 'midstream', keywords: ['数据要素', '数据治理'], exampleStocks: [] },
    { id: 'IOT', name: '物联网',       category: '数字产业', chainPosition: 'midstream', keywords: ['传感器', '车联网'], exampleStocks: [] },
    { id: '5G',  name: '5G/6G',        category: '数字产业', chainPosition: 'midstream', keywords: ['通信', '基站'], exampleStocks: [{ symbol: '600941.SH', name: '中国移动' }] },
    { id: 'BT',  name: '生物技术',     category: '新兴产业', chainPosition: 'midstream', keywords: ['基因', '细胞治疗'], exampleStocks: [] },
    { id: 'AE',  name: '航空发动机',   category: '新兴产业', chainPosition: 'midstream', keywords: ['发动机', '高温合金'], exampleStocks: [] },

    // ===== 下游：终端应用与产品 =====
    { id: 'EV',  name: '新能源汽车',   category: '新兴产业', chainPosition: 'downstream', keywords: ['电动车', '锂电池', '充电桩'], exampleStocks: [{ symbol: '002594.SZ', name: '比亚迪' }] },
    { id: 'RO',  name: '机器人',       category: '未来产业', chainPosition: 'downstream', keywords: ['人形机器人', '工业机器人'], exampleStocks: [] },
    { id: 'SM',  name: '高端装备',     category: '新兴产业', chainPosition: 'downstream', keywords: ['数控机床', '精密仪器'], exampleStocks: [] },
    { id: 'MS',  name: '商业航天',     category: '未来产业', chainPosition: 'downstream', keywords: ['卫星', '火箭'], exampleStocks: [] },
    { id: 'AIE', name: 'AI终端',       category: '终端应用', chainPosition: 'downstream', keywords: ['AI手机', 'AI PC', 'AI眼镜'], exampleStocks: [] },

    // ===== 横向：交叉服务 =====
    { id: 'DG',  name: '数字金融',     category: '数字产业', chainPosition: 'horizontal', keywords: ['金融科技', '数字货币'], exampleStocks: [] },
    { id: 'SMH', name: '智慧医疗',     category: '数字产业', chainPosition: 'horizontal', keywords: ['医疗信息化', 'AI诊断'], exampleStocks: [] },
    { id: 'SMA', name: '智慧农业',     category: '数字产业', chainPosition: 'horizontal', keywords: ['精准农业', '农业IoT'], exampleStocks: [] },
  ],

  edges: [
    // 供应关系（上游→中游→下游）
    { source: 'IC',  target: 'AI',  relation: 'supply' },
    { source: 'IC',  target: 'CL',  relation: 'supply' },
    { source: 'IC',  target: 'IOT', relation: 'supply' },
    { source: 'IC',  target: '5G',  relation: 'supply' },
    { source: 'IC',  target: 'EV',  relation: 'supply' },
    { source: 'NE',  target: 'EV',  relation: 'supply' },
    { source: 'NE',  target: 'RO',  relation: 'supply' },
    { source: 'NS',  target: 'AE',  relation: 'supply' },
    { source: 'NS',  target: 'SM',  relation: 'supply' },
    { source: 'NS',  target: 'MS',  relation: 'supply' },
    { source: 'AI',  target: 'RO',  relation: 'supply' },
    { source: 'AI',  target: 'AIE', relation: 'supply' },
    { source: 'AI',  target: 'SMH', relation: 'supply' },
    { source: 'BD',  target: 'DG',  relation: 'supply' },
    { source: 'BD',  target: 'SMA', relation: 'supply' },
    { source: 'IOT', target: 'SM',  relation: 'supply' },
    { source: '5G',  target: 'AIE', relation: 'supply' },
    { source: '5G',  target: 'MS',  relation: 'supply' },
    { source: 'BT',  target: 'SMH', relation: 'supply' },

    // 协同关系
    { source: 'AI',  target: 'BD',  relation: 'synergy' },
    { source: 'AI',  target: 'CL',  relation: 'synergy' },
    { source: 'AI',  target: 'IOT', relation: 'synergy' },
    { source: 'EV',  target: 'NE',  relation: 'synergy' },
    { source: 'RO',  target: 'SM',  relation: 'synergy' },
    { source: 'MS',  target: 'QT',  relation: 'synergy' },
  ],
}
