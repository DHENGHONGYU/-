---
title: 测试策略文档
version: v1.2.0
last_updated: 2026-07-05
maintainer: Quality Auditor
status: active
change_log:
  - version: v1.2.0
    changes: "C 类版本闭环(2026-08-11)：补全 change_log 初始条目"
    date: 2026-07-05
---

# 测试策略文档

> **适用范围**：V9 智能投研复盘系统全项目测试规范
> **测试框架**：vitest + @testing-library/react + Playwright
> **配置文件**：`vite.config.ts`（test 配置段）

---

## 一、测试工具链

### 1.1 核心工具

| 工具 | 版本 | 用途 | 配置位置 |
|:---|:---|:---|:---|
| vitest | 项目依赖 | 单元/集成测试运行器 | `vite.config.ts` test 段 |
| @testing-library/react | 项目依赖 | React 组件渲染与交互测试 | — |
| @testing-library/jest-dom | 项目依赖 | DOM 断言扩展（toBeVisible 等） | — |
| jsdom | 项目依赖 | 浏览器环境模拟（单元测试） | `vite.config.ts` environment |
| Playwright | 项目依赖 | E2E 端到端测试 | `e2e/` 目录 |

### 1.2 运行命令

```bash
# 运行全部单元/集成测试
npm run test           # 等价于 npx vitest run

# 运行指定测试文件
npx vitest run tests/myModule.test.ts

# 监听模式（开发阶段）
npx vitest             # 修改后自动重跑

# 运行 E2E 测试
npm run test:e2e       # npx playwright test
npm run test:e2e:ui    # Playwright UI 模式

# 运行审计扫描
npm run audit           # layers + hardcode + deadcode + docs
```

### 1.3 vitest 配置要点

```typescript
// vite.config.ts（test 配置段）
test: {
  globals: true,           // 支持 describe/it/expect 全局使用
  environment: 'jsdom',     // DOM 模拟环境
  setupFiles: [],          // 测试前置设置（如需）
  testTimeout: 10000,       // 默认超时 10s（IndexedDB 操作需较长超时）
  exclude: ['e2e/**'],      // 排除 E2E 测试避免冲突
}
```

---

## 二、测试分层

### 2.1 三层测试金字塔

```
          ┌─────────────┐
          │   E2E 测试    │  ← 少量，关键路径验证
          │  Playwright   │
         ┌┴─────────────┴┐
         │  集成测试       │  ← 中等，Store + 组件交互
         │ @testing-library│
        ┌┴───────────────┴┐
        │   单元测试         │  ← 大量，函数/工具/Store
        │   vitest          │
        └───────────────────┘
```

### 2.2 分层详情

| 层级 | 范围 | 工具 | 典型目标 | 示例 |
|:---|:---|:---|:---|:---|
| **单元测试** | 单个函数/类/模块 | vitest | 纯逻辑、工具函数、Store 方法 | `signalGenerator.test.ts` |
| **集成测试** | 组件 + Store + 服务交互 | vitest + @testing-library/react | 页面渲染、用户交互、Store mock | `StockAnalysisPage.test.tsx` |
| **E2E 测试** | 完整用户流程 | Playwright | 路由跳转、数据提交、分组 UI | `e2e/pool-group.spec.ts` |

### 2.3 测试文件命名规范

```
tests/
  ├── <模块名>.test.ts           # 纯逻辑/服务单元测试
  ├── <模块名>.test.tsx           # React 组件测试
  ├── <模块名>.lifecycle.test.tsx # 生命周期/cleanup 专项测试
  ├── <模块名>.bookmarks.test.ts # 特定功能域测试
  ├── services/
  │   └── <服务名>.test.ts       # 服务层测试
  ├── news-v6/
  │   ├── NewsPage.test.tsx       # 子模块组件测试
  │   └── NewsFeed.test.tsx
  ├── fetcher/
  │   └── dataSourceProvider.test.ts
  └── pwa.test.ts                 # PWA 功能测试
```

---

## 三、命名规范

### 3.1 describe/it 结构

```typescript
describe('MyModule', () => {
  // 按"功能点"组织 describe
  describe('calculateScore', () => {
    it('should return 100 for perfect input', () => {
      // ...
    })

    it('should return 0 for empty input', () => {
      // ...
    })

    it('should clamp negative values to 0', () => {
      // ...
    })
  })

  describe('handleError', () => {
    it('should log error and set error state', () => {
      // ...
    })
  })
})
```

### 3.2 命名规则

| 元素 | 规则 | 示例 |
|:---|:---|:---|
| describe（顶层） | 模块/组件名称 | `describe('ValuePitWidget', ...)` |
| describe（嵌套） | 功能点/方法名 | `describe('getScoreColor', ...)` |
| it | 行为描述，`should ...` 模式 | `it('should return correct color for high scores', ...)` |
| test 文件 | 与被测文件同名 + `.test.ts/tsx` | `signalGenerator.test.ts` |

---

## 四、Store Mock 模式

### 4.1 Zustand Store mock 标准模式

使用 `vi.mock()` 替换 Store 模块，返回预定义的状态：

```typescript
import { vi } from 'vitest'

// mock 整个 Store 模块
vi.mock('@/store/dualStrategyStore', () => ({
  useDualStrategyStore: vi.fn((selector) => {
    const state = {
      valuePitScores: mockData,
      isLoading: false,
      error: null,
    }
    return selector(state)
  }),
}))
```

### 4.2 Selector 灵活 mock

通过 `vi.fn` 实现 selector 模式，支持测试中动态切换状态：

```typescript
const mockStoreState = {
  isLoading: false,
  error: null as string | null,
  data: [] as MyData[],
}

vi.mock('@/store/myStore', () => ({
  useMyStore: vi.fn((selector: Function) => selector(mockStoreState)),
}))

// 在具体测试中修改状态
beforeEach(() => {
  mockStoreState.isLoading = false
  mockStoreState.data = [{ id: 1, name: 'test' }]
})

it('should show loading state', () => {
  mockStoreState.isLoading = true
  render(<MyComponent />)
  expect(screen.getByText('加载中...')).toBeInTheDocument()
})
```

### 4.3 多 Store mock

当组件依赖多个 Store 时：

```typescript
vi.mock('@/store/storeA', () => ({
  useStoreA: vi.fn((sel) => sel(mockStateA)),
}))

vi.mock('@/store/storeB', () => ({
  useStoreB: vi.fn((sel) => sel(mockStateB)),
}))
```

---

## 五、useEffect cleanup 测试模式

### 5.1 cancelled flag 验证

验证组件卸载后异步操作不会更新状态：

```typescript
describe('useEffect cleanup', () => {
  it('should not update state after unmount', async () => {
    const { unmount } = render(<MyPage />)

    // 在异步操作完成前卸载组件
    unmount()

    // 等待异步操作完成
    await waitFor(() => {
      // 如果没有 cancelled flag，这里会抛出 "update on unmounted component" 警告
    })

    // 验证 Store 未被意外更新
    expect(useMyStore.getState().error).toBeNull()
  })
})
```

### 5.2 try-catch 错误处理测试

```typescript
describe('async error handling', () => {
  it('should catch error and set error state', async () => {
    // mock 服务层抛出错误
    vi.mocked(myService.getData).mockRejectedValueOnce(new Error('Network Error'))

    render(<MyPage />)

    await waitFor(() => {
      expect(screen.getByText(/加载失败/)).toBeInTheDocument()
    })
  })
})
```

### 5.3 依赖数组变化测试

```typescript
describe('dependency changes', () => {
  it('should refetch when dependency changes', async () => {
    const { rerender } = render(<MyPage symbol="600519" />)

    // 切换依赖
    rerender(<MyPage symbol="000858" />)

    await waitFor(() => {
      expect(myService.getData).toHaveBeenCalledWith('000858')
    })
  })
})
```

---

## 六、覆盖率目标

### 6.1 按模块分层覆盖率要求

| 模块层级 | 目录 | 最低覆盖率 | 说明 |
|:---|:---|:---|:---|
| **core** | `src/core/` | >= 85% | DataBridge、Envelope、ACL、EventBus 等基础设施 |
| **data** | `src/data/` | >= 85% | IndexedDB 封装、数据层接口 |
| **lib** | `src/lib/` | >= 85% | 工具函数（logger、precision 等） |
| **store** | `src/store/` | >= 80% | Zustand Store 逻辑 |
| **services** | `src/services/` | >= 70% | 业务服务层 |
| **pages** | `src/pages/` | >= 60% | 页面组件（侧重关键路径） |
| **components** | `src/components/` | >= 60% | 共享 UI 组件 |
| **config** | `src/config/` | >= 70% | 配置校验、类型安全 |
| **hooks** | `src/hooks/` | >= 70% | 自定义 Hook |
| **constants** | `src/constants/` | >= 50% | 常量映射（侧重转换函数） |

### 6.2 覆盖率运行

```bash
# 生成覆盖率报告
npx vitest run --coverage

# 查看覆盖率报告（HTML）
# 报告生成在 coverage/ 目录
```

### 6.3 当前覆盖率基线

| 指标 | 值 |
|:---|:---|
| 测试文件总数 | 70+ |
| 测试用例总数 | 649+（4 个历史遗留失败，Windows ENOENT 环境问题） |
| 通过率 | 99.4%（649/653，排除已知 V6 引擎/LLM/E2E 预存失败） |

---

## 七、测试模式速查

### 7.1 页面组件测试模板

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Store
vi.mock('@/store/myStore', () => ({
  useMyStore: vi.fn((sel) => sel(mockState)),
}))

// Mock 服务
vi.mock('@/services/myService', () => ({
  myService: {
    getData: vi.fn().mockResolvedValue([]),
  },
}))

describe('MyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state', () => {
    mockState.isLoading = true
    render(<MyPage />)
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('should render data after loading', async () => {
    mockState.isLoading = false
    mockState.data = [{ id: 1, name: '测试数据' }]
    render(<MyPage />)
    await waitFor(() => {
      expect(screen.getByText('测试数据')).toBeInTheDocument()
    })
  })

  it('should render error state', async () => {
    mockState.error = '网络错误'
    render(<MyPage />)
    expect(screen.getByText(/网络错误/)).toBeInTheDocument()
  })
})
```

### 7.2 服务层测试模板

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('myService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return processed data', async () => {
    const result = await myService.getData('600519')
    expect(result).toBeDefined()
    expect(result.symbol).toBe('600519')
  })

  it('should handle empty input gracefully', async () => {
    const result = await myService.getData('')
    expect(result).toEqual([])
  })

  it('should throw on invalid input', async () => {
    await expect(myService.getData(null)).rejects.toThrow()
  })
})
```

### 7.3 Widget 测试模板

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/store/myWidgetStore', () => ({
  useMyWidgetStore: vi.fn((sel) => sel(mockWidgetState)),
}))

const mockConfig = {
  instanceId: 'test_1',
  widgetId: 'myWidget',
  title: '测试 Widget',
  size: { cols: 2, rows: 2 },
}

describe('MyWidget', () => {
  it('should render title from config', () => {
    render(<MyWidget config={mockConfig} />)
    expect(screen.getByText('测试 Widget')).toBeInTheDocument()
  })

  it('should render empty state when no data', () => {
    mockWidgetState.data = []
    render(<MyWidget config={mockConfig} />)
    expect(screen.getByText(/暂无/)).toBeInTheDocument()
  })

  it('should render data items', () => {
    mockWidgetState.data = [{ name: '测试标的', score: 85 }]
    render(<MyWidget config={mockConfig} />)
    expect(screen.getByText('测试标的')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
  })
})
```

---

## 八、测试注意事项

### 8.1 IndexedDB 测试

IndexedDB 操作需要较长超时（`testTimeout: 10000`），避免全量并发执行时超时：

```typescript
it('should persist data to IndexedDB', async () => {
  // 使用 waitFor 增加等待时间
  await waitFor(() => {
    expect(result).toBeDefined()
  }, { timeout: 10000 })
})
```

### 8.2 已知失败项

以下测试为已知预存失败，不属于新增代码引入：

| 类别 | 说明 |
|:---|:---|
| V6 引擎测试 | 依赖外部 V6 引擎模块，本地环境缺失 |
| LLM 测试 | 依赖外部 LLM 服务，mock 不完整 |
| E2E 测试 | 部分依赖 Playwright 浏览器状态 |

### 8.3 测试前质量门禁

每次提交前应通过以下检查：

```bash
npm run tsc          # TypeScript 类型检查
npm run lint         # ESLint 零警告
npm run test         # 单元测试全通过
npm run build        # 生产构建成功
npm run audit        # 架构守护扫描
```

---

## 九、注册体系测试策略（v1.1.0 新增）

### 9.1 注册表测试要点

四层注册表（Store/Service/Component/Widget Registry）的测试侧重数据完整性与查询正确性：

| 测试维度 | 覆盖内容 | 优先级 |
|----------|----------|--------|
| 条目完整性 | 注册表条目数与预期一致 | P0 |
| ID 唯一性 | 无重复 ID | P0 |
| 查询函数 | `getByDomain`/`getByStatus`/`getById` 返回正确结果 | P1 |
| 统计函数 | `getStats` 返回正确的 active/available/deprecated 计数 | P1 |
| 状态一致性 | 注册表中的 Store/Service 路径与实际文件对应 | P2 |

### 9.2 注册表测试模板

```typescript
import { describe, it, expect } from 'vitest'
import {
  STORE_REGISTRY,
  getStoresByDomain,
  getStoresByStatus,
  getStoreById,
  getStoreStats,
} from '@/store/storeRegistry'

describe('storeRegistry', () => {
  it('should have correct total count', () => {
    expect(STORE_REGISTRY.length).toBe(29)
  })

  it('should have unique IDs', () => {
    const ids = STORE_REGISTRY.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should filter by domain', () => {
    const marketStores = getStoresByDomain('market')
    expect(marketStores.length).toBeGreaterThan(0)
    expect(marketStores.every(s => s.domain === 'market')).toBe(true)
  })

  it('should filter by status', () => {
    const activeStores = getStoresByStatus('active')
    expect(activeStores.length).toBeGreaterThan(0)
    expect(activeStores.every(s => s.status === 'active')).toBe(true)
  })

  it('should find store by ID', () => {
    const store = getStoreById('analysisStore')
    expect(store).toBeDefined()
    expect(store?.domain).toBe('analysis')
  })

  it('should return correct stats', () => {
    const stats = getStoreStats()
    expect(stats.total).toBe(29)
    expect(stats.active + stats.available + stats.deprecated).toBe(stats.total)
  })
})
```

### 9.3 Widget 错误边界测试

`WidgetErrorBoundary` 需要专项测试验证错误隔离能力：

```typescript
import { render, screen } from '@testing-library/react'
import { WidgetErrorBoundary } from '@/components/WidgetErrorBoundary'

// 故意抛出错误的测试组件
function ThrowingWidget(): React.JSX.Element {
  throw new Error('模拟 Widget 渲染崩溃')
}

describe('WidgetErrorBoundary', () => {
  it('should catch rendering errors and show fallback', () => {
    // 抑制 console.error 避免测试输出噪音
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <WidgetErrorBoundary widgetId="test" instanceId="test_1" errorTitle="测试组件加载异常">
        <ThrowingWidget />
      </WidgetErrorBoundary>
    )

    expect(screen.getByText('测试组件加载异常')).toBeInTheDocument()
    spy.mockRestore()
  })
})
```

---

## 十、Playwright 回归测试策略（v1.2.0 新增）

> **变更**: 2026-07-05 | v1.2.0 | 新增 §10 Playwright 回归测试策略

### 10.1 概述

Playwright 回归测试用于验证部署后所有页面的核心功能完整性，覆盖 P0 崩溃检测、P1 无障碍合规和视觉一致性。当前测试脚本为 `v9_final_check.py`，覆盖 10 个核心页面。

### 10.2 测试覆盖矩阵

| 检测维度 | 检测方法 | 通过标准 | 优先级 |
|----------|----------|----------|--------|
| **P0 崩溃检测** | 捕获页面 JS 错误（`page.on('pageerror')`） | 0 个未捕获异常 | P0 |
| **P1-4 对比度** | `getComputedStyle` 读取 `--primary` 计算白字对比度 | ≥ 4.5:1（WCAG AA） | P1 |
| **P1-6 无障碍** | 查询所有 `input/select/textarea` 检查 `aria-label` | 0 个缺失 | P1 |
| **P2-7 硬编码** | 扫描内联 HEX 颜色值 | 0 处违规 | P2 |

### 10.3 页面覆盖清单

| 页面 | 路径 | 检测项 |
|------|------|--------|
| 首页 | `/` | P0 |
| 驾驶舱 | `/cockpit` | P0 |
| 持仓管理 | `/trading/holdings` | P0 + P1-4 + P1-6 |
| 命令中枢 | `/command` | P0 + P1-4 |
| 系统监控 | `/command/monitor` | P0 + P1-4 |
| 智能资讯 | `/analysis/news` | P0 + P1-4 |
| 分析舱 | `/analysis` | P0 |
| 股票池 | `/input` | P0 |
| 行业评分 | `/analysis/industry-score` | P0 + P1-6 |
| 智能评分 | `/analysis/intelligent-score` | P0 + P1-6 |

### 10.4 Playwright 定位器规范

```python
# ✅ 正确：使用语义定位器
page.get_by_role("heading", name="交易持仓管理")
page.get_by_role("button", name="开始智能评分")
page.get_by_label("股票代码")

# ❌ 错误：文本匹配可能触发严格模式违规
page.locator("text=开始")  # 可能匹配多个元素
```

### 10.5 双模式覆盖（计划中）

当前 Playwright 默认使用系统暗色模式。后续版本需分别以亮色/暗色模式运行回归测试：

```python
# 暗色模式
context = browser.new_context(color_scheme="dark")
# 亮色模式
context = browser.new_context(color_scheme="light")
```

> **变更**: 2026-07-05 | v1.2.0 | 新增 §10 Playwright 回归测试策略 | 质量治理小组
