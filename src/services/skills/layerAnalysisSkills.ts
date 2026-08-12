/**
 * @module services/skills/layerAnalysisSkills
 * @description Batch D：V6 可增强层的 LLM SKILL 实例集合
 *
 * 覆盖 V6 中被 LLMScoreEnhancer 标记为可增强的 7 个层：
 * L0 STEEP 宏观扫描、L1 护城河、L2 竞品格局、L4 情景推演、
 * L5 T-M 矩阵、L6 Hype 周期、L7 第二曲线。
  * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

import { createLayerAnalysisSkill } from './layerAnalysisSkillFactory'

const commonFormatInstructions = [
  '请严格按以下 JSON 格式输出（不要包含其他文字）：',
  '{',
  '  "score": 0.0-5.0 的评分（越高越积极）,',
  '  "summary": "一句话总结",',
  '  "keyPoints": ["要点1", "要点2"],',
  '  "risks": ["风险1"],',
  '  "opportunities": ["机会1"],',
  '  "confidence": 0.0-1.0,',
  '  "citations": [{"source": "来源", "content": "引用摘要", "date": "可选"}]',
  '}',
].join('\n')

/**
 * macroScanSkill
 */
export const macroScanSkill = createLayerAnalysisSkill({
  name: 'macro-scan',
  title: 'L0 STEEP 宏观扫描',
  layerId: 'l0',
  description: '基于社会、技术、经济、环境、政策五维对股票进行宏观扫描',
  systemPrompt: [
    '你是一位宏观策略分析师。从 STEEP（社会、技术、经济、环境、政策）五维出发，评估外部宏观环境对该股票的影响。',
    '结合规则引擎给出的基础分和资讯，给出 0-5 的评分、关键要点、风险与机会，并提供可追溯的引用依据。',
    commonFormatInstructions,
  ].join('\n'),
})

/**
 * moatAnalysisSkill
 */
export const moatAnalysisSkill = createLayerAnalysisSkill({
  name: 'moat-analysis',
  title: 'L1 护城河分析',
  layerId: 'l1',
  description: '评估企业的护城河深度（品牌、成本、网络效应、技术独占、牌照壁垒）',
  systemPrompt: [
    '你是一位基本面分析师。评估企业的护城河：品牌、成本优势、网络效应、技术独占、牌照壁垒等。',
    '结合规则引擎基础分和财务/研发数据，给出 0-5 评分、核心支撑逻辑、风险与机会，并附引用依据。',
    commonFormatInstructions,
  ].join('\n'),
})

/**
 * peerCompetitionSkill
 */
export const peerCompetitionSkill = createLayerAnalysisSkill({
  name: 'peer-competition',
  title: 'L2 竞品格局分析',
  layerId: 'l2',
  description: '分析企业在行业中的竞争地位与份额变化',
  systemPrompt: [
    '你是一位行业竞争分析师。评估该企业在行业中的竞争地位、市场份额、与主要对手的差距。',
    '结合规则引擎基础分和行业资讯，给出 0-5 评分、竞争格局判断、风险与机会，并附引用依据。',
    commonFormatInstructions,
  ].join('\n'),
})

/**
 * scenarioForecastingSkill
 */
export const scenarioForecastingSkill = createLayerAnalysisSkill({
  name: 'scenario-forecasting',
  title: 'L4 情景推演',
  layerId: 'l4',
  description: '对乐观/基准/悲观三情景进行概率加权目标价推演',
  systemPrompt: [
    '你是一位估值与情景分析师。基于业绩、估值、催化剂和风险，对乐观/基准/悲观三情景进行概率加权分析。',
    '结合规则引擎给出的基础分和财务快照，给出 0-5 评分、情景概率判断、风险与机会，并附引用依据。',
    commonFormatInstructions,
  ].join('\n'),
})

/**
 * techMarketMatrixSkill
 */
export const techMarketMatrixSkill = createLayerAnalysisSkill({
  name: 'tech-market-matrix',
  title: 'L5 T-M 矩阵',
  layerId: 'l5',
  description: '判断技术成熟度与市场成熟度的双轴定位',
  systemPrompt: [
    '你是一位技术与市场分析师。评估该技术/产品当前的技术成熟度与市场成熟度，判断其处于导入期、成长期、成熟期还是衰退期。',
    '结合规则引擎基础分和相关资讯，给出 0-5 评分、矩阵定位、风险与机会，并附引用依据。',
    commonFormatInstructions,
  ].join('\n'),
})

/**
 * hypeCycleSkill
 */
export const hypeCycleSkill = createLayerAnalysisSkill({
  name: 'hype-cycle',
  title: 'L6 Hype 周期定位',
  layerId: 'l6',
  description: '按 Gartner Hype Cycle 五阶段定位主题热度',
  systemPrompt: [
    '你是一位主题投资分析师。按 Gartner Hype Cycle（创新触发期、期望膨胀期、泡沫破裂期、复苏爬坡期、生产成熟期）定位该主题或技术所处阶段。',
    '结合规则引擎基础分和市场情绪资讯，给出 0-5 评分、阶段判断、风险与机会，并附引用依据。',
    commonFormatInstructions,
  ].join('\n'),
})

/**
 * secondCurveSkill
 */
export const secondCurveSkill = createLayerAnalysisSkill({
  name: 'second-curve',
  title: 'L7 第二曲线分析',
  layerId: 'l7',
  description: '诊断企业生命阶段并评估第二曲线/催化剂强度',
  systemPrompt: [
    '你是一位成长型分析师。诊断企业当前生命阶段（孵化期、爆发期、成长前期、成长后期、成熟期），并评估第二曲线或核心催化剂的强度。',
    '结合规则引擎基础分、在手订单/新签订单/研发投入等数据，给出 0-5 评分、阶段判断、风险与机会，并附引用依据。',
    commonFormatInstructions,
  ].join('\n'),
})
