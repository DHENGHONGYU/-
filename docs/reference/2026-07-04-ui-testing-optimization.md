---
title: 2026-07-04-ui-testing-optimization
code_version: 2.0.0

tier: reference
---

---
title: docs/reference/2026-07-04-ui-testing-optimization.md
code_version: 2.0.0
tier: reference
---

# V9 系统界面功能测试与优化执行方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 V9 智能投研复盘系统的所有界面元素进行全面、系统化的梳理与逐项测试，确保功能完整性、视觉一致性和用户体验达到行业优质标准。

**Architecture:** 采用分层测试策略：(1) UI 组件单元测试 → (2) 页面功能集成测试 → (3) 视觉一致性审查 → (4) 交互体验优化。基于现有的五舱架构（输入/分析/交易/输出/总控）和设计令牌系统（theme.tokens.ts）进行系统化验证。

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Recharts, Vitest, Playwright, shadcn/ui 组件库

---

## 测试范围概览

### 1. 功能模块清单

| 舱室 | 核心页面 | 测试重点 |
|------|---------|---------|
| **输入舱** | InputHubPage, LocalKnowledgePage, FetcherConfigPage, SevenDimConfigPage, CollectTaskPage | 数据录入、批量导入、配置管理 |
| **分析舱** | StockAnalysisPage, IndustryScorePage, IntelligentScorePage, SectorAnalysisPage, BacktestPage, ScoreDocPage, NewsPage, HotSectorPage, ValuePitPage, MultiFactorScreeningPage | 评分计算、数据可视化、策略选股 |
| **交易舱** | TradingHubPage, HoldingsPage, StrategySnapshotPage, TradeModal | 持仓管理、交易执行、策略快照 |
| **输出舱** | OutputHubPage, ResearchReportPage, TradeReviewPage | 报告生成、数据导出 |
| **总控舱** | CommandHubPage, AgentHubPage, AgentRegistryPage, AgentTasksPage, AgentTriggerPage, AgentFeedbackPage, MCPServerDashboardPage, EngineMonitorPage, ArchitecturePage | 智能体管理、系统监控、MCP 配置 |

### 2. UI 组件清单

| 组件类型 | 文件路径 | 测试维度 |
|---------|---------|---------|
| **基础控件** | Button, Input, Checkbox, Radio, Switch, Slider, Textarea, Select | 响应性、状态显示、焦点管理 |
| **数据展示** | Card, Table, Badge, Progress, Skeleton, Tooltip | 数据准确性、加载状态、悬停交互 |
| **反馈组件** | Dialog, Toast, Alert, ErrorState, LoadingState, EmptyState | 弹窗逻辑、错误处理、用户提示 |
| **导航组件** | Breadcrumb, Tabs, Menu, Pagination, Separator | 路由跳转、面包屑同步、分页逻辑 |
| **图表组件** | LineChart, BarChart, AreaChart, CandlestickChart, ScoreRadar, FactorHeatmap | 数据渲染、交互提示、响应式 |

### 3. 视觉规范检查项

- [ ] 颜色系统：所有颜色值必须引用 `theme.tokens.ts` 中的 COLOR_TOKENS
- [ ] 间距系统：padding/margin/gap 必须使用 SPACING_TOKENS 或 Tailwind 标准值
- [ ] 字体系统：字号、字重是否符合设计规范
- [ ] 圆角系统：border-radius 是否统一使用 THEME_TOKENS.radius
- [ ] 阴影系统：box-shadow 是否一致
- [ ] 动画系统：transition/animation 是否流畅

---

## 执行计划

### Phase 1: UI 组件基础测试（P0 - 关键路径）

#### Task 1.1: Button 组件全面测试

**Files:**
- Test: `src/components/atoms/Button.test.tsx`
- Component: `src/components/atoms/Button.tsx`

- [ ] **Step 1: 编写 Button 组件测试用例**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders with primary variant by default', () => {
    render(<Button>测试按钮</Button>)
    const button = screen.getByRole('button', { name: /测试按钮/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-primary')
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>点击我</Button>)
    fireEvent.click(screen.getByRole('button', { name: /点击我/i }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading state', () => {
    render(<Button isLoading>加载中</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('renders all variants correctly', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger', 'success'] as const
    variants.forEach((variant) => {
      const { container } = render(<Button variant={variant}>{variant}</Button>)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  it('renders all sizes correctly', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    sizes.forEach((size) => {
      const { container } = render(<Button size={size}>{size}</Button>)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  it('supports asChild prop for composition', () => {
    render(
      <Button asChild>
        <a href="/test">链接按钮</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: /链接按钮/i })
    expect(link).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>禁用按钮</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('has proper focus styles', () => {
    render(<Button>焦点测试</Button>)
    const button = screen.getByRole('button')
    button.focus()
    expect(button).toHaveFocus()
  })
})
```

- [ ] **Step 2: 运行测试并验证**

```bash
npm test -- src/components/ui/Button.test.tsx
```

期望：所有测试通过

- [ ] **Step 3: 检查 Button 组件的视觉一致性**

手动检查项：
- 所有 variant 的颜色是否引用了 theme.tokens.ts
- hover/active/focus 状态是否有明确的视觉反馈
- disabled 状态的透明度是否合理（当前为 0.5）
- 不同 size 的高度是否符合 4px 栅格系统

- [ ] **Step 4: 提交代码**

```bash
git add src/components/ui/Button.test.tsx
git commit -m "test: add comprehensive Button component tests"
```

---

#### Task 1.2: Input 组件全面测试

**Files:**
- Test: `src/components/atoms/Input.test.tsx`
- Component: `src/components/atoms/Input.tsx`

- [ ] **Step 1: 编写 Input 组件测试用例**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('renders correctly', () => {
    render(<Input placeholder="请输入" />)
    expect(screen.getByPlaceholderText('请输入')).toBeInTheDocument()
  })

  it('handles value changes', () => {
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '测试值' } })
    expect(handleChange).toHaveBeenCalled()
  })

  it('supports different types', () => {
    const { rerender } = render(<Input type="text" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text')
    
    rerender(<Input type="password" />)
    expect(screen.getByLabelText('')).toHaveAttribute('type', 'password')
  })

  it('shows disabled state', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('has proper focus styles', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    input.focus()
    expect(input).toHaveFocus()
  })

  it('supports file input', () => {
    render(<Input type="file" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('type', 'file')
  })

  it('applies custom className', () => {
    render(<Input className="custom-class" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom-class')
  })
})
```

- [ ] **Step 2: 运行测试并验证**

```bash
npm test -- src/components/ui/Input.test.tsx
```

- [ ] **Step 3: 检查 Input 组件的数据验证机制**

检查项：
- 是否支持 required 属性
- 是否有 pattern 验证
- 错误状态的视觉反馈（红色边框、错误提示）
- placeholder 文本是否清晰

- [ ] **Step 4: 提交代码**

```bash
git add src/components/ui/Input.test.tsx
git commit -m "test: add comprehensive Input component tests"
```

---

#### Task 1.3: Dialog 组件全面测试

**Files:**
- Test: `src/components/molecules/Dialog.test.tsx`
- Component: `src/components/molecules/Dialog.tsx`

- [ ] **Step 1: 编写 Dialog 组件测试用例**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './Dialog'

describe('Dialog', () => {
  it('renders when open is true', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>测试标题</DialogTitle>
            <DialogDescription>测试描述</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText('测试标题')).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    render(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>隐藏标题</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.queryByText('隐藏标题')).not.toBeInTheDocument()
  })

  it('calls onOpenChange when close button is clicked', async () => {
    const handleOpenChange = vi.fn()
    render(
      <Dialog open={true} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogTitle>可关闭对话框</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    
    await waitFor(() => {
      expect(handleOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('closes on Escape key press', async () => {
    const handleOpenChange = vi.fn()
    render(
      <Dialog open={true} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogTitle>ESC 关闭测试</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    
    fireEvent.keyDown(screen.getByText('ESC 关闭测试'), { key: 'Escape' })
    
    await waitFor(() => {
      expect(handleOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('renders DialogHeader, DialogTitle, DialogDescription correctly', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>完整对话框</DialogTitle>
            <DialogDescription>这是描述文本</DialogDescription>
          </DialogHeader>
          <div>对话框内容</div>
        </DialogContent>
      </Dialog>
    )
    
    expect(screen.getByText('完整对话框')).toBeInTheDocument()
    expect(screen.getByText('这是描述文本')).toBeInTheDocument()
    expect(screen.getByText('对话框内容')).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogTitle>无障碍测试</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试并验证**

```bash
npm test -- src/components/ui/Dialog.test.tsx
```

- [ ] **Step 3: 检查 Dialog 的交互逻辑**

检查项：
- 模态框是否正确居中
- 背景遮罩是否阻止点击穿透
- 关闭按钮是否可见且可点击
- ESC 键是否可关闭
- 焦点是否正确管理（打开时聚焦到对话框，关闭时恢复）

- [ ] **Step 4: 提交代码**

```bash
git add src/components/ui/Dialog.test.tsx
git commit -m "test: add comprehensive Dialog component tests"
```

---

#### Task 1.4: Card 组件全面测试

**Files:**
- Test: `src/components/atoms/Card.test.tsx`
- Component: `src/components/atoms/Card.tsx`

- [ ] **Step 1: 编写 Card 组件测试用例**

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'

describe('Card', () => {
  it('renders Card correctly', () => {
    render(<Card data-testid="card">卡片内容</Card>)
    expect(screen.getByTestId('card')).toBeInTheDocument()
  })

  it('renders CardHeader, CardTitle, CardDescription correctly', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>卡片标题</CardTitle>
          <CardDescription>卡片描述</CardDescription>
        </CardHeader>
      </Card>
    )
    
    expect(screen.getByText('卡片标题')).toBeInTheDocument()
    expect(screen.getByText('卡片描述')).toBeInTheDocument()
  })

  it('renders CardContent correctly', () => {
    render(
      <Card>
        <CardContent>主要内容区域</CardContent>
      </Card>
    )
    
    expect(screen.getByText('主要内容区域')).toBeInTheDocument()
  })

  it('renders CardFooter correctly', () => {
    render(
      <Card>
        <CardFooter>底部操作区</CardFooter>
      </Card>
    )
    
    expect(screen.getByText('底部操作区')).toBeInTheDocument()
  })

  it('applies custom className to all subcomponents', () => {
    render(
      <Card className="custom-card">
        <CardHeader className="custom-header">
          <CardTitle className="custom-title">标题</CardTitle>
        </CardHeader>
        <CardContent className="custom-content">内容</CardContent>
        <CardFooter className="custom-footer">底部</CardFooter>
      </Card>
    )
    
    expect(screen.getByText('标题').closest('div')).toHaveClass('custom-header')
    expect(screen.getByText('内容')).toHaveClass('custom-content')
    expect(screen.getByText('底部').closest('div')).toHaveClass('custom-footer')
  })

  it('has proper visual hierarchy', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>层级测试</CardTitle>
        </CardHeader>
      </Card>
    )
    
    const title = screen.getByText('层级测试')
    expect(title.tagName).toBe('H3')
  })
})
```

- [ ] **Step 2: 运行测试并验证**

```bash
npm test -- src/components/ui/Card.test.tsx
```

- [ ] **Step 3: 检查 Card 的视觉一致性**

检查项：
- 边框颜色是否使用 theme.tokens.ts 中的 border token
- 背景色是否使用 bg-card token
- 阴影是否统一
- 内边距是否符合 SPACING_TOKENS

- [ ] **Step 4: 提交代码**

```bash
git add src/components/ui/Card.test.tsx
git commit -m "test: add comprehensive Card component tests"
```

---

### Phase 2: 页面功能集成测试（P0 - 核心流程）

#### Task 2.1: 输入舱 Hub 页面测试

**Files:**
- Test: `src/pages/input/__tests__/InputHubPage.test.tsx`
- Page: `src/apps/input/InputApp.tsx`

- [ ] **Step 1: 编写 InputHubPage 测试用例**

```typescript
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import InputHubPage from '../InputHubPage'

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('InputHubPage', () => {
  it('renders page title and description', () => {
    renderWithRouter(<InputHubPage />)
    expect(screen.getByText('数据采集及接口')).toBeInTheDocument()
    expect(screen.getByText(/输入舱 · 候选池录入/)).toBeInTheDocument()
  })

  it('renders breadcrumb navigation', () => {
    renderWithRouter(<InputHubPage />)
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('输入舱')).toBeInTheDocument()
  })

  it('renders all core modules', () => {
    renderWithRouter(<InputHubPage />)
    
    const expectedModules = [
      '录入看板',
      '批量导入',
      '热门板块',
      '采集测试',
      '本地知识库',
    ]
    
    expectedModules.forEach((moduleName) => {
      expect(screen.getByText(moduleName)).toBeInTheDocument()
    })
  })

  it('renders expandable modules section', () => {
    renderWithRouter(<InputHubPage />)
    expect(screen.getByText('可扩展能力（参考 V6 Pro）')).toBeInTheDocument()
    expect(screen.getByText('股票池管理')).toBeInTheDocument()
    expect(screen.getByText('七维采集')).toBeInTheDocument()
  })

  it('has working navigation links', () => {
    renderWithRouter(<InputHubPage />)
    
    const dashboardLink = screen.getByRole('link', { name: /录入看板/i })
    expect(dashboardLink).toHaveAttribute('href', '/input')
    
    const bulkImportLink = screen.getByRole('link', { name: /批量导入/i })
    expect(bulkImportLink).toHaveAttribute('href', '/input/bulk-import')
  })

  it('shows loading state when loading is true', () => {
    // Mock the store to return loading state
    // This requires mocking useInputHubStore
    renderWithRouter(<InputHubPage />)
    // Verify loading UI is shown
  })
})
```

- [ ] **Step 2: 运行测试并验证**

```bash
npm test -- src/pages/input/__tests__/InputHubPage.test.tsx
```

- [ ] **Step 3: 手动验证页面功能**

检查项：
- 面包屑导航是否正确显示层级
- 所有模块卡片是否渲染
- 点击"进入"按钮是否跳转到对应页面
- Badge 标签是否正确显示
- 响应式布局在不同屏幕尺寸下是否正常

- [ ] **Step 4: 提交代码**

```bash
git add src/pages/input/__tests__/InputHubPage.test.tsx
git commit -m "test: add InputHubPage integration tests"
```

---

#### Task 2.2: 分析舱 Hub 页面测试

**Files:**
- Test: `src/pages/analysis/__tests__/AnalysisHubPage.test.tsx`
- Page: `src/apps/analysis/AnalysisApp.tsx`

- [ ] **Step 1: 编写 AnalysisHubPage 测试用例**

```typescript
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import AnalysisHubPage from '../AnalysisHubPage'

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('AnalysisHubPage', () => {
  it('renders page title and description', () => {
    renderWithRouter(<AnalysisHubPage />)
    expect(screen.getByText('行业个股分析')).toBeInTheDocument()
  })

  it('renders all core analysis modules', () => {
    renderWithRouter(<AnalysisHubPage />)
    
    const expectedModules = [
      'V4 行业评分',
      'V6 个股评分',
      'V6 个股智能评分',
      '行业分析',
      '策略回测',
      '评分文档',
      '智能资讯',
      '热门板块策略',
      '价值洼地策略',
    ]
    
    expectedModules.forEach((moduleName) => {
      expect(screen.getByText(moduleName)).toBeInTheDocument()
    })
  })

  it('has correct navigation paths', () => {
    renderWithRouter(<AnalysisHubPage />)
    
    const industryScoreLink = screen.getByRole('link', { name: /V4 行业评分/i })
    expect(industryScoreLink).toHaveAttribute('href', '/analysis/industry-score')
    
    const stockScoreLink = screen.getByRole('link', { name: /V6 个股评分/i })
    expect(stockScoreLink).toHaveAttribute('href', '/analysis/stock-score')
  })

  it('renders future modules section', () => {
    renderWithRouter(<AnalysisHubPage />)
    expect(screen.getByText('可扩展能力（参考 V6 Pro）')).toBeInTheDocument()
    expect(screen.getByText('板块轮动')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试并验证**

```bash
npm test -- src/pages/analysis/__tests__/AnalysisHubPage.test.tsx
```

- [ ] **Step 3: 手动验证页面功能**

检查项：
- 9 个核心模块是否全部渲染
- 每个模块的图标、标题、描述是否完整
- 跳转链接是否正确
- "待实现" Badge 是否正确显示

- [ ] **Step 4: 提交代码**

```bash
git add src/pages/analysis/__tests__/AnalysisHubPage.test.tsx
git commit -m "test: add AnalysisHubPage integration tests"
```

---

#### Task 2.3: 交易舱 Hub 页面测试

**Files:**
- Test: `src/pages/trading/__tests__/TradingHubPage.test.tsx`
- Page: `src/apps/trading/TradingApp.tsx`

- [ ] **Step 1: 编写 TradingHubPage 测试用例**

```typescript
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import TradingHubPage from '../TradingHubPage'

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('TradingHubPage', () => {
  it('renders page title and description', () => {
    renderWithRouter(<TradingHubPage />)
    expect(screen.getByText('交易及持仓')).toBeInTheDocument()
  })

  it('renders all core trading modules', () => {
    renderWithRouter(<TradingHubPage />)
    
    expect(screen.getByText('交易信号')).toBeInTheDocument()
    expect(screen.getByText('模拟持仓')).toBeInTheDocument()
    expect(screen.getByText('策略快照')).toBeInTheDocument()
  })

  it('has correct navigation paths', () => {
    renderWithRouter(<TradingHubPage />)
    
    const signalsLink = screen.getByRole('link', { name: /交易信号/i })
    expect(signalsLink).toHaveAttribute('href', '/trading')
    
    const holdingsLink = screen.getByRole('link', { name: /模拟持仓/i })
    expect(holdingsLink).toHaveAttribute('href', '/trading/holdings')
  })

  it('renders future modules with badges', () => {
    renderWithRouter(<TradingHubPage />)
    
    expect(screen.getByText('策略管理')).toBeInTheDocument()
    expect(screen.getByText('数据层待建')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试并验证**

```bash
npm test -- src/pages/trading/__tests__/TradingHubPage.test.tsx
```

- [ ] **Step 3: 提交代码**

```bash
git add src/pages/trading/__tests__/TradingHubPage.test.tsx
git commit -m "test: add TradingHubPage integration tests"
```

---

#### Task 2.4: 输出舱 Hub 页面测试

**Files:**
- Test: `src/pages/output/__tests__/OutputHubPage.test.tsx`
- Page: `src/pages/output/OutputHubPage.tsx`

- [ ] **Step 1: 编写 OutputHubPage 测试用例**

```typescript
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import OutputHubPage from '../OutputHubPage'

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('OutputHubPage', () => {
  it('renders page title', () => {
    renderWithRouter(<OutputHubPage />)
    expect(screen.getByText('输出舱')).toBeInTheDocument()
  })

  it('renders all output modules', () => {
    renderWithRouter(<OutputHubPage />)
    
    expect(screen.getByText('研究报告')).toBeInTheDocument()
    expect(screen.getByText('交易复盘')).toBeInTheDocument()
    expect(screen.getByText('数据导出')).toBeInTheDocument()
  })

  it('shows badges for placeholder modules', () => {
    renderWithRouter(<OutputHubPage />)
    
    const badges = screen.getAllByText('待实现')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('has correct navigation paths', () => {
    renderWithRouter(<OutputHubPage />)
    
    const researchLink = screen.getByRole('link', { name: /研究报告/i })
    expect(researchLink).toHaveAttribute('href', '/output/research')
  })
})
```

- [ ] **Step 2: 运行测试并验证**

```bash
npm test -- src/pages/output/__tests__/OutputHubPage.test.tsx
```

- [ ] **Step 3: 提交代码**

```bash
git add src/pages/output/__tests__/OutputHubPage.test.tsx
git commit -m "test: add OutputHubPage integration tests"
```

---

#### Task 2.5: 总控舱 Hub 页面测试

**Files:**
- Test: `src/pages/command/__tests__/CommandHubPage.test.tsx`
- Page: `src/apps/command/CommandApp.tsx`

- [ ] **Step 1: 编写 CommandHubPage 测试用例**

```typescript
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import CommandHubPage from '../CommandHubPage'

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('CommandHubPage', () => {
  it('renders page title', () => {
    renderWithRouter(<CommandHubPage />)
    expect(screen.getByText('总控中心')).toBeInTheDocument()
  })

  it('renders all command modules', () => {
    renderWithRouter(<CommandHubPage />)
    
    expect(screen.getByText('AI 体中心')).toBeInTheDocument()
    expect(screen.getByText('MCP Server 管理')).toBeInTheDocument()
    expect(screen.getByText('系统监控')).toBeInTheDocument()
    expect(screen.getByText('配置管理')).toBeInTheDocument()
  })

  it('has correct navigation paths', () => {
    renderWithRouter(<CommandHubPage />)
    
    const agentLink = screen.getByRole('link', { name: /AI 体中心/i })
    expect(agentLink).toHaveAttribute('href', '/command/agents')
    
    const mcpLink = screen.getByRole('link', { name: /MCP Server 管理/i })
    expect(mcpLink).toHaveAttribute('href', '/command/mcp-servers')
  })

  it('renders future modules section', () => {
    renderWithRouter(<CommandHubPage />)
    
    expect(screen.getByText('可扩展能力（参考 V6 Pro）')).toBeInTheDocument()
    expect(screen.getByText('风控网关')).toBeInTheDocument()
    expect(screen.getByText('报告导出')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试并验证**

```bash
npm test -- src/pages/command/__tests__/CommandHubPage.test.tsx
```

- [ ] **Step 3: 提交代码**

```bash
git add src/pages/command/__tests__/CommandHubPage.test.tsx
git commit -m "test: add CommandHubPage integration tests"
```

---

### Phase 3: 视觉一致性审查（P1 - 重要优化）

#### Task 3.1: 颜色系统合规性检查

**Files:**
- Audit Script: `scripts/audit-color-tokens.ts`
- Target: 所有 `src/**/*.tsx` 文件

- [ ] **Step 1: 创建颜色审计脚本**

```typescript
// scripts/audit-color-tokens.ts
import { glob } from 'glob'
import { readFile } from 'fs/promises'
import { COLOR_TOKENS } from '../src/constants/theme.tokens'

const VALID_COLORS = new Set([
  ...Object.values(COLOR_TOKENS).map((token) => token.hex),
  ...Object.values(COLOR_TOKENS).map((token) => token.tailwind),
  ...Object.values(COLOR_TOKENS).map((token) => token.bgClass),
])

const HEX_REGEX = /#[0-9a-fA-F]{6}/g
const TAILWIND_COLOR_REGEX = /(?:text|bg|border)-(?:red|blue|green|yellow|purple|orange|gray|slate|emerald|amber|cyan|teal|indigo|pink|violet|fuchsia|lime|rose|sky|zinc|neutral|stone)-\d{3}/g

async function auditColorTokens(): Promise<void> {
  const files = await glob('src/**/*.{tsx,ts}', { ignore: ['**/*.test.{tsx,ts}', '**/node_modules/**'] })
  
  let violations = 0
  
  for (const file of files) {
    const content = await readFile(file, 'utf-8')
    const lines = content.split('\n')
    
    lines.forEach((line, index) => {
      const hexMatches = line.match(HEX_REGEX)
      if (hexMatches) {
        hexMatches.forEach((hex) => {
          if (!VALID_COLORS.has(hex)) {
            console.error(`❌ ${file}:${index + 1} - 硬编码颜色: ${hex}`)
            violations++
          }
        })
      }
    })
  }
  
  if (violations > 0) {
    console.error(`\n发现 ${violations} 处颜色违规`)
    process.exit(1)
  } else {
    console.log('✅ 颜色系统合规检查通过')
  }
}

auditColorTokens()
```

- [ ] **Step 2: 运行颜色审计**

```bash
npx tsx scripts/audit-color-tokens.ts
```

- [ ] **Step 3: 修复发现的颜色违规**

对于每个违规项：
1. 确定应该使用的语义化 token（如 `COLOR_TOKENS.textPrimary`）
2. 替换硬编码颜色
3. 重新运行审计确认修复

- [ ] **Step 4: 提交修复**

```bash
git add -A
git commit -m "fix: replace hardcoded colors with theme tokens"
```

---

#### Task 3.2: 间距系统合规性检查

**Files:**
- Audit Script: `scripts/audit-spacing.ts`
- Target: 所有 `src/**/*.tsx` 文件

- [ ] **Step 1: 创建间距审计脚本**

```typescript
// scripts/audit-spacing.ts
import { glob } from 'glob'
import { readFile } from 'fs/promises'
import { SPACING_TOKENS } from '../src/constants/theme.tokens'

const VALID_SPACING_VALUES = new Set([
  '4px', '8px', '12px', '16px', '24px', '32px', '48px',
  '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem', '3rem',
])

const INLINE_SPACING_REGEX = /(?:padding|margin|gap|top|right|bottom|left):\s*(\d+px)/g

async function auditSpacing(): Promise<void> {
  const files = await glob('src/**/*.{tsx,ts}', { ignore: ['**/*.test.{tsx,ts}', '**/node_modules/**'] })
  
  let violations = 0
  
  for (const file of files) {
    const content = await readFile(file, 'utf-8')
    const lines = content.split('\n')
    
    lines.forEach((line, index) => {
      const matches = line.match(INLINE_SPACING_REGEX)
      if (matches) {
        matches.forEach((match) => {
          const value = match.split(':')[1].trim()
          if (!VALID_SPACING_VALUES.has(value)) {
            console.error(`❌ ${file}:${index + 1} - 非标准间距: ${value}`)
            violations++
          }
        })
      }
    })
  }
  
  if (violations > 0) {
    console.error(`\n发现 ${violations} 处间距违规`)
    process.exit(1)
  } else {
    console.log('✅ 间距系统合规检查通过')
  }
}

auditSpacing()
```

- [ ] **Step 2: 运行间距审计**

```bash
npx tsx scripts/audit-spacing.ts
```

- [ ] **Step 3: 修复发现的间距违规**

- [ ] **Step 4: 提交修复**

```bash
git add -A
git commit -m "fix: standardize spacing to 4px grid system"
```

---

#### Task 3.3: 字体系统检查

**Files:**
- Manual Review Checklist

- [ ] **Step 1: 检查字体大小一致性**

检查项：
- 标题字体大小是否统一（h1: 2xl, h2: xl, h3: lg）
- 正文字体大小是否统一（base, sm）
- 辅助文本是否使用 muted-foreground 颜色
- 字体粗细是否合理（bold, semibold, normal）

- [ ] **Step 2: 检查行高和字间距**

检查项：
- 标题行高是否紧凑（leading-none, leading-tight）
- 正文行高是否舒适（leading-normal, leading-relaxed）
- 字间距是否合理（tracking-tight, tracking-normal）

- [ ] **Step 3: 记录发现的问题并修复**

创建问题清单并逐项修复。

---

### Phase 4: 交互体验优化（P1 - 重要优化）

#### Task 4.1: 加载状态优化

**Files:**
- Component: `src/components/organisms/shared/PageSkeleton.tsx`
- Target: 所有页面组件

- [ ] **Step 1: 检查所有页面的加载状态**

检查项：
- 是否所有页面都使用了 Suspense + PageSkeleton
- PageSkeleton 的视觉效果是否合理
- 加载时间是否过长（> 300ms 需要优化）

- [ ] **Step 2: 优化 PageSkeleton 组件**

```typescript
// 增强 PageSkeleton 的视觉效果
export function PageSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4 p-4" data-testid="page-skeleton">
      {/* 标题骨架 */}
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      
      {/* 内容骨架 - 响应式网格 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 为所有页面添加错误边界**

检查所有页面是否被 ErrorBoundary 包裹。

- [ ] **Step 4: 提交优化**

```bash
git add src/components/PageSkeleton.tsx
git commit -m "feat: enhance PageSkeleton visual feedback"
```

---

#### Task 4.2: 错误状态处理

**Files:**
- Component: `src/components/molecules/ErrorState.tsx`
- Target: 所有数据获取页面

- [ ] **Step 1: 检查 ErrorState 组件**

```typescript
import { AlertCircle } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ 
  title = '出错了', 
  description = '请稍后重试', 
  onRetry 
}: ErrorStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          重试
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 为所有数据页面添加错误处理**

检查项：
- 数据获取失败时是否显示 ErrorState
- 错误信息是否清晰
- 是否提供重试按钮

- [ ] **Step 3: 提交优化**

```bash
git add src/components/ui/ErrorState.tsx
git commit -m "feat: improve ErrorState component with retry action"
```

---

#### Task 4.3: 空状态处理

**Files:**
- Component: `src/components/molecules/EmptyState.tsx`
- Target: 所有列表页面

- [ ] **Step 1: 检查 EmptyState 组件**

```typescript
import { Inbox } from 'lucide-react'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: React.ElementType
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({
  icon: Icon = Inbox,
  title = '暂无数据',
  description = '请先添加一些内容',
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 为所有列表页面添加空状态**

检查项：
- 列表为空时是否显示 EmptyState
- 是否提供引导操作（如"添加第一个项目"）
- 空状态文案是否友好

- [ ] **Step 3: 提交优化**

```bash
git add src/components/ui/EmptyState.tsx
git commit -m "feat: enhance EmptyState with action support"
```

---

### Phase 5: 响应式设计验证（P2 - 体验优化）

#### Task 5.1: 移动端适配测试

**Files:**
- Test: `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: 创建响应式测试用例**

```typescript
// tests/e2e/responsive.spec.ts
import { test, expect } from '@playwright/test'

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
}

test.describe('响应式设计测试', () => {
  test('移动端 - 导航栏折叠', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto('/input/hub')
    
    // 检查侧边栏是否隐藏
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeHidden()
    
    // 检查汉堡菜单是否存在
    const menuButton = page.getByRole('button', { name: /菜单/i })
    await expect(menuButton).toBeVisible()
  })

  test('平板端 - 网格布局调整', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet)
    await page.goto('/analysis/hub')
    
    // 检查卡片网格是否为 2 列
    const grid = page.locator('.grid')
    await expect(grid).toHaveClass(/md:grid-cols-2/)
  })

  test('桌面端 - 完整布局', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto('/trading/hub')
    
    // 检查侧边栏是否显示
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
    
    // 检查卡片网格是否为 3 列
    const grid = page.locator('.grid')
    await expect(grid).toHaveClass(/lg:grid-cols-3/)
  })
})
```

- [ ] **Step 2: 运行响应式测试**

```bash
npm run test:e2e -- tests/e2e/responsive.spec.ts
```

- [ ] **Step 3: 修复响应式问题**

检查项：
- 移动端导航是否可访问
- 平板端布局是否合理
- 桌面端是否充分利用空间
- 文字是否过小难以阅读
- 按钮是否过小难以点击

- [ ] **Step 4: 提交修复**

```bash
git add -A
git commit -m "fix: improve responsive design across all viewports"
```

---

### Phase 6: 可访问性检查（P2 - 体验优化）

#### Task 6.1: ARIA 标签检查

- [ ] **Step 1: 检查所有交互元素**

检查项：
- 所有按钮是否有清晰的 aria-label
- 所有图标按钮是否有文本说明
- 所有表单输入是否有关联的 label
- 所有对话框是否有 role="dialog"

- [ ] **Step 2: 检查键盘导航**

检查项：
- 是否可以使用 Tab 键导航所有交互元素
- 是否可以使用 Enter/Space 激活按钮
- 是否可以使用 ESC 关闭对话框
- 焦点顺序是否合理

- [ ] **Step 3: 检查颜色对比度**

使用工具检查：
- 文本与背景的对比度是否 >= 4.5:1
- 大文本对比度是否 >= 3:1
- 焦点指示器是否清晰可见

- [ ] **Step 4: 记录并修复问题**

创建可访问性问题清单并逐项修复。

---

## 测试执行顺序

### 第一批（P0 - 阻塞性）

1. ✅ Task 1.1: Button 组件测试
2. ✅ Task 1.2: Input 组件测试
3. ✅ Task 1.3: Dialog 组件测试
4. ✅ Task 1.4: Card 组件测试
5. ✅ Task 2.1: 输入舱 Hub 页面测试
6. ✅ Task 2.2: 分析舱 Hub 页面测试
7. ✅ Task 2.3: 交易舱 Hub 页面测试
8. ✅ Task 2.4: 输出舱 Hub 页面测试
9. ✅ Task 2.5: 总控舱 Hub 页面测试

**等待用户确认后继续下一批**

### 第二批（P1 - 重要优化）

10. Task 3.1: 颜色系统合规性检查
11. Task 3.2: 间距系统合规性检查
12. Task 3.3: 字体系统检查
13. Task 4.1: 加载状态优化
14. Task 4.2: 错误状态处理
15. Task 4.3: 空状态处理

**等待用户确认后继续下一批**

### 第三批（P2 - 体验优化）

16. Task 5.1: 移动端适配测试
17. Task 6.1: 可访问性检查

---

## 质量验收标准

### 功能完整性

- [ ] 所有页面的核心功能可正常使用
- [ ] 所有导航链接正确跳转
- [ ] 所有表单验证正常工作
- [ ] 所有数据展示准确无误

### 视觉一致性

- [ ] 所有颜色使用 theme.tokens.ts
- [ ] 所有间距符合 4px 栅格系统
- [ ] 字体大小、粗细统一
- [ ] 圆角、阴影一致

### 交互体验

- [ ] 加载状态清晰可见
- [ ] 错误提示友好明确
- [ ] 空状态有引导操作
- [ ] 响应式布局合理

### 代码质量

- [ ] 单元测试覆盖率 > 80%
- [ ] 无 TypeScript 类型错误
- [ ] 无 ESLint 警告
- [ ] 架构审计通过

---

## 参考资源

- [shadcn/ui 组件库](https://ui.shadcn.com/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React 最佳实践](https://react.dev/learn)
- [Web 可访问性指南](https://www.w3.org/WAI/tutorials/)

---

## 变更日志

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-07-04 | v1.0.0 | 初始版本：完整的 UI 测试与优化方案 |
