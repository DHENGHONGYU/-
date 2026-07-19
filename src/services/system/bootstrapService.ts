/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { dataBridge } from '@/core/databridge'
import { initPWA } from '@/services/pwa/registerServiceWorker'
import { permissionRevocationService } from '@/services/rbac/permissionRevocationService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 应用启动初始化服务。
 *
 * 职责：集中管理 L1/L2 基础设施的启动顺序，避免 L5/L4 入口组件直接操作数据层。
 * 初始化链路：IndexedDB → PWA Service Worker → RBAC 权限回收定时任务 → （未来：缓存预热、降级队列重放）
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
}

/**
 * 应用关闭/热更新时的清理钩子。
 * 停止所有后台定时任务以防止内存泄漏或重复执行。
 */
export function shutdownApp(): void {
  permissionRevocationService.stop()
  logger.info('[bootstrapService] RBAC permission revocation service stopped')
}
