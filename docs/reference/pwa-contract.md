---
title: pwa-contract.md — PWA Service Worker 接口契约
type: reference
domain: backend
phase: design
tier: standard
status: active
maintainer: V9 Architecture Team
summary: "定位：定义 `pwa` 子域的接口契约、职责边界、数据流与依赖关系。 关联：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。"
tags: [backend, contract, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: "2.0.0-rc.2"
doc_id: V9-DOC-BACK-021
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176, V9-DOC-PROJ-149]
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# pwa-contract.md — PWA Service Worker 接口契约

> **定位**：定义 `pwa` 子域的接口契约、职责边界、数据流与依赖关系。  
> **关联**：`./services-catalog.md`（24 子域总览）、`../../AGENTS.md` §一（分层规则）。

---

## 1. 职责边界

### 1.1 核心职责

- **Service Worker 生命周期管理**：检测浏览器 SW 支持性，执行注册/注销，监控状态变化（注册中、已激活、等待更新）。
- **版本更新检测与提示**：监听 `updatefound` / `controllerchange` 事件，检测新 SW 安装完成，向外暴露更新状态。
- **开发环境残留清理**：开发环境下自动检测并注销旧版残留 Service Worker，防止已移除的 `sw.js` 继续拦截网络请求。
- **状态暴露与查询**：通过全局状态变量导出当前 SW 注册状态（`SWRegistrationStatus`）和注册实例，供外部查询与测试。

### 1.2 分层定位

| 维度 | 说明 |
|------|------|
| 所属层 | `src/services/`（服务层） |
| 依赖方向 | 只能依赖 `core/`、`data/`、`lib/`（白名单） |
| 禁止事项 | 禁止直写 IndexedDB（须经 `DataBridge.forward()`）；禁止直接依赖 `store/` / `pages/` / `components/` |
| 被依赖方 | `services/system/`（`bootstrapService` 在初始化时调用 `initPWA()`） |

> **说明**：本模块不依赖 `lib/` 白名单中的任何模块（`logger`、`EventBus` 等），仅使用浏览器原生 API（`navigator.serviceWorker`、`console`、`fetch`）和 `import.meta.env.PROD`。`console` 日志用于浏览器端 SW 状态的可视化追踪，不接入集中式日志系统。

### 1.3 与相邻子域的关系

| 相邻子域 | 关系 | 数据流 |
|----------|------|--------|
| `services/system/bootstrapService` | 下游：消费输出 | `initPWA()` → `bootstrapService.initializeApp()` 中调用 |
| `public/manifest.json` | 外部配置：PWA 基础配置 | `manifest.json` 提供应用元数据，与本模块共同构成 PWA 离线能力 |

---

## 2. 公共接口

### 2.1 类型定义（TypeScript Interface）

```typescript
// 文件：src/services/pwa/registerServiceWorker.ts

export type SWRegistrationStatus =
  | 'unsupported'
  | 'registering'
  | 'registered'
  | 'updated'
  | 'error'
```

### 2.2 主入口函数

| 函数 | 签名 | 职责 | 错误处理 |
|------|------|------|----------|
| `initPWA()` | `() => void` | 应用初始化时调用。生产环境自动注册 SW；开发环境跳过注册并清理旧版残留 SW | 异常捕获后 `console.error` / `console.warn` 输出 |
| `registerServiceWorker()` | `(swUrl?: string) => Promise<ServiceWorkerRegistration \| null>` | 注册指定路径的 Service Worker，监听 `updatefound` / `controllerchange` 事件，更新全局状态 | 注册失败时返回 `null`，状态置为 `'error'`，`console.error` 输出 |
| `getSWStatus()` | `() => SWRegistrationStatus` | 获取当前 SW 注册状态（只读） | 纯查询，无副作用 |
| `getSWRegistration()` | `() => ServiceWorkerRegistration \| null` | 获取当前 SW 注册实例（如果有） | 纯查询，无副作用 |

### 2.3 事件接口

本模块不使用 `EventBus`。状态更新通过闭包内的全局变量（`currentStatus`、`registration`）和查询函数暴露，外部通过轮询或调用 `getSWStatus()` 获取最新状态。

| 状态名 | 触发条件 |
|--------|----------|
| `'unsupported'` | 浏览器不支持 SW，或开发环境跳过注册 |
| `'registering'` | 开始调用 `navigator.serviceWorker.register()` |
| `'registered'` | SW 已激活并运行（`reg.active` 存在） |
| `'updated'` | 新 SW 安装完成等待激活（`reg.waiting` 存在），或 `updatefound` 后新 worker 状态变为 `installed` |
| `'error'` | `register()` 抛出异常 |

---

## 3. 数据流

```
[浏览器环境]
    ↓ (navigator.serviceWorker API)
registerServiceWorker() / initPWA()
    ↓ (内存状态更新)
SWRegistrationStatus (currentStatus)
    ↓ (查询函数)
getSWStatus() / getSWRegistration()
    ↓
services/system/bootstrapService（调用方）
    ↓（间接）
components/pages（通过 UI 状态展示 SW 状态，如更新提示弹窗）
```

> **说明**：本模块不涉及 IndexedDB 写入，不通过 `DataBridge` 路由数据。SW 状态为内存级全局状态，不持久化。如未来需要持久化 SW 更新提示的"已忽略版本"等状态，应引入 `DataBridge.forward()` 写入 `IndexedDB`。

---

## 4. 配置与依赖

### 4.1 依赖白名单（lib/）

| 依赖 | 路径 | 用途 |
|------|------|------|
| — | — | 本模块无 `lib/` 依赖，仅使用浏览器原生 API 和 `import.meta.env` |

> **说明**：本模块使用 `console.info` / `console.warn` / `console.error` 直接输出日志，而非 `@/lib/logger`。这是有意设计，因为 SW 注册发生在应用初始化极早期，此时日志系统可能尚未就绪，且浏览器 `console` 是调试 SW 问题的最直接手段。

### 4.2 配置项

| 配置名 | 默认值 | 说明 | 来源 |
|--------|--------|------|------|
| `swUrl` | `'/sw.js'` | Service Worker 脚本路径 | 函数参数（`registerServiceWorker(swUrl)`） |
| `import.meta.env.PROD` | — | 环境标识：仅生产环境执行注册 | Vite 构建注入 |

---

## 5. 测试策略

| 测试类型 | 文件 | 说明 |
|----------|------|------|
| 单元测试 | `tests/pwa.test.ts` | 覆盖 manifest.json 存在性与字段合规、模块导出函数签名、开发/生产环境分支、SW 注册成功/失败状态流转、不支持 SW 浏览器降级 |
| 集成测试 | `tests/pwa.test.ts`（bootstrapService 集成节） | 验证 `bootstrapService.ts` 正确导入并调用 `initPWA()` |
| Mock 策略 | 测试内联 mock | 全局 `navigator.serviceWorker` 对象，`vi.stubEnv('PROD', true/false)` 控制环境分支，`vi.resetModules()` 重置模块缓存以重新触发状态 |

---

## 6. 变更日志

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-07-12 | v0.1.0 | 契约初稿 | 架构组 |

---

> **TODO[子域 owner]**：请按本模板填充 §1-§5，确保与 `services-catalog.md` 的摘要一致。完成后运行 `tsc --noEmit` + `audit:layers` 验证。
