/**
 * @module sectorConstants
 * @description 板块相关常量定义（从 data/sectorSkillData.ts 迁移）
 * @migration 2026-07-06 跨层违规修复：pages 层禁止直接导入 data 层
 */

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
