/* eslint-disable no-console */
/**
 * PWA Service Worker 注册模块
 * 质量门禁 #11 - PWA 离线验证
 *
 * 职责：
 * 1. 检测浏览器是否支持 Service Worker
 * 2. 注册 SW 并监控注册状态（成功/失败/更新）
 * 3. 导出状态供外部查询和测试
 */

export type SWRegistrationStatus =
  | 'unsupported'
  | 'registering'
  | 'registered'
  | 'updated'
  | 'error'

/** 全局注册状态，供外部查询 */
let currentStatus: SWRegistrationStatus = 'unsupported'
let registration: ServiceWorkerRegistration | null = null

/**
 * 获取当前 SW 注册状态
 */
export function getSWStatus(): SWRegistrationStatus {
  return currentStatus
}

/**
 * 获取 SW 注册实例（如果有）
 */
export function getSWRegistration(): ServiceWorkerRegistration | null {
  return registration
}

/**
 * 注册 Service Worker
 *
 * 仅在生产环境且有 SW 文件时执行注册。
 * 注册过程通过 console 明确输出状态日志。
 *
 * @param swUrl - Service Worker 文件路径，默认 '/sw.js'
 * @returns Promise<ServiceWorkerRegistration | null>
 */
export async function registerServiceWorker(
  swUrl = '/sw.js',
): Promise<ServiceWorkerRegistration | null> {
  // 检测浏览器支持
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker 不受当前浏览器支持')
    currentStatus = 'unsupported'
    return null
  }

  currentStatus = 'registering'
  console.info('[PWA] 正在注册 Service Worker ...', swUrl)

  try {
    const reg = await navigator.serviceWorker.register(swUrl)
    registration = reg

    // ---- 注册成功 ----
    console.info('[PWA] Service Worker 注册成功 (scope:', reg.scope, ')')

    // 检查是否有更新等待激活
    if (reg.waiting) {
      currentStatus = 'updated'
      console.info('[PWA] 发现新版本 SW 等待激活')
    } else if (reg.active) {
      currentStatus = 'registered'
      console.info('[PWA] SW 已激活并运行中')
    }

    // 监听后续更新
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // 已有 SW 在运行，新 SW 安装完成 => 有更新可用
          currentStatus = 'updated'
          console.info('[PWA] 新版本 SW 安装完成，刷新页面后生效')
        }
      })
    })

    // 监听 controller 变化（用户接受了更新）
    reg.addEventListener('controllerchange', () => {
      console.info('[PWA] 新 SW 已接管页面控制权')
    })

    return reg
  } catch (err) {
    currentStatus = 'error'
    const message = err instanceof Error ? err.message : String(err)
    console.error('[PWA] Service Worker 注册失败:', message)
    return null
  }
}

/**
 * 清理残留的旧版 Service Worker。
 *
 * 当项目不再提供 sw.js 时，浏览器中已注册的旧 SW 仍会拦截网络请求，
 * 导致 fetch 失败被 SW 放大为网络错误。此函数在应用初始化时自动注销旧 SW。
 */
async function cleanupStaleServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    if (registrations.length === 0) return

    // 检查当前作用域的 SW 脚本是否仍可访问
    const response = await fetch('/sw.js', { method: 'HEAD', cache: 'no-cache' }).catch(() => null)
    if (response && response.ok) return // sw.js 存在，无需清理

    // sw.js 不存在，注销所有残留的 SW
    console.info(`[PWA] sw.js 不存在，清理 ${registrations.length} 个残留 Service Worker ...`)
    await Promise.all(
      registrations.map((reg) =>
        reg.unregister().then((ok) => {
          if (ok) console.info('[PWA] SW 注销成功:', reg.scope)
        }),
      ),
    )
    currentStatus = 'unsupported'
  } catch (err) {
    console.warn('[PWA] 清理残留 SW 失败:', err)
  }
}

/**
 * 在 App 初始化时调用，自动注册 SW（仅生产环境）。
 * 开发环境下自动清理残留旧版 SW。
 */
export function initPWA(): void {
  if (import.meta.env.PROD) {
    registerServiceWorker().catch((err) => {
      console.error('[PWA] initPWA 异常:', err)
    })
  } else {
    console.info('[PWA] 开发环境跳过 Service Worker 注册')
    currentStatus = 'unsupported'
    // 开发环境下清理旧版残留 SW，防止拦截请求产生错误
    cleanupStaleServiceWorker().catch((err) => {
      console.warn('[PWA] cleanupStaleServiceWorker 异常:', err)
    })
  }
}
