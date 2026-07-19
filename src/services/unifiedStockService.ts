/**
 * @module services/unifiedStockService
 * @description 统一股票数据融合服务入口
 *
 * 原实现已抽取至 services/useCase/getUnifiedStockView.useCase。
 * 本文件保留为兼容 facade，新代码请直接从 UseCase 模块导入。
 *
 * @deprecated 请优先使用 services/useCase/getUnifiedStockView.useCase
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

export {
  getUnifiedStockViewUseCase as getUnifiedStockView,
  getUnifiedStockViewsUseCase as getUnifiedStockViews,
  getUnifiedStockViewsByStatusUseCase as getUnifiedStockViewsByStatus,
  getScoreViewUseCase as getScoreView,
  getTradingViewUseCase as getTradingView,
} from '@/services/useCase/getUnifiedStockView.useCase'

export type {
  UnifiedStockView,
  FusionOptions,
} from '@/services/useCase/getUnifiedStockView.useCase'
