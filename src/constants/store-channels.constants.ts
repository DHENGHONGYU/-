/**
 * Store 与 Channel 名称常量
 *
 * @description
 * 集中管理 V9 项目中跨模块复用的 channel、store、event 名称字面量，
 * 避免散落在各处的字符串不一致。所有数据流广播/订阅必须引用此处的常量。
 *
 * @module constants/store-channels
 * @created 2026-06-30 - G1 批次低风险优化（重复字面量提取）
/**
 * EventBus 事件命名常量
  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/
export const EVENT_NAMES = {
  STOCKS_CHANGED: 'stocks:changed',
  ORDERS_CHANGED: 'orders:changed',
  SIGNALS_CHANGED: 'signals:changed',
  V6_SCORES_CHANGED: 'v6_scores:changed',
  HOT_SECTOR_CHANGED: 'strategy:hotSectorChanged',
  VALUE_PIT_CHANGED: 'strategy:valuePitChanged',
  ROTATION_SIGNAL_TRIGGERED: 'strategy:rotationSignalTriggered',
  // ---- D-3 批次新增：Store 写操作广播 ----
  /** 股票池数据变更（poolStore 写操作触发） */
  POOL_CHANGED: 'pool:changed',
  /** 分析评分变更（analysisStore 写操作触发） */
  SCORES_CHANGED: 'scores:changed',
  /** 持仓数据变更（holdingsStore / positionStore 写操作触发） */
  HOLDINGS_CHANGED: 'holdings:changed',
  /** 智能评分变更（intelligentScoreStore 写操作触发） */
  INTELLIGENT_SCORES_CHANGED: 'intelligent_scores:changed',
  /** 行业评分变更（industryScoreStore 写操作触发） */
  INDUSTRY_SCORES_CHANGED: 'industry_scores:changed',
  /** 策略快照变更（strategySnapshotStore 写操作触发） */
  STRATEGY_SNAPSHOTS_CHANGED: 'strategy_snapshots:changed',
  // ---- D-3 批次扩展：其余 Store 写操作广播 ----
  /** 采集测试数据变更（dataTestStore 写操作触发） */
  DATA_TEST_CHANGED: 'data_test:changed',
  /** 双策略数据变更（dualStrategyStore 写操作触发） */
  DUAL_STRATEGY_CHANGED: 'dual_strategy:changed',
  /** 板块分析数据变更（sectorAnalysisStore 写操作触发） */
  SECTOR_ANALYSIS_CHANGED: 'sector_analysis:changed',
  /** 风控数据变更（riskStore 写操作触发） */
  RISK_CHANGED: 'risk:changed',
  /** 信号质量数据变更（signalQualityStore 写操作触发） */
  SIGNAL_QUALITY_CHANGED: 'signal_quality:changed',
  /** 市场数据变更（marketDataStore 写操作触发） */
  MARKET_DATA_CHANGED: 'market_data:changed',
  /** 交易纪律数据变更（disciplineStore 写操作触发） */
  DISCIPLINE_CHANGED: 'discipline:changed',
  /** 回测数据变更（backtestStore 写操作触发） */
  BACKTEST_CHANGED: 'backtest:changed',
  /** 评分文档数据变更（scoreDocStore 写操作触发） */
  SCORE_DOCS_CHANGED: 'score_docs:changed',
  /** 分析结果变更（analysisOrchestratorStore 写操作触发） */
  ANALYSIS_RESULT_CHANGED: 'analysis_result:changed',
  // ---- DataFlow 引擎事件 ----
  /** 数据流连接成功 */
  DATAFLOW_CONNECTED: 'dataflow:connected',
  /** 数据流断开 */
  DATAFLOW_DISCONNECTED: 'dataflow:disconnected',
  /** 数据包发布 */
  DATAFLOW_PACKET_PUBLISHED: 'dataflow:packetPublished',
  // ---- G1 批次扩展：引擎 Store 写操作广播 ----
  /** 引擎启动状态变更（engineStore.setStarted 触发） */
  ENGINE_STARTED_CHANGED: 'ENGINE_STORE_STARTED_CHANGED',
  // ---- 数据采集向导事件 ----
  /** 采集向导状态变更（collectionWizardStore 写操作触发） */
  COLLECTION_WIZARD_CHANGED: 'collection_wizard:changed',
  // ---- 投研闭环状态事件 ----
  /** 闭环阶段状态变更（loopStatusStore 写操作触发） */
  LOOP_STATUS_CHANGED: 'loop_status:changed',
  // ---- 批量导入事件 ----
  /** 批量导入状态变更（bulkImportStore 写操作触发） */
  BULK_IMPORT_CHANGED: 'bulk_import:changed',
  // ---- 编排器事件（Orchestration Layer） ----
  /** 注册编排器：采集启动 */
  REGISTRATION_COLLECT_START: 'registration:collect:start',
  /** 注册编排器：采集完成 */
  REGISTRATION_COLLECT_COMPLETE: 'registration:collect:complete',
  /** 质量门禁：检查通过 */
  QUALITY_GATE_PASSED: 'quality:gate:passed',
  /** 质量门禁：检查失败 */
  QUALITY_GATE_FAILED: 'quality:gate:failed',
  /** 质量门禁：检查结果（通过/失败均发射） */
  QUALITY_GATE_CHECKED: 'quality:gate:checked',
  /** 评分校对器：单只完成 */
  SCORE_CALIBRATOR_ITEM: 'score:calibrator:item',
  /** 评分校对器：全部完成 */
  SCORE_CALIBRATOR_COMPLETED: 'score:calibrator:completed',
  /** 策略分层：开始 */
  STRATEGY_CLASSIFICATION_START: 'strategy:classification:start',
  /** 策略分层：完成 */
  STRATEGY_CLASSIFICATION_DONE: 'strategy:classification:done',
  /** 策略分层：错误 */
  STRATEGY_CLASSIFICATION_ERROR: 'strategy:classification:error',
  /** 分析：行业分析完成 */
  ANALYSIS_INDUSTRY_COMPLETED: 'analysis:industry:completed',
  /** 分�