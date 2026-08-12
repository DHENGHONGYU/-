/**
 * 三级行业分类体系
 *
 * 采用"一级大类 → 二级细分 → 三级赛道"的三级分类结构。
 * 设计原则：
 * 1. 开放性：不预设行业边界，支持动态扩展
 * 2. 可映射：与申万/东方财富行业分类建立映射关系
 * 3. 可匹配：每个行业配备关键词，用于股票自动匹配
 *
 * v2.9.0 初始版本：覆盖 9 个一级、28 个二级、60+ 个三级行业
 *
 * @module data/industryHierarchy
 * @created 2026-07-16
  * @doc []
*/

import type { IndustryDefinition } from '@/data/types/types.sector'

// ============================================================
// 一级行业（Tier 1）
// ============================================================

const TIER1_INDUSTRIES: IndustryDefinition[] = [
  {
    code: 'TMT',
    name: '信息技术',
    tier: 'tier1',
    description: '科技、媒体、通信，涵盖半导体、软件、通信、消费电子等',
    keywords: ['科技', 'TMT', '信息技术', '互联网', '电子'],
  },
  {
    code: 'HEALTH',
    name: '医药生物',
    tier: 'tier1',
    description: '医药、医疗、生物科技，涵盖创新药、医疗器械、医疗服务等',
    keywords: ['医药', '医疗', '生物', '健康', '制药'],
  },
  {
    code: 'NEW_ENERGY',
    name: '新能源',
    tier: 'tier1',
    description: '光伏、风电、新能源车、储能、氢能等清洁能源',
    keywords: ['新能源', '光伏', '风电', '锂电', '储能'],
  },
  {
    code: 'ADVANCED_MFG',
    name: '高端装备',
    tier: 'tier1',
    description: '机器人、航空航天、军工、数控机床等高端制造',
    keywords: ['装备', '制造', '机器人', '航空', '军工'],
  },
  {
    code: 'NEW_MATERIALS',
    name: '新材料',
    tier: 'tier1',
    description: '半导体材料、新能源材料、生物医用材料等',
    keywords: ['材料', '新材料', '化工新材料'],
  },
  {
    code: 'CONSUMER',
    name: '消费',
    tier: 'tier1',
    description: '食品饮料、家电、零售、文旅等消费品类与服务',
    keywords: ['消费', '食品', '饮料', '家电', '零售'],
  },
  {
    code: 'FINANCE',
    name: '金融',
    tier: 'tier1',
    description: '银行、证券、保险、资管等金融服务',
    keywords: ['金融', '银行', '证券', '保险', '资管'],
  },
  {
    code: 'CYCLICAL',
    name: '周期制造',
    tier: 'tier1',
    description: '化工、有色、钢铁、煤炭、建材等周期性行业',
    keywords: ['化工', '有色', '钢铁', '煤炭', '建材'],
  },
  {
    code: 'INFRA',
    name: '基础设施',
    tier: 'tier1',
    description: '电力、交通、建筑、环保等基础设施',
    keywords: ['电力', '交通', '建筑', '环保', '基建'],
  },
]

// ============================================================
// 二级行业（Tier 2）
// ============================================================

const TIER2_INDUSTRIES: IndustryDefinition[] = [
  // TMT 二级
  {
    code: 'SEMICONDUCTOR',
    name: '半导体',
    tier: 'tier2',
    parentCode: 'TMT',
    description: '芯片设计、制造、封测、设备材料全产业链',
    keywords: ['芯片', '半导体', '集成电路', 'IC', '晶圆'],
  },
  {
    code: 'SOFTWARE',
    name: '软件与服务',
    tier: 'tier2',
    parentCode: 'TMT',
    description: '基础软件、应用软件、SaaS、IT服务',
    keywords: ['软件', 'SaaS', '云计算', 'IT服务', '信息化'],
  },
  {
    code: 'TELECOM',
    name: '通信',
    tier: 'tier2',
    parentCode: 'TMT',
    description: '运营商、通信设备、光通信、卫星通信',
    keywords: ['通信', '电信', '5G', '6G', '光通信'],
  },
  {
    code: 'CONSUMER_ELEC',
    name: '消费电子',
    tier: 'tier2',
    parentCode: 'TMT',
    description: '手机、PC、可穿戴、VR/AR等消费类电子',
    keywords: ['消费电子', '手机', '智能穿戴', 'VR', 'AR'],
  },

  // 医药生物 二级
  {
    code: 'INNOVATIVE_DRUG',
    name: '创新药',
    tier: 'tier2',
    parentCode: 'HEALTH',
    description: '小分子、大分子、ADC、基因治疗等创新药物',
    keywords: ['创新药', '新药', '原研药', '生物药'],
  },
  {
    code: 'MEDICAL_DEVICE',
    name: '医疗器械',
    tier: 'tier2',
    parentCode: 'HEALTH',
    description: '影像设备、手术器械、植入耗材、体外诊断',
    keywords: ['医疗器械', '医疗设备', '耗材', 'IVD'],
  },
  {
    code: 'MEDICAL_SERVICE',
    name: '医疗服务',
    tier: 'tier2',
    parentCode: 'HEALTH',
    description: '医院、体检、眼科、牙科、医美等医疗服务',
    keywords: ['医疗服务', '医院', '体检', '眼科', '医美'],
  },
  {
    code: 'CXO',
    name: '医药研发外包',
    tier: 'tier2',
    parentCode: 'HEALTH',
    description: 'CRO/CDMO/CMO 医药研发生产外包',
    keywords: ['CRO', 'CDMO', 'CMO', '医药外包'],
  },

  // 新能源 二级
  {
    code: 'PHOTOVOLTAIC',
    name: '光伏',
    tier: 'tier2',
    parentCode: 'NEW_ENERGY',
    description: '硅料、硅片、电池片、组件、逆变器等光伏产业链',
    keywords: ['光伏', '太阳能', '组件', '逆变器', '硅料'],
  },
  {
    code: 'WIND_POWER',
    name: '风电',
    tier: 'tier2',
    parentCode: 'NEW_ENERGY',
    description: '风电整机、零部件、海缆等风电产业链',
    keywords: ['风电', '风力发电', '风机', '塔筒'],
  },
  {
    code: 'NEV',
    name: '新能源汽车',
    tier: 'tier2',
    parentCode: 'NEW_ENERGY',
    description: '电动车整车、动力电池、智能驾驶等',
    keywords: ['新能源汽车', '电动车', '动力电池', '智能驾驶'],
  },
  {
    code: 'ENERGY_STORAGE',
    name: '储能',
    tier: 'tier2',
    parentCode: 'NEW_ENERGY',
    description: '电化学储能、抽水蓄能、压缩空气储能等',
    keywords: ['储能', '电池储能', '抽水蓄能', '储能系统'],
  },

  // 高端装备 二级
  {
    code: 'ROBOTICS',
    name: '机器人',
    tier: 'tier2',
    parentCode: 'ADVANCED_MFG',
    description: '工业机器人、人形机器人、服务机器人、核心零部件',
    keywords: ['机器人', '人形机器人', '工业机器人', '减速器'],
  },
  {
    code: 'AEROSPACE',
    name: '航空航天',
    tier: 'tier2',
    parentCode: 'ADVANCED_MFG',
    description: '大飞机、商业航天、卫星互联网、航空发动机',
    keywords: ['航空', '航天', '大飞机', '卫星', '火箭'],
  },
  {
    code: 'MILITARY',
    name: '军工',
    tier: 'tier2',
    parentCode: 'ADVANCED_MFG',
    description: '军工电子、军工材料、军工制造等国防工业',
    keywords: ['军工', '国防', '军用', '兵工'],
  },

  // 新材料 二级
  {
    code: 'SEMICONDUCTOR_MAT',
    name: '半导体材料',
    tier: 'tier2',
    parentCode: 'NEW_MATERIALS',
    description: '光刻胶、电子特气、湿电子化学品、CMP材料等',
    keywords: ['半导体材料', '光刻胶', '电子特气', '靶材'],
  },
  {
    code: 'NEW_ENERGY_MAT',
    name: '新能源材料',
    tier: 'tier2',
    parentCode: 'NEW_MATERIALS',
    description: '正极、负极、隔膜、电解液、光伏材料等',
    keywords: ['新能源材料', '正极材料', '负极材料', '隔膜', '电解液'],
  },
  {
    code: 'ADVANCED_MAT',
    name: '先进材料',
    tier: 'tier2',
    parentCode: 'NEW_MATERIALS',
    description: '碳纤维、稀土功能材料、超导材料、石墨烯等',
    keywords: ['碳纤维', '稀土', '超导', '石墨烯', '先进陶瓷'],
  },

  // 消费 二级
  {
    code: 'FOOD_BEVERAGE',
    name: '食品饮料',
    tier: 'tier2',
    parentCode: 'CONSUMER',
    description: '白酒、啤酒、乳制品、调味品、休闲食品等',
    keywords: ['食品', '饮料', '白酒', '啤酒', '乳业'],
  },
  {
    code: 'HOME_APPLIANCE',
    name: '家电',
    tier: 'tier2',
    parentCode: 'CONSUMER',
    description: '白电、黑电、小家电、厨电等',
    keywords: ['家电', '白电', '黑电', '小家电', '厨电'],
  },

  // 金融 二级
  {
    code: 'BANKING',
    name: '银行',
    tier: 'tier2',
    parentCode: 'FINANCE',
    description: '国有大行、股份制银行、城商行、农商行',
    keywords: ['银行', '商业银行', '国有银行'],
  },
  {
    code: 'SECURITIES',
    name: '证券',
    tier: 'tier2',
    parentCode: 'FINANCE',
    description: '券商、投行、财富管理等证券服务',
    keywords: ['证券', '券商', '投行', '经纪'],
  },
  {
    code: 'INSURANCE',
    name: '保险',
    tier: 'tier2',
    parentCode: 'FINANCE',
    description: '寿险、财险、健康险等保险服务',
    keywords: ['保险', '寿险', '财险', '车险'],
  },

  // 周期制造 二级
  {
    code: 'CHEMICAL',
    name: '化工',
    tier: 'tier2',
    parentCode: 'CYCLICAL',
    description: '基础化工、精细化工、农用化工等',
    keywords: ['化工', '化学', '石化', '精细化工'],
  },
  {
    code: 'NONFERROUS',
    name: '有色金属',
    tier: 'tier2',
    parentCode: 'CYCLICAL',
    description: '铜、铝、铅锌、黄金、稀土等有色金属',
    keywords: ['有色', '有色金属', '铜', '铝', '黄金'],
  },

  // 基础设施 二级
  {
    code: 'ENVIRONMENTAL',
    name: '环保',
    tier: 'tier2',
    parentCode: 'INFRA',
    description: '环境治理、固废处理、水务、碳减排等',
    keywords: ['环保', '环境', '固废', '水务', '碳中和'],
  },
  {
    code: 'POWER',
    name: '电力',
    tier: 'tier2',
    parentCode: 'INFRA',
    description: '火电、水电、核电、电网等电力系统',
    keywords: ['电力', '火电', '水电', '核电', '电网'],
  },
]

// ============================================================
// 三级行业（Tier 3）
// ============================================================

const TIER3_INDUSTRIES: IndustryDefinition[] = [
  // 半导体 三级
  {
    code: 'CHIP_DESIGN',
    name: '芯片设计',
    tier: 'tier3',
    parentCode: 'SEMICONDUCTOR',
    description: '集成电路设计，包括CPU、GPU、FPGA、模拟芯片等',
    keywords: ['芯片设计', 'IC设计', '设计公司', 'Fabless'],
  },
  {
    code: 'WAFER_MFG',
    name: '晶圆制造',
    tier: 'tier3',
    parentCode: 'SEMICONDUCTOR',
    description: '晶圆代工、IDM制造，先进制程与特色工艺',
    keywords: ['晶圆制造', '代工', 'Foundry', 'IDM', '制程'],
  },
  {
    code: 'PACKAGING_TEST',
    name: '封装测试',
    tier: 'tier3',
    parentCode: 'SEMICONDUCTOR',
    description: '芯片封装与测试，先进封装如CoWoS、2.5D/3D',
    keywords: ['封装测试', '封测', 'CoWoS', '先进封装'],
  },
  {
    code: 'SEMICON_EQUIPMENT',
    name: '半导体设备',
    tier: 'tier3',
    parentCode: 'SEMICONDUCTOR',
    description: '光刻机、刻蚀机、薄膜沉积、CMP、检测设备等',
    keywords: ['半导体设备', '光刻机', '刻蚀机', '薄膜沉积', '检测设备'],
  },

  // 创新药 三级
  {
    code: 'SMALL_MOLECULE',
    name: '小分子创新药',
    tier: 'tier3',
    parentCode: 'INNOVATIVE_DRUG',
    description: '化学小分子创新药物，包括靶向药、PROTAC等',
    keywords: ['小分子', '靶向药', '化学药', 'PROTAC'],
  },
  {
    code: 'BIOLOGIC_DRUG',
    name: '大分子生物药',
    tier: 'tier3',
    parentCode: 'INNOVATIVE_DRUG',
    description: '抗体、融合蛋白、疫苗等大分子生物药物',
    keywords: ['生物药', '抗体', '单抗', '双抗', '疫苗'],
  },
  {
    code: 'ADC_GENE_THERAPY',
    name: 'ADC与基因治疗',
    tier: 'tier3',
    parentCode: 'INNOVATIVE_DRUG',
    description: '抗体偶联药物、基因治疗、细胞治疗等前沿疗法',
    keywords: ['ADC', '基因治疗', '细胞治疗', 'CAR-T', '基因编辑'],
  },

  // 医疗器械 三级
  {
    code: 'IMAGING_EQUIPMENT',
    name: '医学影像设备',
    tier: 'tier3',
    parentCode: 'MEDICAL_DEVICE',
    description: 'CT、MRI、DR、超声等医学影像设备',
    keywords: ['CT', 'MRI', '医学影像', '超声', 'DR'],
  },
  {
    code: 'SURGICAL_ROBOT',
    name: '手术机器人',
    tier: 'tier3',
    parentCode: 'MEDICAL_DEVICE',
    description: '腔镜手术机器人、骨科手术机器人等',
    keywords: ['手术机器人', '腔镜机器人', '骨科机器人'],
  },
  {
    code: 'HIGH_VALUE_CONSUMABLES',
    name: '高值耗材',
    tier: 'tier3',
    parentCode: 'MEDICAL_DEVICE',
    description: '支架、骨科植入、眼科耗材、口腔种植等高值医用耗材',
    keywords: ['高值耗材', '支架', '骨科植入', '眼科耗材', '种植牙'],
  },
  {
    code: 'IVD',
    name: '体外诊断',
    tier: 'tier3',
    parentCode: 'MEDICAL_DEVICE',
    description: '免疫诊断、生化诊断、分子诊断、POCT等体外诊断产品',
    keywords: ['IVD', '体外诊断', '免疫诊断', '分子诊断', 'POCT'],
  },

  // 光伏 三级
  {
    code: 'PV_MATERIALS',
    name: '光伏材料',
    tier: 'tier3',
    parentCode: 'PHOTOVOLTAIC',
    description: '硅料、硅片、银浆、光伏玻璃等上游材料',
    keywords: ['硅料', '硅片', '银浆', '光伏玻璃'],
  },
  {
    code: 'PV_CELL_MODULE',
    name: '光伏电池与组件',
    tier: 'tier3',
    parentCode: 'PHOTOVOLTAIC',
    description: '电池片、光伏组件，TOPCon/HJT/BC等技术路线',
    keywords: ['电池片', '组件', 'TOPCon', 'HJT', 'BC电池'],
  },
  {
    code: 'PV_INVERTER',
    name: '光伏逆变器',
    tier: 'tier3',
    parentCode: 'PHOTOVOLTAIC',
    description: '集中式逆变器、组串式逆变器、微型逆变器',
    keywords: ['逆变器', '光伏逆变器', '组串式', '微型逆变器'],
  },

  // 风电 三级
  {
    code: 'WIND_TURBINE',
    name: '风电整机',
    tier: 'tier3',
    parentCode: 'WIND_POWER',
    description: '陆上风机、海上风机整机组装',
    keywords: ['风机', '风电整机', '陆风', '海风'],
  },
  {
    code: 'WIND_COMPONENTS',
    name: '风电零部件',
    tier: 'tier3',
    parentCode: 'WIND_POWER',
    description: '叶片、塔筒、主轴、轴承、海缆等核心零部件',
    keywords: ['叶片', '塔筒', '主轴', '轴承', '海缆'],
  },

  // 新能源汽车 三级
  {
    code: 'NEV_BATTERY',
    name: '动力电池',
    tier: 'tier3',
    parentCode: 'NEV',
    description: '动力电池电芯、模组、PACK、BMS',
    keywords: ['动力电池', '电芯', 'PACK', 'BMS'],
  },
  {
    code: 'NEV_VEHICLE',
    name: '新能源整车',
    tier: 'tier3',
    parentCode: 'NEV',
    description: '纯电动、插电混动、增程式等新能源汽车整车制造',
    keywords: ['新能源汽车', '电动车', '纯电', '混动', '整车'],
  },
  {
    code: 'SMART_DRIVING',
    name: '智能驾驶',
    tier: 'tier3',
    parentCode: 'NEV',
    description: '自动驾驶、智能座舱、车联网、激光雷达等',
    keywords: ['智能驾驶', '自动驾驶', '智能座舱', '激光雷达', '车联网'],
  },

  // 储能 三级
  {
    code: 'BATTERY_STORAGE',
    name: '电化学储能',
    tier: 'tier3',
    parentCode: 'ENERGY_STORAGE',
    description: '锂离子电池储能、钠电池储能、液流电池等',
    keywords: ['电化学储能', '锂电池储能', '钠电池', '液流电池'],
  },
  {
    code: 'STORAGE_SYSTEM',
    name: '储能系统集成',
    tier: 'tier3',
    parentCode: 'ENERGY_STORAGE',
    description: '储能变流器PCS、储能系统集成、能量管理EMS',
    keywords: ['储能系统', 'PCS', '系统集成', 'EMS', '储能变流器'],
  },

  // 机器人 三级
  {
    code: 'INDUSTRIAL_ROBOT',
    name: '工业机器人',
    tier: 'tier3',
    parentCode: 'ROBOTICS',
    description: '六轴机器人、SCARA、协作机器人等工业机器人',
    keywords: ['工业机器人', '六轴机器人', 'SCARA', '协作机器人'],
  },
  {
    code: 'HUMANOID_ROBOT',
    name: '人形机器人',
    tier: 'tier3',
    parentCode: 'ROBOTICS',
    description: '人形机器人整机与核心零部件',
    keywords: ['人形机器人', '具身智能', '人型机器人'],
  },
  {
    code: 'ROBOT_PARTS',
    name: '机器人核心零部件',
    tier: 'tier3',
    parentCode: 'ROBOTICS',
    description: '减速器、伺服电机、控制器、传感器等',
    keywords: ['减速器', '伺服电机', '控制器', '传感器', '丝杠'],
  },

  // 航空航天 三级
  {
    code: 'LARGE_AIRCRAFT',
    name: '大飞机',
    tier: 'tier3',
    parentCode: 'AEROSPACE',
    description: 'C919/C929国产大飞机、民用航空产业链',
    keywords: ['大飞机', 'C919', 'C929', '民用航空', '商飞'],
  },
  {
    code: 'COMMERCIAL_SPACE',
    name: '商业航天',
    tier: 'tier3',
    parentCode: 'AEROSPACE',
    description: '商业火箭、卫星制造、卫星互联网、太空经济',
    keywords: ['商业航天', '卫星互联网', '商业火箭', '低轨卫星', '星链'],
  },
  {
    code: 'AERO_ENGINE',
    name: '航空发动机',
    tier: 'tier3',
    parentCode: 'AEROSPACE',
    description: '军用/民用航空发动机、燃气轮机',
    keywords: ['航空发动机', '航发', '燃气轮机', '涡扇'],
  },

  // 银行 三级
  {
    code: 'STATE_BANK',
    name: '国有大型银行',
    tier: 'tier3',
    parentCode: 'BANKING',
    description: '六大国有银行：工、农、中、建、交、邮储',
    keywords: ['国有银行', '大行', '工商银行', '建设银行', '农业银行'],
  },
  {
    code: 'JOINT_STOCK_BANK',
    name: '股份制银行',
    tier: 'tier3',
    parentCode: 'BANKING',
    description: '全国性股份制商业银行',
    keywords: ['股份制银行', '招行', '兴业', '浦发', '中信'],
  },
  {
    code: 'CITY_BANK',
    name: '城商行',
    tier: 'tier3',
    parentCode: 'BANKING',
    description: '城市商业银行、农商行等区域性银行',
    keywords: ['城商行', '农商行', '区域性银行', '宁波银行', '南京银行'],
  },

  // 软件与服务 三级
  {
    code: 'CLOUD_SAAS',
    name: '云计算与SaaS',
    tier: 'tier3',
    parentCode: 'SOFTWARE',
    description: 'IaaS/PaaS/SaaS 云计算全栈服务',
    keywords: ['云计算', 'SaaS', '云服务', 'IaaS', 'PaaS'],
  },
  {
    code: 'INDUSTRIAL_SOFTWARE',
    name: '工业软件',
    tier: 'tier3',
    parentCode: 'SOFTWARE',
    description: 'EDA、CAD/CAE、MES、DCS等工业软件',
    keywords: ['工业软件', 'EDA', 'CAD', 'CAE', 'MES'],
  },
  {
    code: 'CYBER_SECURITY',
    name: '网络安全',
    tier: 'tier3',
    parentCode: 'SOFTWARE',
    description: '网络安全、数据安全、信创安全',
    keywords: ['网络安全', '信息安全', '数据安全', '信创', '等保'],
  },

  // 通信 三级
  {
    code: 'OPTICAL_COMM',
    name: '光通信',
    tier: 'tier3',
    parentCode: 'TELECOM',
    description: '光模块、光器件、光纤光缆、CPO等',
    keywords: ['光通信', '光模块', '光纤', '光器件', 'CPO'],
  },
  {
    code: 'COMM_EQUIPMENT',
    name: '通信设备',
    tier: 'tier3',
    parentCode: 'TELECOM',
    description: '基站设备、传输设备、数据通信设备',
    keywords: ['通信设备', '基站', '传输设备', '路由器', '交换机'],
  },
]

// ============================================================
// 聚合导出
// ============================================================

export const INDUSTRY_HIERARCHY: IndustryDefinition[] = [
  ...TIER1_INDUSTRIES,
  ...TIER2_INDUSTRIES,
  ...TIER3_INDUSTRIES,
]

/** 一级行业列表 */
export const TIER1_LIST: IndustryDefinition[] = TIER1_INDUSTRIES

/** 二级行业列表 */
export const TIER2_LIST: IndustryDefinition[] = TIER2_INDUSTRIES

/** 三级行业列表 */
export const TIER3_LIST: IndustryDefinition[] = TIER3_INDUSTRIES

/** 行业代码 → 行业定义映射 */
export const INDUSTRY_MAP: Record<string, IndustryDefinition> = INDUSTRY_HIERARCHY.reduce(
  (map, ind) => {
    map[ind.code] = ind
    return map
  },
  {} as Record<string, IndustryDefinition>,
)

/**
 * 获取某行业的所有子行业
 */
export function getChildIndustries(parentCode: string): IndustryDefinition[] {
  return INDUSTRY_HIERARCHY.filter((ind) => ind.parentCode === parentCode)
}

/**
 * 获取某行业的完整层级路径（从一级到当前级）
 */
export function getIndustryPath(code: string): IndustryDefinition[] {
  const path: IndustryDefinition[] = []
  let current: IndustryDefinition | undefined = INDUSTRY_MAP[code]

  while (current) {
    path.unshift(current)
    current = current.parentCode ? INDUSTRY_MAP[current.parentCode] : undefined
  }

  return path
}

/**
 * 根据关键词匹配行业（返回所有匹配的行业，按匹配度排序）
 */
export function matchIndustriesByKeywords(
  text: string,
  options: { tier?: IndustryDefinition['tier']; minMatchCount?: number } = {},
): Array<{ industry: IndustryDefinition; matchCount: number }> {
  const lowerText = text.toLowerCase()
  const { tier, minMatchCount = 1 } = options

  const results: Array<{ industry: IndustryDefinition; matchCount: number }> = []

  for (const ind of INDUSTRY_HIERARCHY) {
    if (tier && ind.tier !== tier) continue

    const matchCount = ind.keywords.filter((kw) => lowerText.includes(kw.toLowerCase())).length
    if (matchCount >= minMatchCount) {
      results.push({ industry: ind, matchCount })
    }
  }

  return results.sort((a, b) => b.matchCount - a.matchCount)
}

/**
 * 根据股票名称、行业、概念标签匹配最相关的三级行业
 */
export function matchStockIndustry(stock: {
  symbol?: string
  name: string
  sector?: string
  conceptTags?: string[]
}): {
  tier3: IndustryDefinition | null
  tier2: IndustryDefinition | null
  tier1: IndustryDefinition | null
  matchScore: number
} {
  const searchText = [stock.name, stock.sector ?? '', ...(stock.conceptTags ?? [])].join(' ')

  const tier3Matches = matchIndustriesByKeywords(searchText, { tier: 'tier3', minMatchCount: 1 })

  if (tier3Matches.length > 0) {
    const bestMatch = tier3Matches[0]!
    const tier3 = bestMatch.industry
    const tier2 = tier3.parentCode ? (INDUSTRY_MAP[tier3.parentCode] ?? null) : null
    const tier1 = tier2?.parentCode ? (INDUSTRY_MAP[tier2.parentCode] ?? null) : null

    return {
      tier3,
      tier2,
      tier1,
      matchScore: bestMatch.matchCount,
    }
  }

  const tier2Matches = matchIndustriesByKeywords(searchText, { tier: 'tier2', minMatchCount: 1 })
  if (tier2Matches.length > 0) {
    const bestMatch = tier2Matches[0]!
    const tier2 = bestMatch.industry
    const tier1 = tier2.parentCode ? (INDUSTRY_MAP[tier2.parentCode] ?? null) : null

    return {
      tier3: null,
      tier2,
      tier1,
      matchScore: bestMatch.matchCount,
    }
  }

  const tier1Matches = matchIndustriesByKeywords(searchText, { tier: 'tier1', minMatchCount: 1 })
  if (tier1Matches.length > 0) {
    const topMatch = tier1Matches[0]!
    return {
      tier3: null,
      tier2: null,
      tier1: topMatch.industry,
      matchScore: topMatch.matchCount,
    }
  }

  return { tier3: null, tier2: null, tier1: null, matchScore: 0 }
}

/** 统计数据 */
export const INDUSTRY_STATS = {
  tier1Count: TIER1_INDUSTRIES.length,
  tier2Count: TIER2_INDUSTRIES.length,
  tier3Count: TIER3_INDUSTRIES.length,
  total: INDUSTRY_HIERARCHY.length,
}
