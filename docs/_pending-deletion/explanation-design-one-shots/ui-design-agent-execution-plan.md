---
title: ui-design-agent-execution-plan
tier: important
code_version: 2.0.0
---


# V9 UI 设计优化分布式 AGENT 任务执行清单

> 聚合来源：`../../reference/ui设计优化实施计划-详细版.md`（v3.0）  
> 生成日期：2026-07-10  
> 目标：将 P0–P8 实施计划转化为可并行执行、可验收的具体任务，并分配至 AGENT 集群

---

## 一、任务总览

| 阶段 | 主题 | 状态 | 剩余任务数 | AGENT 数量 | 预估工期 |
|------|------|------|-----------|-----------|---------|
| P0 | 设计基线固化 | ✅ 已完成 | 0 | — | 已结束 |
| P1 | 暗色优先 | ✅ 已完成 | 0 | — | 已结束 |
| P2 | 统一视觉锚点 | ✅ 已完成 | 0 | — | 已结束 |
| P3 | 交互与状态设计 | ⚠️ 部分完成 | 1 | 2 | 2 天 |
| P4 | 令牌 lint 与视觉 QA | ⚠️ 部分完成 | 1 | 1 | 1 天 |
| P5 | 结果优先 | ✅ 已完成 | 0 | — | 已结束 |
| P6 | 移动适配 + 巡检常态化 | ✅ 已完成 | 0 | — | 已结束 |
| P7 | 采集配置页面高级功能 | ⏳ 进行中 | 5 | 3 | 2 天 |
| P8 | 页面功能补全与数据持久化 | ⏳ 待启动 | 5 | 3 | 3 天 |

**剩余任务总计：12 项（可并行 8 组）**

---

## 二、AGENT 集群角色定义

| AGENT 代号 | 职责域 | 专业技能 | 输入 | 输出 |
|-----------|--------|---------|------|------|
| **A1 · 数据持久化 AGENT** | 实现 saveConfig / runCollection 真实落库与调用 | IndexedDB、DataBridge、Zustand、TypeScript | `SevenDimConfigPage` 现有代码、`sevenDimConfigStore` | 真实配置保存、真实采集调度 |
| **A2 · 采集配置 UI AGENT** | QuotaEstimatePanel、真实 API 测试、维度跳转 | React、shadcn/ui、令牌系统 | `CollectionPlanPanel`、`ApiTestDialog` | 额度预估面板、接口测试、维度跳转 |
| **A3 · 风控页 AGENT** | RiskControlPage 接入真实数据源 | riskStore、数据层、状态管理 | `RiskControlPage.tsx`、`riskStore.ts` | 真实风控数据展示 |
| **A4 · 投资组合页 AGENT** | PortfolioPage 接入真实持仓数据 | tradingStore、数据层 | `PortfolioPage.tsx`、`tradingStore.ts` | 真实投资组合展示 |
| **A5 · 仪表盘 AGENT** | DashboardPage 补充可视化面板 | Recharts、Widget、数据聚合 | `DashboardPage.tsx` | 复盘摘要、热力图、导出记录面板 |
| **A6 · Widget 四态接入 AGENT** | 现有数据 Widget 接入 Loading/Empty/Error/Skeleton | React、状态组件、useMarketData | `src/components/cockpit/widgets/**/*` | 四态覆盖的 Widget |
| **A7 · 视觉 QA / 令牌审计 AGENT** | 令牌扫描、对比度校验、截图 diff 准备 | ESLint、token-scan、Playwright | `scripts/other/token-scan.cjs`、`.token-baseline.json` | 0 新增违规、对比度报告 |
| **A8 · 架构合规 AGENT** | 监控分层依赖、文档同步、测试通过 | AGENTS.md、audit:layers、audit:docs | 全仓库代码 | 合规报告 |

---

## 三、按优先级排序的具体任务清单

### 🔴 P0 · 最高优先级（阻塞后续功能）

#### T-01 · 采集配置真实数据持久化
- **所属阶段**：P7 + P8
- **执行 AGENT**：A1（主）+ A8（合规复核）
- **任务描述**：
  1. 实现 `SevenDimConfigPage.saveConfig()` 真实落库逻辑（当前 setTimeout 模拟）
  2. 实现 `SevenDimConfigPage.runCollection()` 真实 API 调用（当前 setTimeout 模拟）
  3. 接入 `collectionPipeline` / `dataSourceOrchestrator` 完成真实采集调度
- **输入文件**：`src/store/sevenDimConfigStore.ts`、`src/services/data-collector/collectionPipeline.ts`
- **输出文件**：更新后的 `sevenDimConfigStore.ts`、可能的 `collectionRuntimeStore` 触发
- **验收标准**：
  - `saveConfig` 后 IndexedDB 可查询到配置记录
  - `runCollection` 后产生真实 `CollectionTaskRuntime` 状态
  - `tsc --noEmit` 0 报错
  - `npm run audit:layers` 0 违规
- **依赖**：P7 组件框架已完成
- **工期**：1.5 天

#### T-02 · 采集配置页面接口真实化
- **所属阶段**：P7
- **执行 AGENT**：A2
- **任务描述**：
  1. `CollectionPlanPanel` 展示真实数据源架构（当前为静态 DATA_SOURCE_LAYERS）
  2. `ApiTestDialog` 可执行真实接口测试（当前 setTimeout 模拟）
  3. 维度接口映射表点击维度跳转对应配置行
- **输入文件**：`src/components/organisms/input/CollectionPlanPanel.tsx`、`src/components/organisms/input/ApiTestDialog.tsx`
- **输出文件**：更新后的上述组件 + 可能的 service
- **验收标准**：
  - CollectionPlanPanel 从 `dataSourceRegistry` / `collectConfig` 读取真实配置
  - ApiTestDialog 能发起真实请求并展示响应/失败
  - 点击维度行平滑滚动到对应配置项
- **工期**：1.5 天

---

### 🟠 P1 · 高优先级（核心业务功能）

#### T-03 · 风控页面接入真实数据源
- **所属阶段**：P8
- **执行 AGENT**：A3
- **任务描述**：`RiskControlPage` 当前使用 `riskStore` 模拟数据，需接入真实风控裁决记录
- **输入文件**：`src/pages/trading/RiskControlPage.tsx`、`src/store/riskStore.ts`
- **输出文件**：更新后的 `riskStore.ts`、可能新增 `riskControlService.ts`
- **验收标准**：
  - 页面展示真实裁决记录（如数据库有数据）
  - 熔断回路、三态展示基于真实数据
- **工期**：1.5 天

#### T-04 · 投资组合页面接入真实数据
- **所属阶段**：P8
- **执行 AGENT**：A4
- **任务描述**：`PortfolioPage` 当前使用 `tradingStore` 模拟数据，需接入真实持仓/策略结果
- **输入文件**：`src/pages/trading/PortfolioPage.tsx`、`src/store/tradingStore.ts`
- **输出文件**：更新后的 `tradingStore.ts` / 新增 service
- **验收标准**：
  - 展示真实核心组合和策略结果
  - 与 `TradingFlowPage` 持仓数据一致
- **工期**：1.5 天

#### T-05 · 仪表盘补充可视化面板
- **所属阶段**：P8
- **执行 AGENT**：A5
- **任务描述**：在 `DashboardPage` 补充交易复盘摘要、热力图分布、数据导出记录等面板
- **输入文件**：`src/pages/output/DashboardPage.tsx`
- **输出文件**：更新后的 `DashboardPage.tsx` + 可能新增子组件
- **验收标准**：
  - 至少 3 个新增可视化面板
  - 使用 `chartColors.ts` 图表令牌
- **工期**：1.5 天

---

### 🟡 P2 · 中优先级（体验优化）

#### T-06 · 额度预估面板（QuotaEstimatePanel）
- **所属阶段**：P7
- **执行 AGENT**：A2
- **任务描述**：新建额度预估面板，展示月调用量卡片、额度进度条、Kimi 套餐选择
- **输入文件**：`src/config/collectConfig.ts`（GLOBAL_LIMITS）、`src/store/sevenDimConfigStore.ts`
- **输出文件**：`src/components/organisms/input/QuotaEstimatePanel.tsx`
- **验收标准**：
  - 月调用量、日/小时上限、额度使用率可视化
  - 集成到 `SevenDimConfigPage`
- **工期**：1 天

#### T-07 · 现有数据 Widget 四态接入
- **所属阶段**：P3
- **执行 AGENT**：A6
- **任务描述**：将 `src/cockpit/widgets/` 下所有数据 Widget 的加载/空/错误/骨架态统一接入 `ui/states` 四态组件
- **输入文件**：`src/components/cockpit/widgets/**/*`、`src/components/ui/states/*`
- **输出文件**：更新后的 Widget 文件
- **验收标准**：
  - 每个数据 Widget 都使用 `Loading/Empty/Error/Skeleton` 之一
  - `npm run audit:tokens` 0 新增违规
- **工期**：2 天

---

### 🟢 P3 · 低优先级（治理与 QA）

#### T-08 · 令牌审计与债务消减
- **所属阶段**：P4
- **执行 AGENT**：A7
- **任务描述**：
  1. 运行 `npm run audit:tokens -- --strict` 全量扫描
  2. 逐步消减 `.token-baseline.json` 中的债务（优先处理 apps 层 127 处）
  3. 更新基线并提交
- **输入文件**：`.token-baseline.json`、`scripts/other/token-scan.cjs`
- **输出文件**：更新后的 `.token-baseline.json`
- **验收标准**：
  - 默认模式 `npm run audit:tokens` 仍通过
  - 债务数量减少（可更新基线）
- **工期**：1 天

#### T-09 · WCAG 对比度复核
- **所属阶段**：P0-P4
- **执行 AGENT**：A7
- **任务描述**：运行 `node scripts/a11y-contrast.cjs`，对 emerald 主色在正文场景给出处理建议（如仅用于按钮/加深主色）
- **输入文件**：`scripts/other/a11y-contrast.cjs`、`design-tokens/tokens.json`
- **输出文件**：对比度复核报告
- **验收标准**：
  - 识别所有正文 AA 不达标的场景
  - 给出具体替换建议
- **工期**：0.5 天

#### T-10 · Playwright 视觉 diff 方案准备
- **所属阶段**：P4
- **执行 AGENT**：A7
- **任务描述**：在本地环境（非沙箱）搭建 Playwright 截图 diff 流程，生成基准图与对比脚本
- **输入文件**：`scripts/other/token-scan.cjs` 输出
- **输出文件**：`tests/visual/` 目录、Playwright 配置
- **验收标准**：
  - 本地可运行 `npm run test:visual`
  - 不阻塞沙箱 CI
- **工期**：1 天（本地执行）

---

### 🔵 P4 · 架构合规保障（贯穿全程）

#### T-11 · 分层依赖与文档同步审计
- **所属阶段**：贯穿 P7/P8
- **执行 AGENT**：A8
- **任务描述**：
  1. 每阶段完成后执行 `npm run audit:layers`
  2. 执行 `npm run audit:docs`
  3. 检查新增文件是否遵循四步集成契约
- **输入文件**：全仓库
- **输出文件**：合规报告
- **验收标准**：
  - `npm run audit:layers` 0 违规
  - `npm run audit:docs` 0 缺口（或记录例外）
- **工期**：0.5 天/轮，共 3 轮

---

## 四、分布式执行时序（可并行路线）

```
第 1 天（并行启动）
├── A1: T-01 数据持久化（1.5天）
├── A2: T-02 接口真实化 + T-06 额度预估面板（2.5天）
├── A3: T-03 风控真实数据（1.5天）
├── A4: T-04 投资组合真实数据（1.5天）
├── A5: T-05 仪表盘可视化（1.5天）
├── A6: T-07 Widget 四态接入（2天）
├── A7: T-08 令牌审计 + T-09 对比度复核（1.5天）
└── A8: 全程合规审计

第 2-3 天
├── A1 完成 T-01，提交集成
├── A2 完成 T-02/T-06
├── A3/A4/A5 完成真实数据接入
├── A6 继续 Widget 四态接入
└── A8 第一轮合规复核

第 4 天（收尾 + 联调）
├── A6 完成 T-07
├── A7: T-10 Playwright 方案准备（本地）
├── A8: 第二轮合规复核 + 全量闸门
└── 集成测试：P7/P8 功能联调

第 5 天（验收）
└── A8: 最终验收闸门 + 文档更新
```

---

## 五、AGENT 间协作协议

| 协作点 | 依赖 AGENT | 被依赖 AGENT | 同步内容 |
|--------|-----------|-------------|---------|
| 采集配置 UI 依赖真实数据 | A2 | A1 | A1 完成 `saveConfig/runCollection` 真实逻辑后，A2 才能将 API 测试与额度预估接入真实数据 |
| 仪表盘展示风控/投资组合数据 | A5 | A3、A4 | A3/A4 完成真实数据接入后，A5 可补充关联面板 |
| Widget 四态接入 | A6 | A7 | A6 修改 Widget 后，A7 运行令牌扫描确认无新增违规 |
| 所有任务 | A1-A7 | A8 | 每阶段完成后 A8 执行合规审计 |

---

## 六、验收闸门（每阶段必须执行）

```bash
# 1. 类型安全
npx tsc --noEmit

# 2. 分层依赖
npm run audit:layers

# 3. 文档同步
npm run audit:docs

# 4. 令牌不新增违规
npm run audit:tokens

# 5. 单元测试
npm run test -- --run

# 6. 颜色硬编码 lint（不新增）
npm run lint:colors

# 7. 对比度校验（A7）
node scripts/a11y-contrast.cjs
```

**强制通过项**：1、2、3、4、5  
**参考项**：6、7

---

## 七、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| A1 真实采集需后端接口 | 阻塞 A2 | 若后端未就绪，A1 先完成 DataBridge + IndexedDB 落库；A2 接口测试可先使用本地 mock 并标注 |
| Widget 四态接入涉及大量文件 | 工期超支 | A6 按优先级分批：先核心数据 Widget（大盘/持仓/信号），后辅助 Widget |
| 令牌债务消减可能引发回归 | 阻塞验收 | A7 每次消减后必须跑 `npm run audit:tokens` 和 `tsc --noEmit` |
| 多 AGENT 并行修改同一文件 | 冲突 | 每个 AGENT 独立分支/工作区，A8 负责最终合并审计 |
| Playwright 沙箱不可用 | T-10 无法执行 | 标记为本地任务，不阻塞 CI |

---

## 八、交付物清单（本轮预计新增）

- `src/store/sevenDimConfigStore.ts`（真实 saveConfig / runCollection）
- `src/components/organisms/input/QuotaEstimatePanel.tsx`（新建）
- `src/components/organisms/input/CollectionPlanPanel.tsx`（真实数据）
- `src/components/organisms/input/ApiTestDialog.tsx`（真实 API 测试）
- `src/store/riskStore.ts` / `src/services/riskControlService.ts`（真实风控数据）
- `src/store/tradingStore.ts`（真实投资组合数据）
- `src/pages/output/DashboardPage.tsx`（新增可视化面板）
- `src/components/cockpit/widgets/**/*`（四态接入）
- `.token-baseline.json`（更新后）
- `docs/ui-design-execution-plan.md`（本方案）

---

*本方案可直接用于 AGENT 集群任务分发，每个 AGENT 按任务编号独立执行并提交验收报告。*
