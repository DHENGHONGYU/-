/**
 * PWA Service Worker 注册器（vite-plugin-pwa 生成 sw.js，原生注册，不依赖 virtual:pwa-register）
 *
 * 设计：
 *  - vite.config.ts 中 VitePWA workbox.generateSW 负责构建 sw.js + precache 清单 + runtimeCaching；
 *    本模块仅用原生 navigator.serviceWorker.register('/sw.js') 执行注册，消除「虚拟模块动态导入失败」的不确定性。
 *  - 激活策略：skipWaiting=true（VitePWA 配置）+ register 时监听 updatefound/install/statechange：
 *      · 首次安装 → onOfflineReady（离线就绪）
 *      · 新版本到达（waiting SW）→ onNeedRefresh，由调用方决定是否调用 updateSW(true) 立即接管
 *  - 兼容回退：非 HTTPS 且非 localhost / 旧浏览器无 ServiceWorker → 返回安全 noop，调用方零改动。
 *  - 副作用安全：main.tsx 在首屏渲染完成后由 requestIdleCallback 调度，不阻塞关键路径。
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

export interface PwaRegisterCallbacks {
  /** SW 首次激活成功（离线可用），可用于 toast 提示「已缓存，断网可打开」 */
  onOfflineReady?: () => void
  /** 检测到新版本 waiting SW，可用于弹 UI：「有新版本，立即重启？」 */
  onNeedRefresh?: (updateSW: (reloadPage?: boolean) => Promise<void>) => void
  /** Service Worker registration 成功（每次命中） */
  onRegistered?: (registration: ServiceWorkerRegistration) => void
  /** 注册失败（降级为纯 HTTP 缓存） */
  onRegisterError?: (error: Error) => void
}

type PwaRegisterResult = {
  /** 手动触发更新激活；传 true → 激活后强制 reload，false → 仅激活，下次导航生效 */
  updateSW: (reloadPage?: boolean) => Promise<void>
  /** 本次启动是否离线就绪（首次激活成功后） */
  offlineReady: boolean
  /** 本次启动是否检测到新版本等待激活（waiting SW） */
  needRefresh: boolean
}

/** 对 waiting worker 发送 SKIP_WAITING（与 sw.js 内部的 message listener 匹配） */
async function activateWaiting(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.waiting || registration.installing
  if (!worker) return
  const channel = 'MessageChannel' in window ? new MessageChannel() : null
  return new Promise<void>((resolve) => {
    const next = registration.installing ?? registration.waiting
    if (!next) {
      resolve()
      return
    }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    // 用 statechange 监听 worker 变成 activated（即 skipWaiting 生效）
    const onStateChange = () => {
      if (next.state === 'redundant') {
        next.removeEventListener('statechange', onStateChange)
        finish()
      } else if (next.state === 'activated') {
        next.removeEventListener('statechange', onStateChange)
        finish()
      }
    }
    next.addEventListener('statechange', onStateChange)
    // 兜底 8 秒：超时也 resolve，避免阻塞 UI reload 决策
    window.setTimeout(finish, 8000)
    try {
      if (channel) {
        channel.port1.onmessage = () => finish()
        next.postMessage({ type: 'SKIP_WAITING' }, [channel.port2])
      } else {
        next.postMessage({ type: 'SKIP_WAITING' })
      }
    } catch (e) {
      logger.warn('[pwa] 向 waiting SW 发送 SKIP_WAITING 失败', { error: String(e) })
      finish()
    }
  })
}

/**
 * 主入口：注册 PWA Service Worker。
 * 不阻塞首屏，推荐在 React render 完成后由 requestIdleCallback / window.load 之后调用。
 */
export async function registerSW(callbacks: PwaRegisterCallbacks = {}): Promise<PwaRegisterResult> {
  let offlineReady = false
  let needRefresh = false
  let registrationRef: ServiceWorkerRegistration | null = null

  // 构建结果：updateSW 闭包始终可用（未注册时是 noop）
  const updateSW: PwaRegisterResult['updateSW'] = async (reloadPage = true) => {
    const reg = registrationRef
    if (!reg) return
    await activateWaiting(reg)
    // 再次尝试拿 registration：activateWaiting 完成后再 claim 一次 clients
    if (reloadPage && 'serviceWorker' in navigator) {
      // 先 unregister + reload 太重；采用「等待 controller 接管后 reload」
      const startTime = Date.now()
      const waitForController = () =>
        new Promise<void>((resolve) => {
          const check = () => {
            if (navigator.serviceWorker.controller || Date.now() - startTime > 4000) resolve()
            else window.setTimeout(check, 100)
          }
          check()
        })
      await waitForController()
      window.location.reload()
    }
  }

  // 环境不支持 → 静默降级
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    logger.debug('[pwa] 跳过 SW：当前环境无 navigator.serviceWorker（SSR 或旧浏览器）')
    callbacks.onRegisterError?.(new Error('Service Worker 不可用（环境不支持或非安全上下文）'))
    return { updateSW, offlineReady: false, needRefresh: false }
  }

  try {
    // registerType='prompt' 下 sw.js 位于根路径（VitePWA generateSW 默认输出）
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'imports',
    })
    registrationRef = registration
    logger.info('[pwa] Service Worker registration 成功', { scope: registration.scope })
    callbacks.onRegistered?.(registration)

    // 立即检查当前是否已有 waiting SW（页面二次打开的新版本发现）
    if (registration.waiting) {
      needRefresh = true
      logger.info('[pwa] 检测到 waiting SW（新版本待激活）')
      callbacks.onNeedRefresh?.(updateSW)
    }

    // 已存在 activated 且当前页面已被接管 → 离线就绪
    if (registration.active && navigator.serviceWorker.controller) {
      offlineReady = true
      callbacks.onOfflineReady?.()
    }

    // 监听 updatefound：首次安装或新版本到达
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          // 安装完成：如果之前没有 active SW → 首次安装 → 触发 offlineReady（由 activated 再次触发也 OK）
          // 否则 → 有旧 SW 存在 → 新 SW 为 waiting 状态 → 触发 onNeedRefresh
          const hasActive = !!registration.active
          if (hasActive) {
            needRefresh = true
            logger.info('[pwa] updatefound: 新版本已安装（waiting，等待激活）')
            callbacks.onNeedRefresh?.(updateSW)
          }
        } else if (installing.state === 'activated') {
          offlineReady = true
          logger.info('[pwa] Service Worker 已激活，离线可用')
          callbacks.onOfflineReady?.()
        }
      })
    })

    // 主动检查新版本（生产构建，浏览器会在 navigate 时自动检查；这里仅加速）
    // 注意：重复 register 时 update() 可能抛 "Unknown Not found"（多 scheduler 幂等调用导致），
    //      此处纯 best-effort，失败不影响注册结果，静默吞掉仅 debug。
    queueMicrotask(async () => {
      try { await registration.update() }
      catch (_err) { /* ignore — periodic browser update checks cover this */ }
    })

    return { updateSW, offlineReady, needRefresh }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    // 非 HTTPS 且非 localhost 环境 / 用户禁用 Service Worker / 浏览器隐私模式 → 降级为 noop
    logger.warn('[pwa] Service Worker registration 失败，降级为 HTTP 缓存', { error: String(error) })
    callbacks.onRegisterError?.(error)
    return { updateSW, offlineReady: false, needRefresh: false }
  }
}
