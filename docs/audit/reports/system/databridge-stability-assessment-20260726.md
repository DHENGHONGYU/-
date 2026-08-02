---
title: DataBridge 系统稳定性评估报告
type: audit-report
domain: system
phase: testing
status: complete
maintainer: V9 Architecture Team
summary: 基于交叉双向测试结果的系统稳定性评估，重点分析 bootstrapService 未触发条件分支的风险，DataBridge 数据流转完整性，以及关键容错路径的覆盖度。
tags: [audit, stability, databridge, risk-assessment]
version: v1.0.0
last_updated: 2026-07-26
doc_id: V9-DOC-AUDIT-STABILITY-001
tier: T1
related_docs:
  - V9-DOC-AUDIT-DATABRIDGE-001 (DataBridge 数据流转测试执行报告)
  - V9-DOC-ARCH-008 (v9-system-blueprint.md §16)
  - V9-DOC-AUTO-C9F0FE (data-interaction-protocols.md §10-11)
---

# DataBridge 系统稳定性评估报告

> **报告编号**: V9-DOC-AUDIT-STABILITY-001  
> **评估日期**: 2026-07-26  
> **评估方法**: 交叉双向测试（正向代码→日志 + 反向日志→代码）+ 条件分支覆盖率分析  
> **评估范围**: bootstrapService 启动链路、DataBridge 数据流转、ACL 权限矩阵、编排器容错

---

## 1. 评估概述

### 1.1 评估目标

基于前序交叉双向测试（正向 7/7 通过 + 反向 7/7 通过）的结果，对 DataBridge 架构的核心路径进行系统稳定性评估，重点识别未触发的条件分支中潜在的风险点，并给出风险等级和缓解措施。

### 1.2 评估方法

- **条件分支分析**: 识别 bootstrapService 和 DataBridge 中所有条件分支，分类为"已触发"和"未触发"
- **风险评估**: 对未触发的条件分支进行故障模式与影响分析（FMEA）
- **覆盖度评估**: 评估测试用例对关键路径的覆盖程度
- **容错验证**: 验证容错机制（try/catch、.catch()、continue-on-error）在异常场景下的行为

---

## 2. 条件分支分析

### 2.1 bootstrapService 条件分支清单

| # | 条件分支 | 代码位置 | 触发状态 | 风险等级 |
|---|---------|---------|---------|---------|
| 1 | `dataBridge.init()` 成功 | bootstrapService.ts:32-33 | ✅ 已触发 | — |
| 2 | `initPWA()` 正常调用 | bootstrapService.ts:36-37 | ✅ 已触发 | — |
| 3 | `permissionRevocationService.start()` 成功 | bootstrapService.ts:41-42 | ✅ 已触发 | — |
| 4 | 密钥未配置 → WARN 日志 | bootstrapService.ts:98-102 | ✅ 已触发 | — |
| 5 | 密钥已过期 → WARN 日志 | bootstrapService.ts:103-107 | ❌ 未触发 | 🟡 中 |
| 6 | 所有密钥已配置 → INFO 日志 | bootstrapService.ts:112-114 | ❌ 未触发 | 🟢 低 |
| 7 | `seedDefaultStocks()` 成功 | bootstrapService.ts:49 | ✅ 已触发 | — |
| 8 | `seedDefaultStocks()` 失败 → ERROR 日志 | bootstrapService.ts:50-53 | ❌ 未触发 | 🔴 高 |
| 9 | `initOrchestration()` 成功 | bootstrapService.ts:59-60 | ✅ 已触发 | — |
| 10 | `initOrchestration()` 失败 → ERROR 日志 | bootstrapService.ts:61-64 | ❌ 未触发 | 🔴 高 |
| 11 | `dataBridge.init()` 失败 → 抛出异常 | 由 App.tsx 捕获 | ❌ 未触发 | 🔴 高 |
| 12 | `shutdownApp()` 编排器停止 | bootstrapService.ts:122-123 | ❌ 未触发（热更新除外） | 🟡 中 |
| 13 | `shutdownApp()` RBAC 停止 | bootstrapService.ts:124-125 | ❌ 未触发 | 🟡 中 |

### 2.2 DataBridge 条件分支清单

| # | 条件分支 | 代码位置 | 触发状态 | 风险等级 |
|---|---------|---------|---------|---------|
| 1 | ACL 权限校验通过 | databridge.ts | ✅ 已触发 | — |
| 2 | ACL 权限校验拒绝 | databridge.ts | ✅ 已触发（边界测试覆盖） | 🟢 低 |
| 3 | 缓存命中 | databridge.ts | ✅ 已触发 | — |
| 4 | 缓存 MISS | databridge.ts | ✅ 已触发 | — |
| 5 | db.put 成功 | databridge.ts | ✅ 已触发 | — |
| 6 | db.put 异常 | databridge.ts | ✅ 已触发（错误处理测试） | 🟡 中 |
| 7 | db.getAll 异常 | databridge.ts | ✅ 已触发（错误处理测试） | 🟡 中 |
| 8 | 事件广播成功 | databridge.ts | ✅ 已触发 | — |
| 9 | 事件广播失败 | databridge.ts | ❌ 未触发 | 🟡 中 |
| 10 | 审计日志写入 | databridge.ts | ✅ 已触发 | — |
| 11 | 审计日志写入失败 | databridge.ts | ❌ 未触发 | 🟢 低 |

---

## 3. 未触发条件分支风险评估

### 3.1 🔴 高风险分支

#### 3.1.1 种子数据初始化失败（bootstrapService.ts:50-53）

**分支代码**:
```typescript
seedDefaultStocks().catch((err) => {
  logger.error('[bootstrapService] 种子数据初始化失败', {
    error: err instanceof Error ? err.message : String(err),
  })
})
```

**风险分析**:
| 项目 | 内容 |
|------|------|
| 触发条件 | IndexedDB 写入失败、数据格式错误、并发冲突 |
| 影响范围 | 新用户首次启动时无默认股票数据，功能不可用 |
| 影响程度 | 高——用户进入后看到空白界面，无明确引导 |
| 现有防护 | .catch() 日志记录，但无用户侧 Toast 提示 |
| 缓解建议 | 在 catch 中增加 Toast 通知，引导用户手动添加股票 |

**测试建议**:
```typescript
// 已在 bootstrapService.test.ts 中覆盖：
// "种子数据初始化失败时记录 ERROR 日志"
// 建议补充：
// 1. 失败后 UI 层是否有降级提示
// 2. 重试机制是否可用
```

#### 3.1.2 编排器启动失败（bootstrapService.ts:61-64）

**分支代码**:
```typescript
try {
  initOrchestration()
  logger.info('[bootstrapService] 编排器服务启动成功')
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  logger.error('[bootstrapService] 编排器服务启动失败', { error: message })
}
```

**风险分析**:
| 项目 | 内容 |
|------|------|
| 触发条件 | 编排器内部初始化异常、配置缺失、依赖服务不可用 |
| 影响范围 | 10 个编排器（RegistrationOrchestrator、QualityGate 等）全部不可用 |
| 影响程度 | 高——信号采集、质量门禁、评分校准等核心功能缺失 |
| 现有防护 | try/catch + ERROR 日志，不阻塞主流程 |
| 缓解建议 | 编排器应实现独立健康检查接口，UI 层可动态展示可用编排器列表 |

**测试覆盖**:
- ✅ 单元测试: "编排器启动失败时记录 ERROR 日志且不抛出"
- ❌ 集成测试: 缺少编排器部分失败的降级行为测试
- ❌ 运行时验证: 未模拟编排器异常场景

#### 3.1.3 dataBridge.init() 失败（App.tsx:34-43）

**分支代码**:
```typescript
initializeApp().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  logger.error('IndexedDB init failed', { error: err })
  toast({
    title: '本地数据库初始化失败',
    description: `${message}，请检查浏览器存储权限或刷新页面重试。`,
    variant: 'error',
    duration: 0,
  })
})
```

**风险分析**:
| 项目 | 内容 |
|------|------|
| 触发条件 | 浏览器 IndexedDB 被禁用、存储空间不足、隐私模式 |
| 影响范围 | 应用完全不可用，所有数据功能缺失 |
| 影响程度 | 极高——用户无法使用任何功能 |
| 现有防护 | 全局 Toast 错误提示 + duration:0 不自动消失 |
| 缓解建议 | 增加 IndexedDB 权限预检（WebAssembly 存储估算）+ 降级模式（内存存储） |

**测试覆盖**:
- ❌ 无单元测试覆盖此场景（依赖浏览器 IndexedDB 环境）
- ❌ 无集成测试覆盖
- ⚠️ 仅有代码层面的 .catch() 处理，未验证 Toast 在 IndexedDB 不可用时是否可正常渲染

### 3.2 🟡 中风险分支

#### 3.2.1 密钥过期警告（bootstrapService.ts:103-107）

**风险分析**:
| 项目 | 内容 |
|------|------|
| 触发条件 | Tushare Token 或 Qwen API Key 超过 TTL |
| 影响范围 | 数据采集服务可能返回 401/403 |
| 现有防护 | WARN 日志 + UI 侧密钥管理页 |
| 缺失 | 无主动通知机制（如邮件、弹窗）；仅日志记录 |
| 建议 | 增加前端轮询密钥状态 + 到期前 7 天主动提醒 |

#### 3.2.2 shutdownApp 清理逻辑（bootstrapService.ts:121-126）

**风险分析**:
| 项目 | 内容 |
|------|------|
| 触发条件 | 应用关闭、热更新、Service Worker 激活 |
| 影响范围 | 编排器和 RBAC 服务的后台任务停止 |
| 现有防护 | stopOrchestration() + stop() + INFO 日志 |
| 缺失 | 无单元测试验证 stop 后的状态一致性；未验证多次调用的幂等性 |
| 建议 | 补充 shutdownApp 的单元测试和幂等性测试 |

#### 3.2.3 事件广播失败（databridge.ts）

**风险分析**:
| 项目 | 内容 |
|------|------|
| 触发条件 | eventBus 监听器内部抛出异常 |
| 影响范围 | UI 层数据不更新，但底层数据已写入 |
| 现有防护 | eventBus 内部 try/catch，单个监听器失败不影响其他 |
| 缺失 | 无事件广播失败的告警机制；用户可能看到过期数据 |
| 建议 | 增加事件广播失败的 metrics 监控，用于检测 UI 数据同步问题 |

### 3.3 🟢 低风险分支

#### 3.3.1 所有密钥已配置（bootstrapService.ts:112-114）

**风险分析**:
| 项目 | 内容 |
|------|------|
| 触发条件 | 所有密钥（LLM、Tushare、Qwen）均已配置且未过期 |
| 影响范围 | 正面场景——安全检查通过 |
| 风险 | 极低——仅为信息性日志 |
| 建议 | 保持现状，无需额外防护 |

#### 3.3.2 审计日志写入失败（databridge.ts）

**风险分析**:
| 项目 | 内容 |
|------|------|
| 触发条件 | research_logs store 写入异常 |
| 影响范围 | 审计追踪断裂，无法追溯操作历史 |
| 现有防护 | 无——审计日志写入失败不影响主流程 |
| 建议 | 审计日志写入失败应至少触发 WARN 日志，便于排查 |

---

## 4. 覆盖率评估

### 4.1 条件分支覆盖率

| 模块 | 条件分支总数 | 已触发 | 未触发 | 触发率 |
|------|-------------|--------|--------|--------|
| bootstrapService | 13 | 7 | 6 | 53.8% |
| DataBridge | 11 | 8 | 3 | 72.7% |
| **合计** | **24** | **15** | **9** | **62.5%** |

### 4.2 测试用例覆盖

| 测试类型 | 用例数 | 通过率 | 覆盖维度 |
|---------|--------|--------|---------|
| DataBridge 集成测试 | 34 | 100% | CRUD 路由、置信度边界、状态机流转、闭环验证、错误处理 |
| bootstrapService 单元测试 | 13 | 100% | 初始化流程、日志记录、shutdown 清理、容错行为 |
| ACL 配置测试 | 5 | 100% | 模块完整性、Store 引用合法性、操作类型合法性 |
| 边界测试（sectorAnalysis） | 54 | 100% | 负分、超高分、零分、空阈值 |
| **合计** | **106** | **100%** | — |

### 4.3 关键路径覆盖矩阵

| 关键路径 | 单元测试 | 集成测试 | 运行时验证 | 总体覆盖 |
|---------|---------|---------|-----------|---------|
| dataBridge.init() 成功 | ✅ | ✅ | ✅ | ✅ 完全覆盖 |
| dataBridge.init() 失败 | ❌ | ❌ | ❌ | ⚠️ 仅代码层防护 |
| seedDefaultStocks() 成功 | ✅ | ✅ | ✅ | ✅ 完全覆盖 |
| seedDefaultStocks() 失败 | ✅ | ❌ | ❌ | ⚠️ 仅单元测试 |
| initOrchestration() 成功 | ✅ | ✅ | ✅ | ✅ 完全覆盖 |
| initOrchestration() 失败 | ✅ | ❌ | ❌ | ⚠️ 仅单元测试 |
| checkSecretHealth() 正常 | ✅ | ✅ | ✅ | ✅ 完全覆盖 |
| checkSecretHealth() 过期密钥 | ❌ | ❌ | ❌ | ⚠️ 代码路径存在但无测试 |
| shutdownApp() 清理 | ✅ | ❌ | ❌ | ⚠️ 仅单元测试 |

---

## 5. 风险汇总与建议

### 5.1 风险热力图

| 风险等级 | 数量 | 分支 | 建议优先级 |
|---------|------|------|-----------|
| 🔴 高 | 3 | 种子数据失败、编排器失败、dataBridge.init 失败 | P0 |
| 🟡 中 | 3 | 密钥过期、shutdown 清理、事件广播失败 | P1 |
| 🟢 低 | 2 | 全密钥就绪、审计日志失败 | P2 |

### 5.2 改进建议

#### P0 — 立即修复

1. **补充种子数据失败的 UI 降级提示**
   - 在 `seedDefaultStocks().catch()` 中增加 Toast 通知
   - 引导用户手动添加股票或检查 IndexedDB 权限

2. **增加编排器健康检查接口**
   - 新增 `getOrchestratorHealth()` 返回各编排器状态
   - UI 启动后轮询该接口，动态显示可用功能

3. **添加 IndexedDB 预检机制**
   - 在 `initializeApp()` 前检查 `indexedDB.open()` 是否可用
   - 不可用时提前展示降级页面，避免白屏

#### P1 — 本迭代修复

4. **补充 shutdownApp 单元测试**
   - 验证多次调用的幂等性
   - 验证 stop 后编排器不再触发定时任务

5. **增加密钥过期主动通知**
   - 前端启动时检查密钥过期状态
   - 到期前 7 天在密钥管理页显示醒目提醒

6. **事件广播失败监控**
   - 在 eventBus 中增加失败计数 metrics
   - 日志中输出失败监听器数量，便于排查

#### P2 — 后续迭代

7. **审计日志失败告警**
   - research_logs 写入失败时输出 WARN 日志

8. **全密钥就绪正反馈**
   - 所有密钥配置完成时显示配置完成徽标

### 5.3 持续监控建议

1. **CI 门禁**: DataBridge 完整性测试（`test:databridge:gate`）已纳入 main/develop 分支 P0 阻塞性检查
2. **覆盖率追踪**: 建议将条件分支覆盖率纳入质量门禁目标（当前 62.5%，目标 ≥ 80%）
3. **生产监控**: 新增 `bootstrapService.startup_duration` 和 `databridge.forward_latency` 指标，用于检测启动性能退化
4. **定期演练**: 每季度进行故障注入演练（模拟 IndexedDB 不可用、编排器异常、密钥过期）

---

## 6. CI/CD 流水线配置更新

### 6.1 新增 DataBridge 完整性强制检查

已将 DataBridge 集成测试和 bootstrapService 日志验证作为强制检查项纳入 CI/CD 流水线：

#### 6.1.1 main/develop 分支（quality-check.yml）

新增 `databridge-integrity` Job 作为 **P0 阻塞性检查**：

```yaml
databridge-integrity:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
    - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d71f2d81a
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci --ignore-scripts --no-audit
    - name: DataBridge 数据流转集成测试（executionPlanService.dataflow）
      run: npm run test:databridge:integration
    - name: bootstrapService 启动链路日志验证
      run: npm run test:databridge:bootstrap
    - name: ACL 矩阵配置契约测试
      run: npm run test:databridge:acl
```

**纳入质量门禁汇总**：`quality-gate-summary` Job 的 `needs` 列表已包含 `databridge-integrity`，任何 DataBridge 相关测试失败将直接阻塞合并。

#### 6.1.2 feat/feature 分支（ci.yml）

新增 `databridge-gate` Job 作为 **开发分支快速门禁**（continue-on-error: true，先积累基线数据）：

```yaml
databridge-gate:
  name: DataBridge integrity gate
  needs: smoke
  runs-on: ubuntu-latest
  timeout-minutes: 10
  continue-on-error: true
  steps:
    - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
    - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d71f2d81a
      with:
        node-version: 22
        cache: 'npm'
    - run: npm ci
    - name: DataBridge 数据流转 + bootstrapService + ACL 完整性检查
      run: npm run test:databridge:gate
```

### 6.2 新增 npm 测试脚本

```json
{
  "test:databridge:integration": "vitest run src/services/execution/executionPlanService.dataflow.test.ts --no-coverage",
  "test:databridge:bootstrap": "vitest run src/services/system/bootstrapService.test.ts --no-coverage",
  "test:databridge:acl": "vitest run src/config/dbConfig.test.ts --no-coverage",
  "test:databridge:gate": "vitest run src/services/execution/executionPlanService.dataflow.test.ts src/services/system/bootstrapService.test.ts src/config/dbConfig.test.ts --no-coverage"
}
```

### 6.3 环境可移植性修复

同步修复了 `package.json` 中 5 处硬编码的 DELL 用户 Python 路径，改为基于 `USERPROFILE` 动态解析：

```json
"build:stock-dict": "node -e \"const p=require('path');const u=process.env.USERPROFILE||'';const py=p.join(u,'.workbuddy/binaries/python/envs/default/Scripts/python.exe');require('child_process').execFileSync(py,[p.join(process.cwd(),'scripts/generate-stock-dict.py')],{stdio:'inherit'})\""
```

---

## 7. 结论

### 7.1 总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 数据流转完整性 | ⭐⭐⭐⭐⭐ | 100% 测试通过率，正向+反向双验证通过 |
| 条件分支覆盖 | ⭐⭐⭐☆☆ | 62.5% 触发率，高风险分支有代码防护但缺运行时验证 |
| 容错机制完备性 | ⭐⭐⭐⭐☆ | try/catch 和 .catch() 覆盖主要异常，但 UI 降级提示有待完善 |
| 可观测性 | ⭐⭐⭐☆☆ | 日志记录完整，但缺少 metrics 监控和主动告警 |
| CI/CD 集成 | ⭐⭐⭐⭐⭐ | DataBridge 完整性已纳入 P0 阻塞性门禁 |

### 7.2 最终判定

**🟢 可上线，但需关注 3 个 P0 风险点**

DataBridge 架构已具备生产就绪的稳定性，核心数据流转路径经过交叉双向测试验证。主要风险集中在异常场景的运行时覆盖不足，建议按 P0/P1/P2 优先级逐步补充测试和防护机制。

**上线前检查清单**:
- [x] 所有单元/集成测试通过
- [x] bootstrapService 启动日志在运行环境中正常输出
- [x] DataBridge ACL 权限矩阵正确配置
- [x] CI/CD 流水线已包含 DataBridge 完整性门禁
- [ ] （P0 待修复）种子数据失败的 UI 降级提示
- [ ] （P0 待修复）编排器健康检查接口
- [ ] （P0 待修复）IndexedDB 预检机制

---

*报告由 V9 稳定性评估框架生成，最后更新于 2026-07-26*
