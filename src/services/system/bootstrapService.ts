/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { dataBridge } from '@/core/databridge'
import { initPWA } from '@/services/pwa/registerServiceWorker'
import { permissionRevocationService } from '@/services/rbac/permissionRevocationService'
import { seedDefaultStocks } from '@/services/system/seedService'
import { getLogger } from '@/lib/logger'
import { initOrchestration, stopOrchestration } from '@/services/orchestration'
import { isLlmApiKeyConfigured } from '@/config/llmConfig'
import {
  isTushareTokenConfigured,
  isQwenApiKeyConfigured,
  isTushareTokenExpired,
  isQwenApiKeyExpired,
  getTushareTokenAgeDays,
  getQwenApiKeyAgeDays,
  type SecretHealthItem,
} from '@/config/secretConfig'

const logger = getLogger()

/**
 * 应用启动初始化服务。
 *
 * 职责：集中管理 L1/L2 基础设施的启动顺序，避免 L5/L4 入口组件直接操作数据层。
 * 初始化链路：IndexedDB → PWA Service Worker → RBAC 权限回收定时任务 → 安全配置检查 → 种子数据
 *
 * 注：全局信号订阅由应用入口 main.tsx 直接初始化，避免 services 层直接依赖 store 层。
 */
export async function initializeApp(): Promise<void> {
  await dataBridge.init()
  logger.info('[bootstrapService] IndexedDB initialized via DataBridge')

  // PWA Service Worker 注册（仅生产环境生效）
  initPWA()
  logger.info('[bootstrapService] PWA initialization triggered')

  // RBAC 权限自动回收服务（僵尸账号检测 + 过期权限回收）
  // 必须晚于 db.init()，因服务经 dataBridge.query 访问 IndexedDB
  permissionRevocationService.start()
  logger.info('[bootstrapService] RBAC permission revocation service started')

  // 安全配置引导：检测未配置或已过期的密钥，输出引导日志
  checkSecretHealth()

  // 种子数据：首次启动时导入默认股票列表
  // GATE-ASYNC-1: 禁止裸 void asyncFn()，必须有 .catch()
  seedDefaultStocks().catch((err) => {
    logger.error('[bootstrapService] 种子数据初始化失败', {
      error: err instanceof Error ? err.message : String(err),
    })
  })

  // 编排器服务：在种子数据之后启动，确保数据采集链路就绪
  // 包含10个编排器：RegistrationOrchestrator → QualityGate → ScoreCalibrator
  // 以及 CatalystTracker / WatchListTrigger / StrategyReportGenerator 等
  try {
    initOrchestration()
    logger.info('[bootstrapService] 编排器服务启动成功')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[bootstrapService] 编排器服务启动失败', { error: message })
  }
}

/**
 * 安全配置健康检查。
 * 启动时扫描所有密钥，对未配置 / 已过期的情况输出引导日志。
 * 不阻塞启动流程，仅做 console.warn 提示。
 */
function checkSecretHealth(): void {
  const checks: SecretHealthItem[] = [
    {
      name: '主 LLM API Key',
      configured: isLlmApiKeyConfigured(),
      expired: false, // 主 LLM Key 暂无 TTL 机制
      ageDays: 0,
      daysSinceVerification: -1,
    },
    {
      name: 'Tushare Token',
      configured: isTushareTokenConfigured(),
      expired: isTushareTokenExpired(),
      ageDays: getTushareTokenAgeDays(),
      daysSinceVerification: -1,
    },
    {
      name: 'Qwen API Key',
      configured: isQwenApiKeyConfigured(),
      expired: isQwenApiKeyExpired(),
      ageDays: getQwenApiKeyAgeDays(),
      daysSinceVerification: -1,
    },
  ]

  for (const item of checks) {
    if (!item.configured) {
      logger.warn(
        `[bootstrapService][安全配置] ${item.name} 未配置。` +
          '请在「系统设置 → 密钥管理」中配置，以启用完整功能。',
      )
    } else if (item.expired) {
      logger.warn(
        `[bootstrapService][安全配置] ${item.name} 已超过 ${item.ageDays} 天未轮换。` +
          '建议在「系统设置 → 密钥管理」中更新密钥以保障安全。',
      )
    }
  }

  const allConfigured = checks.every((c) => c.configured)
  if (allConfigured) {
    logger.info('[bootstrapService][安全配置] 所有密钥已配置，安全检查通过')
  }
}

/**
 * 应用关闭/热更新时的清理钩子。
 * 停止所有后台定时任务以防止内存泄漏或重复执行。
 */
export function shutdownApp(): void {
  stopOrchestration()
  logger.info('[bootstrapService] 编排器服务已停止')
  permissionRevocationService.stop()
  logger.info('[bootstrapService] RBAC permission revocation service stopped')
}
