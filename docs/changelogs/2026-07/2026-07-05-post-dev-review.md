# 变更日志 — 2026-07-05 开发后复盘修复

> **日期**: 2026-07-05
> **会话**: 全日开发会话
> **影响范围**: EventBus 事件系统、PWA/Service Worker、资源引用、死代码、日志规范、测试一致性

---

## 修改记录

### 1. EventBus 递归 emit 修复

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | `SYSTEM_MONITOR_SNAPSHOT` listener 调用 `refreshSnapshot()` 导致递归 emit，每次耗时 ~540ms |
| **修改内容** | `src/store/systemMonitorStore.ts` — listener 改为直接使用 payload `setState()`，不再调用 `refreshSnapshot()` |
| **影响范围** | SystemMonitorStore 快照更新链路 |
| **验证结果** | tsc 0 错误，emit 耗时预期降至 <10ms |

### 2. EventBus 双重 emit 修复

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | `eventBus.emit()` + `withBroadcast()` 对同一事件连续调用，监听器被触发两次 |
| **修改内容** | `src/store/signalAdviceStore.ts` — 删除多余的 `eventBus.emit()` 调用，移除未使用的 `eventBus` 导入 |
| **影响范围** | SIGNALS_CHANGED 事件广播 |
| **验证结果** | tsc 0 错误 |

### 3. EventBus 内存泄漏修复（ArchitectureService）

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | 构造函数中 `eventBus.on()` 返回值未保存，无 `destroy()` 方法，违反 AGENTS.md 事件监听清理规范 |
| **修改内容** | `src/services/system/architectureService.ts` — 保存 unsubscribe 引用，新增 `destroy()` + `destroyArchitectureService()` |
| **影响范围** | ArchitectureService 单例生命周期管理 |
| **验证结果** | tsc 0 错误 |

### 4. EventBus 内存泄漏修复（DataBridgeAdapter）

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | `destroyDataBridgeAdapter()` 仅置空实例，不清理通过 `subscribe()` 创建的活跃订阅 |
| **修改内容** | `src/databridge/index.ts` — 新增 `activeSubscriptions` 追踪数组 + `destroySubscriptions()` 方法 |
| **影响范围** | DataBridgeAdapter 订阅管理 |
| **验证结果** | tsc 0 错误，databridge.test.ts 11 测试通过 |

### 5. stockAnalysisStore 订阅初始化修复

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | `initStockAnalysisStoreSubscriptions()` 已定义但从未调用，V6 评分自动刷新功能失效 |
| **修改内容** | `src/store/stockAnalysisStore.ts` — 末尾添加 `initStockAnalysisStoreSubscriptions()` 自动初始化 |
| **影响范围** | V6 评分变更自动刷新功能 |
| **验证结果** | tsc 0 错误 |

### 6. Service Worker 残留清理

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | 旧版生产构建的 SW 在开发环境拦截请求，导致 `/health` 等请求报错 |
| **修改内容** | `src/services/pwa/registerServiceWorker.ts` — 新增 `cleanupStaleServiceWorker()` 函数，开发环境自动清理 |
| **影响范围** | 开发环境 SW 管理 |
| **验证结果** | tsc 0 错误，pwa.test.ts 13 测试通过 |

### 7. PWA 资源补全

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | `vite.svg` favicon 404、PWA 图标缺失、`manifest.json` 未在 HTML 中链接 |
| **修改内容** | 生成 `public/vite.svg`、`public/icons/icon-192.jpg`、`public/icons/icon-512.jpg`；更新 `public/manifest.json` 图标引用；`index.html` 添加 manifest 链接和 theme-color |
| **影响范围** | PWA 安装体验、favicon 显示 |
| **验证结果** | 文件存在，manifest.json 格式正确 |

### 8. 测试断言修正

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | `pwa.test.ts` 断言 `App.tsx` 导入 `initPWA`，实际在 `bootstrapService.ts` |
| **修改内容** | `tests/pwa.test.ts` — 修正断言目标文件为 `bootstrapService.ts` |
| **影响范围** | PWA 集成测试 |
| **验证结果** | pwa.test.ts 13 测试通过 |

### 9. 死代码清理

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | `stockAnalysisEngine.ts`（1100+ 行）和 `mockAICenterProvider.ts` 完全无引用 |
| **修改内容** | 删除 2 个文件 |
| **影响范围** | 代码库体积（减少 ~1200 行） |
| **验证结果** | tsc 0 错误，audit:layers 0 违规 |

### 10. 未使用常量清理

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | `DATA_CHANNELS` 整组 + 6 个 `EVENT_NAMES` 在 `src/` 中零引用 |
| **修改内容** | `src/constants/store-channels.constants.ts` — 删除 `DATA_CHANNELS`、`DataChannelName` 类型、6 个未使用的 EVENT_NAMES |
| **影响范围** | 常量定义文件 |
| **验证结果** | tsc 0 错误 |

### 11. 日志规范修复

| 属性 | 值 |
|------|-----|
| **修改时间** | 2026-07-05 |
| **修改原因** | `commandStore` 使用自定义 `console.log/warn/error` 包装，违反项目日志规范 |
| **修改内容** | `src/store/commandStore.ts` — 替换为标准 `getLogger()`，所有日志调用添加 `[commandStore]` 前缀 |
| **影响范围** | commandStore 日志输出格式 |
| **验证结果** | tsc 0 错误 |

---

## 验证汇总

| 验证项 | 结果 |
|--------|------|
| `tsc --noEmit` | 0 错误 |
| `audit:layers` | 617 文件，0 违规 0 警告 |
| `pwa.test.ts` | 13 测试通过 |
| `storeSubscriptions.test.ts` | 1 测试通过 |
| `databridge.test.ts` | 11 测试通过 |

---

## 新增文档

| 文件 | 说明 |
|------|------|
| `docs/v9-post-dev-review.md` | 开发后复盘报告（经验教训 + 架构改进建议） |
| `docs/changelogs/2026-07/2026-07-05-post-dev-review.md` | 本文档（变更日志） |
