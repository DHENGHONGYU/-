---
title: MCP Server 治理复盘深度报告
status: 已评审
owner: 架构组
updated: 2026-07-20
---

# MCP Server 治理复盘深度报告

> **结论前置**：Registry 中注册的 18 个 Server，实际仅 12 个文件存在。6 个被标记为"已恢复"的 Server（screening、stockpool、backtest、export、input、trade）**源码文件完全缺失**，注册时会在 `instantiateServer` 中静默失败（`module not found in glob`）。这是本次诊断与文件系统交叉验证后发现的**最大遗漏**。

---

## 一、设计意图验证（逐项核实）

### 1.1 screening：⚠️ 部分达成（文件不存在）

| 维度 | 设计意图 | 实际表现 | 偏差 |
|------|---------|---------|------|
| 功能完整性 | MCP Server 封装 `analysis/screeningEngine` | ❌ 无 `screeningServer.ts` 文件 | 完全缺失 |
| 服务层 | `multiFactorScreeningEngine.ts` 存在 | ✅ 257 行，功能完整 | 达成 |
| UI 层 | `MultiFactorFilterPanel` 交互 | ✅ 组件完整 | 达成 |
| MCP 暴露 | Agent 可通过 MCP 调用筛选 | ❌ 无 Server 文件 | **未达成** |

**结论**：服务层和 UI 层完整，但 MCP 包装层从未存在。诊断中"保留（Agent 编排用）"的前提是文件存在，实际前提不成立。

### 1.2 stockpool：⚠️ 部分达成（文件不存在）

| 维度 | 设计意图 | 实际表现 | 偏差 |
|------|---------|---------|------|
| 功能完整性 | MCP Server 暴露股票池流转 | ❌ 无 `stockPoolServer.ts` 文件 | 完全缺失 |
| 服务层 | `stockpoolService.ts` 存在 | ✅ 259 行，流转逻辑完整 | 达成 |
| UI 层 | 被 UI 旁路 | ✅ 诊断正确 | 达成 |
| MCP 暴露 | Agent 内省工具 | ❌ 无 Server 文件 | **未达成** |

**结论**：同 screening，服务层完整但 MCP 层缺失。

### 1.3 trade：❌ 未达成（文件不存在 + 边界重叠）

| 维度 | 设计意图 | 实际表现 | 偏差 |
|------|---------|---------|------|
| 功能完整性 | MCP Server 暴露持仓/交易操作 | ❌ 无 `tradeServer.ts` 文件 | 完全缺失 |
| 服务层 | `holdingsService.ts` 存在 | ✅ 226 行，API 封装完整 | 达成 |
| 与 trading 关系 | 边界清晰 | ❌ `tradingServer` 已覆盖持仓/订单/风控 | **重叠** |
| MCP 暴露 | 独立交易 Server | ❌ 无文件 + 功能被 trading 覆盖 | **未达成** |

**结论**：`trade` 服务是 UI 层 API 封装（`holdingsService`），`trading` 是 MCP 层交易引擎。两者在"订单/持仓"领域功能重叠，且 `trade` MCP Server 从未存在。

### 1.4 input：❌ 未达成（文件不存在 + 与 fetcher 重叠）

| 维度 | 设计意图 | 实际表现 | 偏差 |
|------|---------|---------|------|
| 功能完整性 | MCP Server 暴露输入采集能力 | ❌ 无 `inputServer.ts` 文件 | 完全缺失 |
| 服务层 | 16+ 组件，6 个工具 | ✅ 功能丰富 | 达成 |
| 与 fetcher 关系 | 边界清晰 | ❌ `fetcher:data` 已覆盖数据采集 | **重叠** |
| MCP 暴露 | 独立输入 Server | ❌ 无文件 | **未达成** |

**结论**：`input` 有完整的 UI 层（采集向导、数据源配置、批量导入等），但 MCP 层缺失。与 `fetcher:data` 在"数据采集"领域功能重叠。

### 1.5 backtest：⚠️ 部分达成（文件不存在 + 参数复杂）

| 维度 | 设计意图 | 实际表现 | 偏差 |
|------|---------|---------|------|
| 功能完整性 | MCP Server 暴露回测引擎 | ❌ 无 `backtestServer.ts` 文件 | 完全缺失 |
| 服务层 | `BacktestEngine.ts` 存在 | ✅ 28+ 测试用例，引擎完整 | 达成 |
| 参数复杂度 | 适合 MCP 表达 | ❌ 8 个配置参数（strategy/startDate/endDate/initialCapital/commissionRate/slippage/maxPositionPct） | **不适合** |
| MCP 暴露 | 流水线用 | ❌ 无文件 | **未达成** |

**结论**：回测引擎是核心资产，但参数复杂度确实不适合 MCP 工具调用（schema 过于冗长）。MCP 层缺失。

### 1.6 export：❌ 未达成（文件不存在 + Store API 缺失）

| 维度 | 设计意图 | 实际表现 | 偏差 |
|------|---------|---------|------|
| 功能完整性 | MCP Server 暴露导出能力 | ❌ 无 `exportServer.ts` 文件 | 完全缺失 |
| 服务层 | `backtestExportService.ts` 存在 | ✅ 320 行，PDF/Excel 导出完整 | 达成 |
| Store API | `backtestStore.getBacktestById()` | ❌ 方法不存在 | **缺失** |
| MCP 暴露 | 独立导出 Server | ❌ 无文件 + 依赖未就绪 | **未达成** |

**结论**：`export` 服务层完整，但有两个阻塞：① `backtestStore` 无 `getBacktestById`（无法获取历史回测）；② MCP 文件缺失。

---

## 二、偏差原因排查（根因分析）

### 2.1 根因分类

```
偏差根因树
├── 第一类：文件缺失（6/6）—— "配置恢复" ≠ "文件恢复"
│   ├── 现象：MCP_SERVER_REGISTRY 中 enabled=true
│   ├── 实际：src/mcp/servers/ 下无对应 .ts 文件
│   └── 根因：还原操作只恢复了 registry 配置，未恢复 server 源码
├── 第二类：需求理解偏差（4/6）—— "MCP 薄包装"假设不成立
│   ├── screening/stockpool/trade/input：假设"有 UI 路径时无人需要 MCP"
│   ├── 实际：MCP 文件从未存在，不是"无人使用"而是"从未交付"
│   └── 根因：诊断基于"Server 已恢复"的前提，但该前提为假
└── 第三类：技术阻塞（2/6）
    ├── backtest：参数确实不适合 MCP schema 表达
    └── export：backtestStore 无 getBacktestById（历史回测缺失）
```

### 2.2 关键证据链

**证据 1：文件缺失**（`Glob` 扫描 `src/mcp/servers/**/*.ts`）
```
实际存在的 12 个 Server 文件：
✅ knowledge, data-collector, fetcher, trading, workflow, system
✅ execution, llm, scoring, portfolio, news, analysis

缺失的 6 个 Server 文件：
❌ screening/screeningServer.ts
❌ stockpool/stockPoolServer.ts
❌ backtest/backtestServer.ts
❌ export/exportServer.ts
❌ input/inputServer.ts
❌ trade/tradeServer.ts
```

**证据 2：注册时的静默失败**（`register.ts:60-66`）
```typescript
const mod = serverModules[globKey]
if (!mod) {
  logger.error(`[MCP:register] module not found in glob: ${globKey}`)
  return null  // ← 静默失败，不会注册到 Registry
}
```
- 18 个 Registry 条目 → 12 个成功注册 → 6 个 error 日志 → 0 个实际注册
- `mcpRegistry.getStats()` 实际返回 `totalServers: 12`

**证据 3：`getBacktestById` 不存在**（`grep` 全项目搜索）
- `backtestStore.ts` 中无 `getBacktestById` 方法
- 只有 `results`（当前回测结果）和 `exportReport`（导出当前结果）
- 没有历史回测记录的持久化/查询能力

---

## 三、当前卡点定位（P0/P1/P2）

### 3.1 卡点矩阵

| 等级 | 模块 | 卡点 | 阻塞类型 | 影响范围 |
|------|------|------|---------|---------|
| **P0** | screening/stockpool/backtest/export/input/trade | 6 个 Server 源码文件完全缺失 | 文件缺失 | 启动时 6 条 error 日志，MCP 能力名不副实 |
| **P0** | export | `backtestStore.getBacktestById()` 未实现 | API 缺失 | 历史回测导出永远不可用 |
| **P1** | trade | 与 `trading:main` 功能边界不清 | 架构决策 | 合并方案待评审 |
| **P1** | input | 与 `fetcher:data` 功能重叠 | 架构决策 | 合并方案待评审 |
| **P2** | backtest | 参数复杂不适合 MCP 表达 | 设计问题 | 即使文件存在，可用性存疑 |
| **P2** | 全部 | 6 个缺失 Server 无测试覆盖 | 质量缺口 | 回归测试无法发现缺失 |

### 3.2 具体阻塞分析

#### P0-1：文件缺失的连锁反应

```
MCP_SERVER_REGISTRY（18 条目）
    ↓ registerAllServers()
    ├─→ 12 个文件存在 → 成功注册
    └─→ 6 个文件缺失 → logger.error() → 返回 null → 跳过注册
        ↓
    mcpRegistry.getStats() = { totalServers: 12 }
        ↓
    启动日志中出现 6 条 error：
    "[MCP:register] module not found in glob: ./servers/screening/screeningServer.ts"
    ...（其余 5 个同理）
```

**影响**：
1. 启动时产生 6 条 error 日志，干扰问题排查
2. 外部调用方（Agent）认为这些 Server 可用，实际调用失败
3. `audit:layers` 和 `tsc --noEmit` 无法检测文件缺失（glob 是运行时行为）

#### P0-2：backtestStore API 缺失

```typescript
// backtestStore.ts 中缺失的方法：
interface MissingAPI {
  getBacktestById(id: string): Promise<BacktestResult | null>  // ❌ 不存在
  listBacktestHistory(): Promise<BacktestResult[]>               // ❌ 不存在
  saveBacktestResult(result: BacktestResult): Promise<void>     // ❌ 不存在
}

// 实际存在的能力：
interface ActualAPI {
  results: BacktestResult | null  // 仅当前结果，不持久化
  runBacktest(): Promise<void>    // 执行回测
  exportReport(): Promise<...>    // 导出当前结果
}
```

**影响**：`export` Server 即使存在，也无法获取历史回测数据，只能导出"当前"结果。

---

## 四、遗漏项识别（边界场景与异常）

### 4.1 已识别的遗漏项

| # | 遗漏项 | 严重程度 | 说明 | 发现方式 |
|---|--------|---------|------|---------|
| 1 | 6 个 Server 源码文件缺失 | 🔴 严重 | 诊断时未验证文件存在性 | Glob 扫描 |
| 2 | `backtestStore` 无历史回测 API | 🔴 严重 | 无法持久化/查询历史回测 | 源码阅读 |
| 3 | 注册时静默失败无告警 | 🟡 中等 | 只有 console.error，无抛出/无监控 | 源码阅读 |
| 4 | 无 Server 文件存在性校验 | 🟡 中等 | `audit:layers` 和 tsc 无法检测 | 逻辑分析 |
| 5 | `trade` 与 `trading` 命名混淆 | 🟡 中等 | 两个子域名称相近，职责不清 | 目录扫描 |
| 6 | 6 个缺失 Server 的契约文档已存在 | 🟡 中等 | `docs/architecture/services/*-contract.md` 存在但实现缺失 | 文档扫描 |
| 7 | `export` 服务与 `backtest` 强耦合 | 🟢 轻微 | 只能导出 backtest，无法复用 | 源码阅读 |
| 8 | MCP 注册配置与文件不同步 | 🟢 轻微 | 配置驱动注册但未验证文件一致性 | 逻辑分析 |

### 4.2 边界场景未覆盖

1. **启动时错误日志噪音**：6 条 `module not found in glob` 每次启动都会出现，污染日志
2. **Agent 编排失败**：Agent 尝试调用 `screening:main` 工具时，`mcpRegistry.getServer('screening:main')` 返回 `undefined`
3. **热更新 `syncWithConfig()` 的异常**：若手动创建缺失的 Server 文件，`syncWithConfig` 可以增量注册，但首次全量注册失败无重试机制
4. **测试覆盖盲区**：`mcp/__tests__/servers.test.ts` 只测试已存在的 Server，缺失的 Server 永远不会被测试

### 4.3 兼容性影响

| 场景 | 影响 | 建议 |
|------|------|------|
| 旧代码引用 `screening:main` 工具 | 返回 `undefined`，可能 NPE | 清理 Registry 或补全文件 |
| 新 Agent 编排依赖 `stockpool:main` | 工具不存在，编排失败 | 明确文档标注不可用 |
| 回测导出期望历史记录 | 只能导出当前结果 | 补充 `backtestStore` 持久化 |

---

## 五、复盘与提炼（经验沉淀）

### 5.1 本次诊断的教训

| # | 教训 | 具体表现 | 改进措施 |
|---|------|---------|---------|
| 1 | **"配置恢复" ≠ "功能恢复"** | Registry 中 6 个 Server enabled=true，但文件缺失 | 任何恢复操作必须验证文件存在性 |
| 2 | **诊断前提未验证** | 基于"Server 已恢复"假设进行设计意图验证 | 验证假设后再分析，先事实后判断 |
| 3 | **日志静默失败被忽视** | 6 条 error 日志在启动时淹没在大量日志中 | 建立启动健康检查，失败即告警 |
| 4 | **文档与实现脱节** | 6 个缺失 Server 的契约文档已存在 | 文档创建与代码实现必须同步 |
| 5 | **MCP 参数复杂度未评估** | backtest 8 个参数不适合工具调用 | 新增 MCP Tool 前评估参数复杂度 |
| 6 | **Store 持久化设计缺失** | backtestStore 只存当前结果 | 设计阶段考虑历史数据生命周期 |

### 5.2 可复用的 SKILL 经验

**SKILL 模板：MCP Server 健康检查清单**

```markdown
## MCP Server 新增/恢复检查清单

- [ ] 文件存在性：`src/mcp/servers/{domain}/{domain}Server.ts` 存在
- [ ] 注册配置：`src/config/mcpServerRegistry.ts` 中条目已添加
- [ ] 类名一致性：`exportName` 与实际导出类名一致
- [ ] 接口实现：继承 `MCPServerBase`，实现 `info`/`listTools`/`listResources`
- [ ] 参数评估：Tool 参数数量 ≤ 5，复杂对象需评估是否适合 MCP
- [ ] 启动验证：`npm run dev` 启动无 `module not found in glob` 错误
- [ ] 测试覆盖：`mcp/__tests__/` 中有对应 Server 的单元测试
- [ ] 文档同步：`docs/architecture/services/{domain}-contract.md` 已更新
- [ ] 依赖检查：无跨层调用（`audit:layers` 通过）
- [ ] 类型安全：`tsc --noEmit` 无错误
```

### 5.3 架构改进建议

1. **注册前校验**：在 `register.ts` 的 `registerAllServers()` 中增加文件存在性预检
2. **启动健康检查**：新增 `mcpRegistry.getMissingServers()` 方法，暴露配置中有但文件缺失的条目
3. **契约文档与代码绑定**：契约文档创建时，必须在同 PR 中提交 Server 源码骨架
4. **参数复杂度门禁**：新增 Tool 时，若参数超过 5 个或包含嵌套对象，需架构评审
5. **Store 持久化设计**：`backtestStore` 补充历史回测持久化（IndexedDB + DataBridge）

---

## 六、最终 TODO LIST（按优先级排序）

### P0：立即执行（阻塞级）

| # | 任务 | 负责人 | 验收标准 | 预估工时 |
|---|------|--------|---------|---------|
| 1 | 清理 MCP Registry 中 6 个缺失 Server 的条目（或创建骨架文件） | 架构组 | 启动无 `module not found in glob` 错误 | 1h |
| 2 | 实现 `backtestStore` 历史回测持久化（`getBacktestById`/`listHistory`/`saveResult`） | 后端组 | 可查询/导出历史回测记录 | 4h |
| 3 | 启动健康检查：暴露 `mcpRegistry.getMissingServers()` 并打印 warning | 架构组 | 启动时明确列出缺失 Server | 1h |

### P1：本周执行（决策级）

| # | 任务 | 负责人 | 验收标准 | 预估工时 |
|---|------|--------|---------|---------|
| 4 | 决策：`trade` 合并入 `trading:main` 或保留独立 | 架构评审 | ADR 文档 + 合并/保留方案 | 2h |
| 5 | 决策：`input` 合并入 `fetcher:data` 或保留独立 | 架构评审 | ADR 文档 + 合并/保留方案 | 2h |
| 6 | 若保留 `screening`/`stockpool`/`backtest`，补全 MCP Server 骨架文件 | 架构组 | 文件存在 + 基础 Tool 注册 | 3h/个 |
| 7 | 若降级 `export`，从 Registry 移除并迁移为纯 Service 函数 | 架构组 | Registry 无 export 条目 + service 可用 | 1h |

### P2：本月执行（优化级）

| # | 任务 | 负责人 | 验收标准 | 预估工时 |
|---|------|--------|---------|---------|
| 8 | 建立 MCP Server 新增检查清单（SKILL 沉淀） | 架构组 | 新增 Server 必须逐项勾选 | 2h |
| 9 | 补充 6 个缺失 Server 的测试用例（若补全文件） | 测试组 | 测试覆盖 Tool/Resource/Prompt | 2h/个 |
| 10 | 评估 `backtest` 参数简化方案（适合 MCP 表达） | 设计组 | 参数 ≤ 5 个或提供预设模板 | 2h |
| 11 | 文档-代码一致性检查脚本（`audit:mcp-docs`） | 工具组 | 扫描契约文档与实现文件差异 | 3h |
| 12 | `export` 服务通用化（支持非 backtest 数据导出） | 后端组 | 可导出任意数据报表 | 4h |

### P3：后续迭代（长期）

| # | 任务 | 说明 |
|---|------|------|
| 13 | MCP Server 运行时监控 | 统计工具调用频率、错误率、响应时间 |
| 14 | Server 动态加载/卸载 | 支持不重启应用增删 Server |
| 15 | Agent 编排效果评估 | 收集 Agent 实际调用数据，验证保留 Server 的价值 |

---

> **附录：验证命令**
> ```powershell
> # 验证文件存在性
> Get-ChildItem src/mcp/servers -Recurse -Filter "*Server.ts" | Select-Object Name
> 
> # 验证启动日志
> npm run dev 2>&1 | Select-String "module not found in glob"
> 
> # 验证注册统计
> # 在浏览器控制台执行：
> # mcpRegistry.getStats()
> 
> # 验证 backtestStore API
> grep -n "getBacktestById\|listHistory\|saveResult" src/store/backtestStore.ts
> ```
