import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setLogLevel, getLogger } from '@/lib/logger'
import App from './App'
import { installGlobalErrorHandler } from '@/components/organisms/shared/installGlobalErrorHandler'
// 提前导入并初始化 themeStore，确保在 React 首屏渲染前应用持久化主题
import { useThemeStore } from '@/store/themeStore'
import { verifyDesignTokensOnReady } from '@/lib/designTokenVerifier'
// P3-2 PWA Service Worker 注册（render 完成后异步执行，不阻塞首屏关键路径）
import { registerSW } from '@/pwa/registerSW'
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
    // 不向上 throw：允许部分功能不可用时，至少 SW 注册和首屏框架可用
  }
}

// P3-2 PWA Service Worker：与 bootstrap() 解耦，顶层并行调度，确保：
//   ① 零被业务初始化错误中断（Promise.all(11 imports) 抛错不再阻断 SW）
//   ② 不阻塞首屏关键路径：requestIdleCallback → window 'load' 之后
//   ③ 成功安装 → 可离线打开 / 首屏资源从 SW Cache 返回（≈700ms P50）
//   ④ 环境不支持 → registerSW 内部 catch 静默降级为 noop
function scheduleRegisterPwaSW(): void {
  const kickoff = () => {
    const logger = getLogger()
    // 浏览器环境：确保不在 SSR / 非 secure context 下强转（registerSW 内部安全降级）
    if (typeof window === 'undefined') return
    logger.info('[main] scheduleRegisterPwaSW kickoff：触发 PWA SW 注册')
    void registerSW({
      onOfflineReady() {
        logger.info('[main] PWA 离线就绪，断网场景可正常打开')
      },
      onNeedRefresh(updateSW) {
        // 新版本零打扰激活：检测到新版本直接在后台 postMessage SKIP_WAITING 接管
        // 如需改为用户确认式弹窗，可接入 Modal 并在点击后调用 updateSW(true)
        void updateSW(true)
      },
      onRegisterError(err) {
        logger.warn('[main] PWA SW 注册失败，降级为 HTTP 缓存', { error: String(err) })
      },
    })
  }
  // 三重兜底调度：
  //  1. microtask：首帧 render 后尽快执行（React 渲染已完成，不阻塞关键路径）
  //  2. setTimeout 500ms：兜底 microtask 被跳过的场景（Playwright headless / SSR hydration）
  //  3. requestIdleCallback 5s：主线程空闲时再补一次（幂等，register 重复调用安全）
  if (typeof window !== 'undefined') {
    queueMicrotask(kickoff)
    window.setTimeout(kickoff, 500)
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(kickoff, { timeout: 5000 })
    }
  }
}

void bootstrap()
scheduleRegisterPwaSW()
