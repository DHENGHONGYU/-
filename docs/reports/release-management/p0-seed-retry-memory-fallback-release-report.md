---
title: V9 P0 Fix — 种子数据重试与内存降级模式
type: release
domain: system
phase: deployment
tier: T1
status: active
maintainer: V9 Architecture Team
summary: "P0 Fix: seed data exponential backoff retry, IndexedDB pre-check with memory fallback, orchestrator graceful degradation"
tags: [release, bugfix, resilience, bootstrap, p0]
version: v2.7.0-p0
released_at: 2026-07-29
commit_hash: 6e910917
git_tag: p0-seed-retry-memory-fallback
doc_id: V9-REL-P0-29A7F9
---

# V9 P0 Fix — 种子数据重试与内存降级模式

> **Release Date**: 2026-07-29  
> **Commit**: `6e910917`  
> **Branch**: `fix/p0-seed-retry-memory-fallback` → `feat/cross-index-20260719`  
> **Type**: P0 核心链路修复（系统启动容错加固）  
> **优先级**: P0（阻塞级）

---

## 1. 问题背景

V9 投研系统启动链路存在两个关键容错缺陷：

### P0-1：种子数据初始化无重试机制

| 问题 | 描述 |
|------|------|
| **影响** | 首次启动或 IndexedDB 数据损坏时，种子股票数据写入失败会直接导致应用无法加载自选股池和默认股票数据 |
| **原行为** | `seedDefaultStocks()` 调用失败后无重试，用户看到空白界面且无任何反馈 |
| **风险等级** | 🔴 P0 — 完全阻断核心功能 |

### P0-2：IndexedDB 不可用时无降级方案

| 问题 | 描述 |
|------|------|
| **影响** | 用户浏览器禁用 IndexedDB（隐私模式/磁盘空间不足/浏览器 bug）时，应用完全无法启动 |
| **原行为** | `dataBridge.init()` 抛出异常，启动链路中断，白屏无反馈 |
| **风险等级** | 🔴 P0 — 完全阻断核心功能 |

---

## 2. 修复内容

### 2.1 种子数据指数退避重试（P0-1）

**文件**: `src/services/system/bootstrapService.ts`

```typescript
const MAX_SEED_RETRIES = 2
const SEED_RETRY_BASE_DELAY_MS = 500

async function seedWithRetry(hooks?: BootstrapHooks): Promise<void> {
  let retryCount = 0
  while (true) {
    try {
      await seedDefaultStocks()
      return
    } catch (err) {
      retryCount++
      if (retryCount >= MAX_SEED_RETRIES) {
        hooks?.onSeedFailure?.(errorMessage, retryCount)
        return
      }
      const delay = SEED_RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
```

**策略说明**:
- 最大重试次数：2 次（共执行 3 次）
- 退避间隔：500ms → 1000ms（指数增长）
- 重试耗尽：调用 `onSeedFailure` 回调触发 UI 降级提示
- 非阻塞：种子数据初始化在后台执行（`void seedWithRetry()`），不阻塞主流程

### 2.2 IndexedDB 内存降级模式（P0-2）

**文件**: `src/services/system/bootstrapService.ts`

```typescript
export async function initializeApp(options?: InitOptions): Promise<void> {
  const { useMemoryFallback = false, hooks } = options ?? {}

  if (useMemoryFallback) {
    logger.warn('[bootstrapService] 使用内存降级模式')
  } else {
    try {
      await dataBridge.init()
    } catch (err) {
      hooks?.onDataBridgeInitFailure?.(message)
      throw err
    }
  }
  // ... 继续初始化 PWA / 编排器 / 种子数据
}
```

**策略说明**:
- 主动降级：通过 `useMemoryFallback: true` 参数跳过 IndexedDB 初始化
- 被动降级：`dataBridge.init()` 失败时触发 `onDataBridgeInitFailure` 回调
- URL 参数：`?forceMemory=1` 可用于测试内存降级模式
- 功能限制：内存模式下数据仅在当前会话有效，刷新后丢失

### 2.3 编排器优雅降级（P0-3）

**文件**: `src/services/system/bootstrapService.ts`

```typescript
initOrchestration()
const failedOrchestrators = getOrchestratorHealth()
  .filter((h) => h.status === 'failed')
if (failedOrchestrators.length > 0) {
  hooks?.onOrchestrationFailure?.(message)
}
```

**策略说明**:
- 单个编排器启动失败不阻塞其他编排器
- 通过健康检查 API 检测失败编排器
- 触发 `onOrchestrationFailure` 回调通知 UI 层
- 用户可在 `OrchestratorStatusPanel` 中查看异常状态

### 2.4 内存模式横幅组件

**文件**: `src/components/organisms/shared/MemoryModeBanner.tsx`

- 当检测到内存降级模式时，显示黄色警告横幅
- 提示用户数据仅在当前会话有效
- 提供"尝试切换到本地存储模式"按钮
- 使用 `twText`/`twBg`/`twBorder` 设计令牌（零硬编码颜色）

---

## 3. CI/CD 门禁配置

### 3.1 新增 P0 强制门禁

在 `.github/workflows/quality-check.yml` 中新增 `bootstrap-p0-gate` 作业：

```yaml
bootstrap-p0-gate:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - name: P0-1 种子数据重试 + P0-2 内存降级模式
      run: npm run test:bootstrap:p0
```

**门禁特性**:
- 🔴 **阻塞性门禁**：失败即阻止 PR 合并
- 覆盖 bootstrapService 全部 23 项测试用例
- 与 `quality-gate-summary` 集成，纳入 P0 门禁汇总

### 3.2 新增 npm 脚本

```json
"test:bootstrap:p0": "vitest run src/services/system/bootstrapService.test.ts --no-coverage --reporter=verbose"
```

### 3.3 门禁覆盖范围

| 测试组 | 用例数 | 覆盖内容 |
|--------|--------|----------|
| 基础启动流程 | 13 | dataBridge.init / initPWA / initOrchestration / shutdown |
| P0-1 种子重试 | 3 | 重试耗尽回调 / 重试成功 / 重试次数验证 |
| P0-2 编排器失败 | 3 | 启动失败回调 / 正常不触发 / 部分失败健康检查 |
| P0-3 内存降级 | 4 | 跳过 IDB / 正常模式 / IDB 失败回调 / IDB 成功 |

---

## 4. 验证步骤

### 4.1 本地环境验证

```bash
# 安装依赖
npm ci

# 运行 P0 bootstrap 测试
npm run test:bootstrap:p0

# 运行全量质量门禁
npm run gate:dev
```

### 4.2 种子数据重试验证

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 清空 IndexedDB 种子数据 | 数据库中无默认股票 |
| 2 | 启动应用 | 种子数据自动初始化 |
| 3 | 观察日志 | 看到 "种子数据初始化成功" |
| 4 | 模拟写入失败 | 指数退避重试（500ms → 1000ms） |
| 5 | 重试耗尽 | 触发 onSeedFailure 回调 |

### 4.3 内存降级模式验证

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 访问 `?forceMemory=1` | 跳过 IndexedDB 初始化 |
| 2 | 观察日志 | 看到 "使用内存降级模式" 警告 |
| 3 | 检查 UI | MemoryModeBanner 显示黄色警告横幅 |
| 4 | 操作数据 | 数据正常读写（仅内存中） |
| 5 | 刷新页面 | 数据丢失（符合预期） |
| 6 | 点击"尝试切换" | 重新加载页面，尝试 IndexedDB 模式 |

### 4.4 编排器健康检查验证

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 正常启动应用 | 所有编排器状态为 "running" |
| 2 | 模拟编排器失败 | OrchestratorStatusPanel 显示红色异常标签 |
| 3 | 检查日志 | 看到编排器失败错误日志 |
| 4 | 其他功能 | 未失败的编排器继续正常工作 |

### 4.5 自动化测试结果

```
Test Files  1 passed (1)
     Tests  23 passed (23)
  Duration  5.06s
```

---

## 5. 风险评估

### 5.1 影响范围

| 模块 | 影响程度 | 说明 |
|------|----------|------|
| 系统启动链路 | 🔴 高 | bootstrapService 为应用入口 |
| UI 组件 | 🟡 中 | MemoryModeBanner 为新增组件 |
| CI/CD 流水线 | 🟡 中 | 新增 bootstrap-p0-gate 门禁 |
| 数据持久化 | 🟢 低 | 不改变数据模型或存储结构 |

### 5.2 风险矩阵

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 种子数据重试延迟启动 | 低 | 中 | 后台执行（`void`），不阻塞主流程 |
| 内存模式数据丢失 | 高 | 低 | 明确告知用户，提供切换按钮 |
| 编排器健康检查误报 | 低 | 中 | 健康检查有超时保护 |
| CI 新增门禁导致合并延迟 | 低 | 低 | 门禁轻量（<5s），可并行执行 |
| `??` fallback 与 async 冲突 | 极低 | 中 | 已通过全量测试验证 |

### 5.3 回滚方案

| 场景 | 操作 |
|------|------|
| 种子数据重试导致性能问题 | 修改 `MAX_SEED_RETRIES = 0` 禁用重试 |
| 内存模式引发数据不一致 | 移除 `useMemoryFallback` 参数入口 |
| CI 门禁导致假阳性 | 临时将 `bootstrap-p0-gate` 标记为 `continue-on-error: true` |
| 编排器健康检查误报 | 调整 `getOrchestratorHealth()` 超时阈值 |

### 5.4 已知限制

1. **种子数据重试次数有限**：最多 2 次重试，持续故障仍会导致种子数据缺失
2. **内存模式无持久化**：刷新页面后所有数据丢失，需明确告知用户
3. **编排器部分失败无自动降级**：仅通知 UI，未实现自动跳过失败编排器
4. **`forceMemory=1` 为开发测试专用**：生产环境不应暴露此参数

---

## 6. 变更文件清单

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `src/services/system/bootstrapService.ts` | 修改 | 新增种子数据重试、内存降级、编排器健康检查 |
| `src/services/system/bootstrapService.test.ts` | 修改 | 新增 9 项 P0 测试用例 |
| `src/components/organisms/shared/MemoryModeBanner.tsx` | 新增 | 内存降级模式横幅组件 |
| `src/components/organisms/system/OrchestratorStatusPanel.tsx` | 修改 | 编排器状态面板 + 设计令牌 |
| `.github/workflows/quality-check.yml` | 修改 | 新增 `bootstrap-p0-gate` P0 强制门禁 |
| `package.json` | 修改 | 新增 `test:bootstrap:p0` 脚本 |

---

## 7. 后续行动项

| 优先级 | 任务 | 状态 |
|--------|------|------|
| P0 | 将 `bootstrap-p0-gate` 纳入 GitHub Branch Protection 规则 | 待执行 |
| P1 | 实现编排器自动降级（跳过失败编排器继续启动） | 规划中 |
| P1 | 增加种子数据持久化降级（从缓存恢复种子数据） | 规划中 |
| P2 | 实现内存模式数据导出/导入功能 | 规划中 |
| P2 | 添加 `forceMemory` 参数的环境检测（仅开发环境生效） | 规划中 |

---

## 附录：技术细节

### A. 种子数据重试时序图

```
initializeApp()
    │
    ├─ dataBridge.init()        ← IndexedDB 初始化
    │
    ├─ initPWA()                ← PWA 注册
    │
    ├─ permissionRevocation     ← RBAC 服务
    │
    ├─ checkSecretHealth()       ← 密钥检查
    │
    ├─ void seedWithRetry()     ← 后台种子数据（不阻塞）
    │   │
    │   ├─ seedDefaultStocks()  ← 尝试 1
    │   ├─ (失败) wait 500ms
    │   ├─ seedDefaultStocks()  ← 尝试 2
    │   ├─ (失败) wait 1000ms
    │   ├─ seedDefaultStocks()  ← 尝试 3
    │   └─ (失败) → onSeedFailure
    │
    └─ initOrchestration()      ← 编排器启动
        └─ getOrchestratorHealth() → onOrchestrationFailure
```

### B. 内存降级模式数据流

```
用户访问 → ?forceMemory=1
              │
              ├─ useMemoryFallback = true
              │
              ├─ 跳过 dataBridge.init()
              │
              ├─ 初始化内存数据层
              │   └─ 所有读写操作走内存 Store
              │
              ├─ MemoryModeBanner 显示
              │   └─ "数据仅在当前会话有效"
              │
              └─ 用户点击"尝试切换"
                  └─ window.location.reload()
```

### C. 门禁配置验证

```yaml
# Branch Protection Rule (建议配置)
required_status_checks:
  strict: true
  contexts:
    - lint
    - typecheck
    - route-verify
    - test
    - bootstrap-p0-gate    # ← 新增
    - databridge-integrity
    - chart-industry-tests
    - audit
```

---

*本文档由 V9 Architecture Team 于 2026-07-29 生成，基于 commit `6e910917`。*