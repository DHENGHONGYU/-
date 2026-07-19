---
title: testing-strategy
type: reference
domain: qa
phase: testing
tier: important
status: active
maintainer: V9 Architecture Team
summary: "src/data/ 阈值较低（35%），因 IndexedDB 迁移与 Schema 创建逻辑多为声明式，测试 ROI 低；src/core/ 侧重分支覆盖（75%），因 ACL、Envelope、"
tags: [qa, strategy, test, testing, reference]
version: v1.0.0
last_updated: 2026-07-17
code_version: 2.0.0
doc_id: V9-DOC-QA-010
change_log:
  - version: v1.0.0
changes: Initial version established
date: 2026-07-17
---

# V9 三层测试策略

> **Version**: v2.0.0 | **日期**: 2026-07-12
> **适用范围**: V9 智能投研复盘系统所有新增模块
> **配套文档**: [测试资产目录与清单](test-catalog.md) — 全量测试文件索引与已知问题追踪

---

## 一、测试哲学与分层模型

V9 采用**四层测试金字塔**，从下到上成本递增、粒度递减：

```
        ▲
       / \    视觉回归 (Playwright Snapshot)
      /   \   职责：关键页面像素级对比，防止 UI 漂移
     /─────\  规模：~5 个场景，目标 20 个
    /       \
   /─────────\  E2E (Playwright)
  /           \ 职责：核心用户路径端到端验证
 /             \规模：~17 个 spec，覆盖 5 舱关键流程
/───────────────\
/                 \ 集成测试 (Vitest + fake-indexeddb)
/                   \职责：跨模块契约、DataBridge、ACL、Widget 注册同步
/─────────────────────\规模：~15 个文件，含契约测试 suite
/                       \
/─────────────────────────\ 单元测试 (Vitest + jsdom)
/                           \职责：函数、Store、Service、组件、类型守卫
/                             \规模：~200 个文件，测试资产主体
─────────────────────────────
```

| 层级 | 范围 | 工具/环境 | 目标 | 门禁位置 |
|------|------|-----------|------|----------|
| **单元测试** | 函数、Store、Service、工具类、原子/分子组件 | Vitest + jsdom | 核心模块覆盖率 ≥ 70%，全局基线 80% | pre-commit / CI |
| **集成测试** | DataBridge、EventBus、ACL、Widget 注册三处同步、Store 跨 Tab 广播 | Vitest + fake-indexeddb | 模块间契约零违规 | CI |
| **E2E 测试** | 关键用户路径、路由跳转、驾驶舱渲染、表单提交 | Playwright (Chromium) | 核心流程全通过 | 发布前 |
| **视觉回归** | 驾驶舱、股票池看板、评分页关键截图 | Playwright `toHaveScreenshot` | 像素差异 ≤ 2% | 发布前 |

> **核心原则**：
> 1. **单元测试优先**：新增代码必须有单元测试覆盖；E2E 仅覆盖用户路径，不替代单元断言。
> 2. **契约即文档**：集成测试断言模块间接口契约，契约变更必须同步更新测试。
> 3. **失败即阻断**：单元/集成测试失败阻断 CI 合并；E2E/视觉回归失败阻断发布。
> 4. **清理即义务**：所有 `vi.useFakeTimers()` / `EventBus.subscribe()` / `window.addEventListener()` 必须在 cleanup 中移除（AGENTS.md §三）。

---

## 二、测试目录与放置策略

### 2.1 目录结构

```
├── e2e/                          ← E2E & 视觉回归 (Playwright)
│   ├── *.spec.ts                 ← 端到端测试用例 (~17 个)
│   ├── visual-regression.spec.ts ← 视觉回归主入口
│   └── visual-regression.spec.ts-snapshots/ ← 基线截图（版本控制）
│
├── tests/                        ← 集中式单元 & 集成测试
│   ├── setup.ts                  ← 全局前置（fake-indexeddb + jsdom mock + cleanup）
│   ├── contracts/                ← 契约测试套件（DataBridge / Envelope / Store / Strategy）
│   ├── __tests__/                ← 补充测试（类型 / 集成 / 回归 / 快照）
│   ├── __mocks__/                ← 全局 mock
│   ├── fixtures/                 ← 静态测试数据集
│   └── helpers/                  ← 测试辅助函数
│
└── src/                          ← 源码共置测试（推荐）
    ├── **/*.test.ts              ← 与源码同目录的单元测试
    └── **/*.test.tsx             ← 组件测试
```

### 2.2 共置 vs 集中决策树

| 策略 | 位置 | 适用场景 |
|------|------|---------|
| **共置（推荐）** | `src/{layer}/ModuleName.test.ts` | 新增 Store、Service、组件、核心工具。与源码同目录，重构时同步更新。 |
| **集中** | `tests/` 根或子目录 | 跨模块集成测试、E2E、契约测试、性能测试、fixtures 与 helpers。 |

**决策规则**：单模块内聚测试 → 共置；跨模块契约/端到端/性能 → 集中。

---

## 三、单元测试策略（Layer 1）

### 3.1 覆盖义务

| 代码类型 | 测试义务 | 最低要求 |
|---------|---------|---------|
| Zustand Store | 状态变化、选择器、异步 action、错误分支 | 每个 action 至少 1 个 success + 1 个 error 分支 |
| Service | 成功/失败/重试/边界输入/ACL 拒绝 | 外部依赖必须 mock |
| 组件 (Atoms/Molecules) | 渲染、交互、空状态、错误状态 | `@testing-library/react` + `userEvent` |
| 工具函数 | 边界值、异常输入、类型守卫 | 等价类划分 |
| 类型守卫 | 正例 + 反例 | `Expect<Equals>` 类型测试（复杂泛型） |

### 3.2 Store 测试模板

```typescript
// ? 标准模板：Zustand Store 单元测试
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useAnalysisStore } from '@/store/analysisStore'

const initialState = useAnalysisStore.getState()

describe('analysisStore', () => {
  beforeEach(() => {
    act(() => {
      useAnalysisStore.setState(initialState, true) // true = replace
    })
  })

  afterEach(() => {
    vi.useRealTimers() // ← AGENTS.md §三 强制要求
  })

  it('should update score on fetch success', async () => {
    // Arrange
    const mockScore = { symbol: '600519', v6Score: 4.5 }
    vi.mocked(dataLayer.v6Scores.get).mockResolvedValue(mockScore)

    // Act
    await act(async () => {
      await useAnalysisStore.getState().fetchScore('600519')
    })

    // Assert
    expect(useAnalysisStore.getState().scoreMap.get('600519')).toEqual(mockScore)
  })

  it('should set error on fetch failure', async () => {
    vi.mocked(dataLayer.v6Scores.get).mockRejectedValue(new Error('DB error'))

    await act(async () => {
      await useAnalysisStore.getState().fetchScore('600519')
    })

    expect(useAnalysisStore.getState().error).toBe('DB error')
  })
})
```

### 3.3 组件测试模板

```typescript
// ? 标准模板：React 组件测试
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Badge } from '@/components/atoms/Badge'

describe('Badge', () => {
  it('renders label and applies variant class', () => {
    render(<Badge label="测试" variant="success" />)
    expect(screen.getByText('测试')).toBeVisible()
    expect(screen.getByText('测试')).toHaveClass('bg-green-500')
  })

  it('handles click event', () => {
    const onClick = vi.fn()
    render(<Badge label="点击" onClick={onClick} />)
    fireEvent.click(screen.getByText('点击'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

---

## 四、集成测试策略（Layer 2）

### 4.1 契约测试

集成测试聚焦**模块间契约**，而非内部实现。核心契约清单：

| 契约 | 测试文件 | 断言要点 |
|------|---------|---------|
| **DataBridge 转发** | `tests/contracts/databridge.contract.ts` | 未知 action → `EnvelopeError`；Query 必须带 `payload.store`；写操作触发缓存失效 + 审计日志 |
| **Envelope 验证** | `tests/contracts/envelope.contract.ts` | 非法 target → reject；缺失 traceId → reject；timestamp ≤ 0 → reject |
| **Store 跨 Tab 广播** | `tests/contracts/store.contract.ts` | `withBroadcast` 写后触发 `eventBus.emit`；广播失败不阻塞写；清理函数正确移除监听 |
| **Widget 注册三处同步** | `tests/contracts/strategy.contract.ts` | 所有 `widgetRegistry` 中的 widgetId 在 `DEFAULT_WIDGET_CONFIG` 和 `WIDGET_DEFAULT_DATA_SOURCE` 中均存在 |
| **ACL 权限矩阵** | `tests/__tests__/integration/stockpool-acl.integration.test.ts` | 各模块仅可读写 ACL_MATRIX 授权的存储表 |
| **MCP Server 全链路** | `tests/__tests__/integration/mcp-servers.integration.test.ts` | 16 个 Server 的工具列表与权限矩阵一致 |

### 4.2 集成测试模板

```typescript
// ? 标准模板：跨模块集成测试
import { describe, it, expect } from 'vitest'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'

describe('DataBridge → DB 写入链路', () => {
  it('should route saveScores to v6_scores store and invalidate cache', async () => {
    const envelope = EnvelopeFactory.create(
      { source: 'analyzer', target: 'db', action: 'SAVE_SCORES', traceId: 'test-1' },
      { symbol: '600519', score: 4.5 },
    )

    await dataBridge.forward(envelope)

    // 断言：数据已写入 DB
    const saved = await db.get('v6_scores', '600519')
    expect(saved?.score).toBe(4.5)

    // 断言：缓存已失效（后续 query 应走 DB）
    // 具体实现依赖 MemoryCache 内部状态，建议 spyOn invalidateCache
  })
})
```

---

## 五、E2E 测试策略（Layer 3）

### 5.1 覆盖范围

E2E 测试仅覆盖**关键用户路径**，不追求全量：

| 舱室 | 关键路径 | spec 文件 |
|------|---------|----------|
| **输入舱** | 采集向导完整流程、批量导入、股票搜索 | `e2e/input-data-collection.spec.ts` / `input-stock-pool.spec.ts` / `bulk-import-full.spec.ts` |
| **分析舱** | 智能评分页、股票详情页、板块分析 | `e2e/analysis-scoring.spec.ts` / `analysis-extended.spec.ts` / `stock-score.spec.ts` |
| **交易舱** | 持仓看板、补仓/平仓、交易复盘 | `e2e/trading.spec.ts` / `trade-review.spec.ts` / `pool-group.spec.ts` |
| **输出舱** | 报告中心、命令执行 | `e2e/output-cabin.spec.ts` / `output-command.spec.ts` |
| **指令舱** | MCP 验证、数据迁移 | `e2e/mcp-verify.spec.ts` / `data-migration.spec.ts` |
| **全局** | 响应式布局、无障碍 | `e2e/responsive.spec.ts` / `accessibility.spec.ts` |

### 5.2 E2E 测试原则

1. **不测试视觉细节**：视觉细节由视觉回归测试覆盖
2. **不测试数据准确性**：数据准确性由单元/集成测试覆盖
3. **聚焦用户行为**：点击、输入、导航、表单提交、页面跳转
4. **独立环境**：每个 spec 文件独立运行，不共享状态

---

## 六、视觉回归测试策略（Layer 4）

### 6.1 配置基线

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 工具 | Playwright `toHaveScreenshot` | 像素级对比 |
| 容差 | `maxDiffPixelRatio: 0.02` | 允许 2% 像素差异 |
| 阈值 | `threshold: 0.2` | 单像素色差阈值 |
| 浏览器 | Desktop Chrome | 单一浏览器减少基线数量 |
| 基线目录 | `e2e/visual-regression.spec.ts-snapshots/` | 已纳入版本控制 |

### 6.2 场景清单（当前 → 目标）

| # | 场景 | 状态 |
|---|------|------|
| 1 | 驾驶舱全屏渲染 | ? |
| 2 | 分析舱评分页 | ? |
| 3 | 输入舱采集向导 | ? |
| 4 | 交易舱持仓看板 | ? |
| 5 | 暗色模式切换 | ? |
| 6-20 | 其余舱室首屏与关键交互态 | ?? 待补齐（P3） |

### 6.3 运行命令

```powershell
# 运行视觉回归（与基线对比）
npm run test:e2e:visual

# 更新基线（UI 变更已确认后）
npm run test:e2e:visual:update
```

---

## 七、覆盖率基线与门禁

### 7.1 全局目标

| 指标 | 目标值 | 当前状态 | 说明 |
|------|--------|----------|------|
| **Statements** | ≥ 80% | ?? 待测量 | 全局基线 |
| **Branches** | ≥ 75% | ?? 待测量 | 条件分支覆盖 |
| **Functions** | ≥ 80% | ?? 待测量 | 函数入口覆盖 |
| **Lines** | ≥ 80% | ?? 待测量 | 行覆盖 |

### 7.2 分层硬性阈值（vite.config.ts）

以下阈值写入 Vitest `coverage.thresholds`，未达标即 CI 失败：

| 目录 | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `src/core/**` | 55 | 75 | 60 | 55 |
| `src/data/**` | 35 | 35 | 35 | 35 |
| `src/lib/**` | 70 | 65 | 80 | 70 |
| `src/services/**` | 70 | 65 | 70 | 70 |

> **说明**：`src/data/**` 阈值较低（35%），因 IndexedDB 迁移与 Schema 创建逻辑多为声明式，测试 ROI 低；`src/core/**` 侧重分支覆盖（75%），因 ACL、Envelope、RouteGuard 的条件分支直接影响安全。

---

## 八、Mock 与测试数据策略

### 8.1 Mock 分层

| 层级 | 工具/位置 | 用途 |
|------|-----------|------|
| **全局 Mock** | `tests/__mocks__/` | 第三方库全局替换（`nanoid`、`dayjs`） |
| **Fixtures** | `tests/fixtures/` | 领域对象静态数据集（orders、portfolios、signals） |
| **Factories** | `tests/unit/mockFactories.ts` | 动态生成假数据的工厂函数 |
| **Helpers** | `tests/helpers/` | LLM Mock Fetch、Widget 测试工具 |
| **局部 Mock** | 测试文件内 `vi.mock()` | 模块级精细控制 |

### 8.2 关键 Mock 策略

| 外部依赖 | Mock 策略 | 位置 |
|---------|----------|------|
| **IndexedDB** | `fake-indexeddb` 全局替代 | `tests/setup.ts` |
| **LLM API** | `tests/helpers/llmMockFetch.ts` 拦截 fetch | 集成测试 |
| **行情数据** | `tests/mockStockData.ts` 静态数据 | 单元测试 |
| **Browser API** | `matchMedia` / `IntersectionObserver` / `ResizeObserver` no-op mock | `tests/setup.ts` |

---

## 九、测试清理义务（AGENTS.md §三 强制）

### 9.1 定时器清理

```typescript
// ? 强制模板
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })
```

### 9.2 事件监听清理

```typescript
// ? 强制模板
const unsubscribe = EventBus.subscribe('event', handler)
// ... 测试断言 ...
unsubscribe() // ← 测试内显式清理
```

### 9.3 DOM 清理

```typescript
// ? 已全局配置于 tests/setup.ts，无需每文件重复
// afterEach(() => cleanup())
```

---

## 十、已知问题与 CI 基线

### 10.1 排除清单（`test:clean`）

以下 8 个测试文件因外部依赖不稳定或遗留债务被 CI 排除：

| # | 文件路径 | 排除原因 | 优先级 |
|---|----------|----------|--------|
| 1 | `src/store/agentStore.test.ts` | LLM 多模型切换 Mock 未完全隔离 | P1 |
| 2 | `src/services/fetcher/fetcherClient.test.ts` | 数据源适配器网络 I/O 竞态 | P1 |
| 3 | `src/services/llm/llmClient.multimodel.test.ts` | 多模型 Provider 依赖环境变量 | P1 |
| 4 | `tests/fetcher/dataSourceProvider.test.ts` | 第三方接口变更频繁 | P2 |
| 5 | `tests/ui-components.test.tsx` | 旧版组件重复断言 | P2 |
| 6 | `tests/agentModule.integration.test.tsx` | Agent 模块重构中集成点待稳定 | P2 |
| 7 | `tests/engine.test.ts` | 引擎全链路测试过重，待拆分 | P1 |
| 8 | `tests/sectorScoreService.test.ts` | Mock 数据与真实结构漂移 | P2 |

### 10.2 CI 运行命令对照

```powershell
# CI 绿色基线（排除上述 8 个）
npm run test:clean

# 单独运行已知问题文件（调试用）
npm run test:known

# 全量运行（含已知问题，可能失败）
npm test -- --run
```

> **审计**：`audit:tests` 会自动校验 `test:clean` 与 `test:known` 的双向一致性。

---

## 十一、回滚验证流程

执行 AGENTS.md §二「四步集成」回滚时，必须按以下顺序验证：

```powershell
# 1. 类型安全
npx tsc --noEmit

# 2. 文档同步
npm run audit:docs

# 3. 架构合规
npm run audit:layers

# 4. 单元测试通过（clean 基线）
npm run test:clean

# 5. 可选：E2E 回归（重大回滚时）
npm run test:e2e
```

---

## 十二、运行命令速查

```powershell
# ── 单元测试 ──
npm run test              # 全量运行（Vitest run）
npm run test:watch        # 监听模式
npm run test:ci           # CI 模式 + 覆盖率
npm run test:staged       # 仅与 git staged 文件相关的测试
npm run test:clean        # 排除已知问题文件的绿色基线
npm run test:known        # 仅运行已知问题文件（调试）

# ── E2E & 视觉回归 ──
npm run test:e2e          # Playwright 全量 E2E
npm run test:e2e:ui       # Playwright UI 模式
npm run test:e2e:visual   # 视觉回归测试
npm run test:e2e:visual:update  # 更新视觉基线

# ── 覆盖率 ──
npm run coverage          # 生成覆盖率报告

# ── 测试审计 ──
npm run audit:tests       # 测试文件合规性扫描
```

---

## 十三、改进路线

| 阶段 | 目标 | 时间线 |
|------|------|--------|
| **短期（P1）** | 修复 8 个排除测试文件；补齐 `src/core/**` 分支覆盖率至 75% | 2 周 |
| **中期（P2）** | 补齐 ~23 个缺少测试的 Store；organisms 层级组件测试覆盖 | 1 个月 |
| **长期（P3）** | 视觉回归场景扩展至 20 个；E2E 覆盖 Safari/Firefox；数据层覆盖率评估提升 | 2 个月 |

---

## 十四、相关文档索引

| 文档 | 路径 | 内容 |
|------|------|------|
| 测试资产目录 | `./test-catalog.md` | 全量测试文件索引、按舱室/服务/Store 分类清单 |
| ../../AGENTS.md 测试约束 | `../../AGENTS.md` §二/三/七 | 四步集成回滚验证、事件监听清理模板、验证命令 |
| 编码规范 | `./coding-conventions.md` | 测试命名与目录约定 |
| 运维基线 | `../explanation/runbook.md` | CI/CD 流水线配置 |
| Vite 测试配置 | `vite.config.ts` | 测试环境、覆盖率阈值、pool 配置 |
| 全局 setup | `tests/setup.ts` | fake-indexeddb、Browser API mock、cleanup |


<!-- merge-source: docs/how-to/testing/testing-strategy.md (2026-07-14 内容融合，避免去重丢失有效信息) -->
## 补充内容（合并自 `docs/how-to/testing/testing-strategy.md`）

| 层级 | 范围 | 工具 | 目标 | 门禁位置 |
| 单元测试 | 函数、Store、Service、工具类 | Vitest + jsdom | 覆盖率 ≥ 70%，核心模块 ≥ 85% | pre-commit / CI |
| 集成测试 | 跨模块调用、DataBridge、EventBus、Widget 注册 | Vitest + fake-indexeddb | 验证模块间契约与边界场景 | CI |
| E2E 测试 | 关键用户路径、路由、驾驶舱渲染 | Playwright | 覆盖核心流程，视觉回归可选 | 发布前 |
## 2. 关键边界场景清单
### 2.1 Widget 注册三处同步
新增 Widget 时必须同步：
1. `src/cockpit/core/widgetRegistry.ts` 注册模板
2. `src/constants/cockpit.constants.ts` 的 `DEFAULT_WIDGET_CONFIG` 注册默认配置
3. 同文件的 `WIDGET_DEFAULT_DATA_SOURCE` 注册数据源
集成测试应断言：所有注册在 `widgetRegistry` 中的 widgetId，均在后两者中存在对应配置。
### 2.2 DataBridge 转发
- 未知 action 应抛出 `EnvelopeError`
- Query 路径必须携带 `payload.store`
- 写操作成功后应触发缓存失效与审计日志
- 跨模块 ACL 校验失败应返回 `success: false`
### 2.3 Store 跨 Tab 广播
- `withBroadcast` 在写操作后应触发 `eventBus.emit`
- 广播失败不应阻塞写操作
- 多个 Store 订阅同一事件时，清理函数应正确移除监听
## 3. 新增模块测试义务
新增模块按「类型→Store→Service→UI」四步集成时，每步必须：
1. 类型：添加 `tests/__tests__/types/` 下的类型断言（复杂泛型）
2. Store：覆盖状态变化、选择器、异步 action、错误分支
3. Service：覆盖成功/失败/重试/边界输入
4. UI：覆盖渲染、交互、空状态、错误状态、事件监听清理
## 4. 测试命名与目录约定
- 单元测试：`src/lib/validation.test.ts` 或 `__tests__/ModuleName.test.ts`
- 集成测试：`tests/integration/xxx.integration.test.ts`
- E2E 测试：`e2e/xxx.spec.ts`
- 类型测试：`tests/__tests__/types/xxx.spec.ts`
npm run test
# 仅运行与本次改动相关的测试（lint-staged 使用）
npm run test:staged
npm run test -- tests/integration
npm run test:ci
- 单元测试失败直接阻断本地提交（Husky pre-commit）
- 集成测试失败阻断 PR 合并
- E2E 失败阻断发布，但允许在紧急修复中跳过并记录
- 短期：补齐 DataBridge、withBroadcast、Widget 注册三处同步测试
- 中期：引入集成测试套件，覆盖采集→存储→UI 反馈链路
- 长期：建立视觉回归基线，覆盖驾驶舱与股票池看板
