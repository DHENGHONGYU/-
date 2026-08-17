import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setLogLevel, getLogger } from '@/lib/logger'
import App from './App'
import { installGlobalErrorHandler } from '@/components/organisms/shared/installGlobalErrorHandler'
// 提前导入并初始化 themeStore，确保在 React 首屏渲染前应用持久化主题
import { useThemeStore } from '@/store/themeStore'
import { verifyDesignTokensOnReady } from '@/lib/designTokenVerifier'
import './index.css'

// V5 Apple Business Design Tokens 加载验证（仅开发环境，生产构建 tree-shake 移除）
verifyDesignTokensOnReady()

useThemeStore.getState()

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const LOG_LEVEL = (import.meta.env.VITE_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'

setLogLevel(LOG_LEVEL)

const logger = getLogger()

async function bootstrap(): Promise<void> {
  try {
    logger.info('[main] 开始应用启动流程')

    installGlobalErrorHandler()

    // V12: 并行加载所有 service 模块，消除串行 await 链
    const [
      { setStrategyAnalyzers },
      { setFeedbackServices },
      { setPipelineServices },
      { setScoreTriggerServices, scoreAutoTrigger },
      { setIndustryAnalysisServices },
      {
        runFullIndustryAnalysis,
        getStockIndustryV4Analysis,
        invalidateIndustryCache,
        v4ToIndustryScoreData,
        runFullIndustryAnalysisEnhanced,
        getStockIndustryV4AnalysisEnhanced,
      },
      { analyze: analyzeHotSector },
      { detect: detectRotation },
      { analyze: analyzeValuePit },
      { runV6Score, getV6ScoreQuality },
      { fetchStockBasic, fetchStockKline, fetchFinancial },
    ] = await Promise.all([
      import('@/core/databridgeStrategyRouter'),
      import('@/core/feedbackOrchestrator'),
      import('@/core/pipelineScheduler'),
      import('@/services/scoring/scoreAutoTrigger'),
      import('@/services/scoring/v6ScoreService'),
      import('@/services/analysis/industryAnalysisService'),
      import('@/services/scoring/hotSectorAnalyzer'),
      import('@/services/scoring/rotationSignalDetector'),
      import('@/services/scoring/valuePitAnalyzer'),
      import('@/services/scoring/v6ScoreService'), // 同一模块，第二次 import 从缓存解析
      import('@/services/fetcher/fetcherService'),
    ])

    setStrategyAnalyzers({
      analyzeHotSector,
      detectRotation,
      analyzeValuePit,
    })

    setFeedbackServices({
      runV6Score,
      getV6ScoreQuality,
      fetchStockBasic,
      fetchStockKline,
      fetchFinancial,
    })

    setPipelineServices({
      runV6Score,
    })

    setScoreTriggerServices({ runV6Score })
    scoreAutoTrigger.start()

    // v2.9.0: 行业分析服务注入
    setIndustryAnalysisServices({
      runFullIndustryAnalysis,
      getStockIndustryV4Analysis,
      invalidateIndustryCache,
      v4ToIndustryScoreData,
      // v2.9.5 增强版
      runFullIndustryAnalysisEnhanced,
      getStockIndustryV4AnalysisEnhanced,
    })

    logger.info('[main] Core 层服务注册完成')

    const rootElement = document.getElementById('root')
    if (!rootElement) {
      throw new Error('Root element not found')
    }

    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    logger.info('[main] 应用启动完成')
  } catch (error) {
    logger.error('[main] 应用启动失败', { error })
    throw error
  }
}

void bootstrap()
