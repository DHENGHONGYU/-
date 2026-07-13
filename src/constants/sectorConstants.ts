/**
 * @module sectorConstants
 * @description 板块相关常量定义
 *
 * 从 data/sectorSkillData.ts 迁移而来，解决跨层违规问题。
 * pages 层禁止直接导入 data 层，通过 constants 层中转。
 *
 * @migration 2026-07-06 跨层违规修复：pages 层禁止直接导入 data 层
 * @compliance AGENTS.md §一 分层规则：constants 层禁止依赖任何运行时模块
/**
 * 热门赛道标签列表
 *
 * 用于板块分析、热点追踪、市场情绪展示等场景。
 *
 * 热力等级说明（heat）：
 * - 5 级：高热度，市场关注度极高，资金流入明显
 * - 4 级：中高热度，有持续话题性和政策催化
 * - 3 级：中等热度，长期赛道，稳步发展
 *
 * 板块代码映射：
 * | 代码 | 板块名称 | 说明 |
 * |------|---------|------|
 * | AI | 人工智能 | AI 推理芯片、大模型应用 |
 * | NEV | 新能源汽车 | 智能驾驶、动力电池 |
 * | ROBOT | 机器人 | 人形机器人、精密减速器 |
 * | QUANTUM | 量子科技 | 量子通信 |
 * | NEV_PV | 新能源光伏 | 储能系统 |
 * | IC | 集成电路 | 半导体设备 |
 * | LOWALT | 低空经济 | eVTOL（电动垂直起降） |
 * | AERO | 航空航天 | 卫星互联网 |
 * | BIOTECH | 生物科技 | 创新药 |
 * | MAT | 新材料 | 碳纤维 |
 * | DIGITAL | 数字经济 | 工业软件 |
 *
 * @typedef {Object} HotTrack
 * @property {string} sector - 板块代码
 * @property {string} track - 赛道名称
 * @property {number} heat - 热力等级（1-5）
 */
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
