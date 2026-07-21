---
title: src-directories-evaluation-report
code_version: 2.0.0
tier: reference
status: archived
referenced_by: [V9-DOC-META-000, V9-DOC-PROJ-176]
---

# src/databridge/ 和 src/utils/ 评估报告

> 评估时间: 2026-07-12
> 评估依据: AGENTS.md v1.4.3
> 评估工具: Grep 全局引用搜索 + 文件内容读取 + 目录结构对比

---

## 一、src/databridge/ 评估

### 1.1 文件清单

| 文件 | 行数 | 是否有测试 |
|------|------|-----------|
| `../../src/showcase/index.ts` | 155 | 是 (`tests/databridgeAdapter.test.ts`) |

### 1.2 职责分析

`../../src/showcase/index.ts` 实现了一个 **`DataBridgeAdapter` 适配器类**，对 `src/core/databridge.ts` 进行薄包装：

- 提供 `query()` / `subscribe()` / `getStats()` / `destroySubscriptions()` 等实例方法
- 使用 `Promise` + `Map` 管理待处理查询的超时和追踪
- 维护单例生命周期（`createDataBridgeAdapter` / `getDataBridgeAdapter` / `destroyDataBridgeAdapter`）
- 从 `@/core/databridge` 导入 `dataBridge` 单例，通过 `EnvelopeFactory` 封装标准信封

### 1.3 与 AGENTS.md 定义对比

AGENTS.md §一 定义 `src/core/` 层包含 **DataBridge/ACL/Envelope/MemoryCache/EventBus**，未定义 `src/core/databridge.ts` 目录。

实际目录结构对比：

| 目录 | 职责 | 与 AGENTS.md 关系 |
|------|------|-------------------|
| `src/core/databridge.ts` | 核心 DataBridge 实现（forward/query/subscribe/fallbackQueue，810 行） | ✅ 已定义 |
| `src/core/databridgeHandlers.ts` | EnvelopeHandler 注册表 | ✅ 已定义 |
| `src/core/databridgeStrategyRouter.ts` | STRATEGY_CHANNEL 路由逻辑 | ✅ 已定义 |
| `../../src/showcase/index.ts` | DataBridgeAdapter 适配器（面向模块的便捷 API） | ❌ 未定义 |

### 1.4 引用分析

**全局搜索 `src/core/databridge.ts` 路径引用**（覆盖 `../README.md`）：

| 引用类型 | 文件 | 具体引用 | 说明 |
|---------|------|---------|------|
| 自身 | `../../src/showcase/index.ts` | N/A | 导出定义 |
| 测试 | `tests/databridgeAdapter.test.ts` | `import { ... } from '@/databridge'` | 全部 7 个测试用例依赖此文件 |
| 文档 | `docs/00-meta/file-management-guide-file-wandering-report.md` | 提及目录名 | 非代码引用 |

**生产代码引用**：**0 个文件**。无任何生产代码从 `@/databridge` 路径导入。

**对比：大量生产代码直接使用 `src/core/databridge.ts`**：

- `src/store/databridgeStore.ts`（使用 `BridgeQueryResult` 类型，从 `types/modules/databridge.types` 导入，非 `src/core/databridge.ts`）
- `src/core/feedbackOrchestrator.ts`（直接使用 `dataBridge`）
- `src/core/pipelineScheduler.ts`（直接使用 `dataBridge`）
- `src/data/repository.ts`（直接使用 `dataBridge`）
- 超过 60 个文件引用 `src/core/databridge` 或其子模块（`databridgeHandlers.ts`, `databridgeStrategyRouter.ts`）

### 1.5 决策建议

| 评估项 | 决策 |
|--------|------|
| **决策** | **删除**（需先迁移测试文件） |
| **依据** | 无生产代码引用；与 `src/core/databridge.ts` 职责重叠；AGENTS.md 未定义此目录；现有测试仅验证单例行为和 API 签名，无业务逻辑覆盖 |
| **风险等级** | 低 |
| **执行建议** | 1. 将 `DataBridgeAdapter` 类合并至 `src/core/databridge.ts` 末尾（或新建 `src/core/databridgeAdapter.ts`）<br>2. 更新 `tests/databridgeAdapter.test.ts` 的导入路径为 `@/core/databridge` 或 `@/core/databridgeAdapter`<br>3. 确认 `tests/contracts/databridge.contract.ts` 和 `tests/contracts/setup.ts` 的引用关系（当前契约测试从 `types/modules/databridge.types` 导入类型，不受迁移影响）<br>4. 删除 `src/core/databridge.ts` 空目录 |

---

## 二、src/utils/ 评估

### 2.1 文件清单

| 文件 | 行数 | 是否有测试 | 当前引用数 |
|------|------|-----------|---------|
| `src/lib/validation.ts` | 401 | 是 (`dataValidation.test.ts`) | **~11** |
| `src/lib/xssSanitizer.ts` | 206 | 是 (`xssSanitizer.test.ts`) | **2** |
| `src/lib/validation.ts` | 185 | 否 | **0** |
| `src/lib/precision.ts` | 184 | 否 | **4** |
| `src/lib/format.ts` | 113 | 否 | **0** |

### 2.2 职责分析

| 文件 | 核心职责 | 依赖层 |
|------|---------|--------|
| `dataValidation.ts` | 配置名/股票代码（A/港/美）/数值范围/LLM 配置（baseURL/API Key/模型名）验证；敏感信息脱敏 | 零运行时依赖（纯逻辑） |
| `xssSanitizer.ts` | HTML 实体转义、HTML 净化、Markdown 净化、搜索关键词净化 | 零运行时依赖（纯字符串处理） |
| `a11y.ts` | 无障碍 ID 生成、键盘导航助手、焦点管理、屏幕阅读器公告、运动/对比度偏好检测 | 依赖 React 类型（`React.KeyboardEvent`）+ DOM API |
| `precision.ts` | 金融数值格式化（价格/涨跌幅/成交量/额/百分比）、安全数组/对象访问 | 零运行时依赖（纯数学逻辑） |
| `timeUtils.ts` | 时间格式化（UTC→Asia/Shanghai）、相对时间、日期范围、交易时间常量 | 依赖 `dayjs` + 插件 |

### 2.3 与 src/lib/ 对比

AGENTS.md 定义 `src/lib/` 包含 `utils`（基础设施白名单），但未定义 `src/lib/` 目录。

实际文件对比：

| 目录 | 文件数 | 总行数 | 引用文件数 | 引用方层级 |
|------|--------|--------|-----------|---------|
| `src/lib/utils.ts` | 1 | 28 | **58+** | 主要是 UI 组件层（`cn()` 和 `hexToRgba()`） |
| `src/lib/` | 5 | 1099 | **~17** | 服务层 + 组件层（数据验证、净化、格式化） |

**命名冲突风险**：`src/lib/utils.ts`（单文件）和 `src/lib/`（目录）并存。如将 `src/lib/` 迁移至 `src/lib/utils/` 目录，会与现有 `src/lib/utils.ts` 冲突。

### 2.4 引用分析（详细）

#### dataValidation.ts — 约 11 个引用

| 引用文件 | 导入内容 | 用途 |
|---------|---------|------|
| `src/services/llm/llmClient.ts` | `isValidLlmBaseURL`, `isValidLlmApiKey`, `isValidLlmModel` | LLM 配置验证 |
| `src/store/collectionWizardStore.ts` | `validateConfigName` | 配置模板名称校验 |
| `src/services/scoring/v6-engine/calculators/l7_l8.ts` | `isValidStockCode`, `safeParseNumber` | 股票代码验证、数值解析 |
| `src/components/organisms/input/wizard-steps/TaskPreviewStep.tsx` | `validateConfigName` | 表单校验 |
| `src/services/collection/configExportService.ts` | `validateConfigName` | 导出配置校验 |
| `src/components/organisms/analysis/score/IntelligentScoreExplanation.tsx` | `sanitizeObject` | 敏感信息脱敏 |
| `src/components/organisms/shared/LLMConfigWidget.tsx` | `isValidLlmBaseURL`, `isValidLlmApiKey` | LLM 配置表单校验 |
| `src/services/scoring/v6-engine/calculators/l3/l3a-financial.ts` | `isValidStockCode` | 股票代码验证 |
| `src/services/scoring/v6-engine/calculators/l4_l5_l6.ts` | `isValidStockCode`, `isValidPercent` | 股票代码/百分比验证 |
| `src/services/scoring/v6-engine/calculators/l0_l1_l2.ts` | `isValidStockCode`, `safeParseNumber` | 股票代码/数值解析 |
| `tests/__tests__/integration/llmEnhancer.integration.test.ts` | `isValidLlmBaseURL` | 集成测试验证 |

#### xssSanitizer.ts — 2 个引用

| 引用文件 | 导入内容 | 用途 |
|---------|---------|------|
| `src/components/organisms/analysis/score/IntelligentScoreExplanation.tsx` | `sanitizeLlmOutput` | LLM 输出净化 |
| `tests/sanitizeLlmOutput.test.ts` | `sanitizeLlmOutput` | 单元测试 |

#### a11y.ts — 0 个引用

**全局搜索** `from '@/utils/a11y'` 在所有 `.ts/.tsx` 文件中：
- **无匹配结果**
- 搜索 `generateId(`、`KEYS.`、`handleKeyboardActivation(` 等函数名在其他文件中的引用：共发现 18 个文件使用了类似函数名，但**均非从 `@/utils/a11y` 导入**（多数为自有实现或从其他库导入）

#### precision.ts — 4 个引用

| 引用文件 | 导入内容 | 用途 |
|---------|---------|------|
| `src/services/scoring/v6-engine/calculators/l7_l8.ts` | `formatPrice`, `formatChangeRate`, `formatChange` | 金融数值格式化 |
| `src/services/scoring/v6-engine/calculators/l3/l3a-financial.ts` | 同上 | 同上 |
| `src/services/scoring/v6-engine/calculators/l4_l5_l6.ts` | 同上 | 同上 |
| `src/services/scoring/v6-engine/calculators/l0_l1_l2.ts` | 同上 | 同上 |

#### timeUtils.ts — 0 个引用

**全局搜索** `from '@/utils/timeUtils'` 在所有 `.ts/.tsx` 文件中：
- **无匹配结果**
- 搜索 `formatTime(`、`formatDate(`、`formatRelativeTime(` 等函数名在其他文件中的引用：共发现 12 个文件使用了类似函数名，但**均非从 `@/utils/timeUtils` 导入**（多数使用自有 `dayjs` 实例或 `date-fns` 等）

### 2.5 决策建议

#### 2.5.1 有活跃引用的文件（dataValidation.ts + xssSanitizer.ts + precision.ts）

| 评估项 | 决策 |
|--------|------|
| **决策** | **迁移至 `src/lib/` 目录** |
| **依据** | 有活跃生产代码引用；职责属于库函数层（数据验证、XSS 净化、金融数值格式化）；与 AGENTS.md 定义一致 |
| **风险等级** | 中（需修改约 17 个文件的 import 路径） |
| **执行建议** | 1. 将 `src/lib/validation.ts` → `src/lib/validation.ts`<br>2. 将 `src/lib/xssSanitizer.ts` → `src/lib/xssSanitizer.ts`<br>3. 将 `src/lib/precision.ts` → `src/lib/format.ts`（避免与现有 `format.ts` 冲突）<br>4. 将对应测试文件同步迁移<br>5. 全局替换 `from '@/utils/...'` → `from '@/lib/...'`<br>6. 运行 `npx tsc --noEmit` 和 `npm test -- --run` 验证 |

#### 2.5.2 无引用的文件（a11y.ts + timeUtils.ts）

| 评估项 | 决策 |
|--------|------|
| **决策** | **需进一步确认**（疑似死代码，但可能是预留模块） |
| **依据** | 当前无任何生产代码或测试引用；但文件内容完整、JSDoc 齐全、文档规范 |
| **风险等级** | 低 |
| **执行建议** | 1. 检查近期提交历史（`git log -- src/utils/a11y.ts src/utils/timeUtils.ts`）确认是否为近期主动添加的预留模块<br>2. 检查是否有未合并分支或 PR 中计划使用这些模块<br>3. 如确认无使用计划且无近期提交：<br>   - 方案 A：安全删除（归档至 `docs/00-meta/archive/`）<br>   - 方案 B：保留但标记为 `@deprecated`，在 AGENTS.md 中注明为"预留模块"<br>4. 如果后续发现从其他路径（如 `@/lib/a11y` 等）被引用，更新此评估 |

#### 2.5.3 整体迁移方案对比

| 方案 | 描述 | 影响文件数 | 冲突情况 | 风险等级 |
|------|------|-----------|---------|---------|
| **A：逐个迁移至 `src/lib/`** | 按功能重命名后分别迁移到 `src/lib/` 下 | ~17 | 与 `src/lib/format.ts` 无冲突（可并存） | 中 |
| **B：整体移动为 `src/lib/utils/` 目录** | 将 `src/lib/` 整体移至 `src/lib/utils/` | ~17 + 58 | ⚠️ 与 `src/lib/utils.ts` 命名冲突（目录 vs 文件） | **高** |
| **C：保留并补充 AGENTS.md 定义** | 在 AGENTS.md 中补充 `src/lib/` 为"业务工具层" | 0 | 无 | 低（但增加目录复杂度，违反现有规范） |
| **D：拆分为 lib/ + components/ 混合** | a11y 迁至 `src/hooks/`；timeUtils 迁至 `../../src/config/timeouts.ts` | 视引用而定 | 部分 | 中 |

**推荐方案：A（逐个迁移）** — 理由：
- 避免与 `src/lib/utils.ts` 的命名冲突
- 每个文件职责清晰，按功能命名更符合 AGENTS.md 的库函数定义
- 修改范围可控（约 17 个文件），可分步执行
- 不引入新目录层级，保持现有结构扁平

---

## 三、综合建议

### 3.1 执行优先级

| 优先级 | 工作项 | 风险 | 预计影响文件数 |
|--------|--------|------|---------------|
| P1 | 删除 `../../src/showcase/index.ts` + 迁移测试文件 | 低 | 2 |
| P2 | 迁移 `src/lib/validation.ts` → `src/lib/validation.ts` | 中 | ~11 |
| P3 | 迁移 `src/lib/xssSanitizer.ts` → `src/lib/xssSanitizer.ts` | 中 | 2 |
| P4 | 迁移 `src/lib/precision.ts` → `src/lib/format.ts` | 中 | 4 |
| P5 | 确认 `a11y.ts` 和 `timeUtils.ts` 的死代码状态后删除或归档 | 低 | 2 |

### 3.2 验证清单（执行后必须完成）

- [ ] `npx tsc --noEmit` 类型检查通过
- [ ] `npm run audit:layers` 无跨层调用违规
- [ ] `npm test -- --run` 单元测试通过（含迁移后的测试文件）
- [ ] `npm run audit:deadcode` 确认无新增未注册文件
- [ ] 更新 AGENTS.md §一 目录定义（如删除 `src/core/databridge.ts` 后确认目录列表一致性）

### 3.3 备注

- `src/lib/validation.ts` 和 `src/lib/xssSanitizer.ts` 是安全敏感文件（涉及 XSS 防护、API Key 脱敏、URL 协议校验），迁移时务必保持文件内容不变，仅修改 import 路径和文件名
- `src/lib/validation.ts` 和 `src/lib/format.ts` 当前无任何引用，但不排除在代码中通过子路径别名（如 `import { generateId } from '...'` 使用相对路径）引用。建议在执行删除前，通过 `grep -r "generateId" src/` 和 `grep -r "formatTime" src/` 确认无相对路径引用
- 本报告基于 2026-07-12 的代码快照。如后续有新提交引入对这些文件的引用，需重新评估
