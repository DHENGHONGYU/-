/**
 * SystemArchitectureDiagram 组件单元测试
 *
 * 覆盖场景（对应独立复检报告 cockpit-架构图独立复检报告.md 的验收项）：
 * 1. 数据加载失败/无数据时显示「暂无架构数据」兜底
 * 2. 渲染全部 8 个分层卡片与分层数徽标
 * 3. 渲染层间连接箭头（↓）与连接标签
 * 4. 渲染 V6 评分引擎层与权重百分比
 * 5. 渲染已注册 Agent 网格与计数
 * 6. 点击分层卡片展开/折叠模块列表
 * 7. 键盘 Enter/Space 可展开分层卡片（键盘可达性）
 * 8. 分层卡片具备 role=button / tabIndex=0（无障碍）
 *
 * 数据真实性：getArchitectureService().getArchitectureSnapshot() 经 vi.mock 注入受控快照，
 * 避免依赖真实 AgentRegistry / EventBus 等运行时副作用（与组件 mount 时直读的设计一致）。
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// 组件内部使用 logger，需 mock 避免副作用
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

// 受控快照存储（hoisted 以便在 vi.mock 工厂中引用）
const { mockGetArchitectureService, setSnapshot, setThrow } = vi.hoisted(() => {
  const store = { snapshot: null as any, throwError: false }
  return {
    setSnapshot: (s: any) => {
      store.snapshot = s
      store.throwError = false
    },
    setThrow: () => {
      store.throwError = true
    },
    mockGetArchitectureService: () => ({
      getArchitectureSnapshot: () => {
        if (store.throwError) {
          throw new Error('snapshot failure')
        }
        return store.snapshot
      },
    }),
  }
})

// 整体 mock ArchitectureService，阻断其对 AgentRegistry / EventBus 的真实依赖
vi.mock('@/services/system/architectureService', () => ({
  getArchitectureService: mockGetArchitectureService,
}))

// 动态导入以应用 mock
const { default: SystemArchitectureDiagram } = await import(
  '@/components/organisms/system/SystemArchitectureDiagram'
)

/** 构造受控架构快照（8 分层 / 8 连接 / 3 引擎层 / 2 Agent） */
function makeSnapshot(): any {
  return {
    layers: [
      {
        id: 'config',
        name: '配置层',
        description: '零硬编码锚点，全局配置注入',
        modules: ['dbConfig', 'inputConfig', 'routes', 'thresholds', 'dualStrategyRules'],
        color: '#6366f1',
        status: 'healthy',
        moduleCount: 5,
      },
      {
        id: 'core',
        name: '核心层',
        description: '核心工具与类型守卫',
        modules: ['DataBridge', 'ACL'],
        color: '#8b5cf6',
        status: 'healthy',
        moduleCount: 2,
      },
      {
        id: 'data',
        name: '数据层',
        description: 'IndexedDB 数据访问层',
        modules: ['dataLayer'],
        color: '#06b6d4',
        status: 'healthy',
        moduleCount: 1,
      },
      {
        id: 'services',
        name: '服务层',
        description: '子域业务服务',
        modules: ['analysis'],
        color: '#10b981',
        status: 'healthy',
        moduleCount: 1,
      },
      {
        id: 'agents',
        name: '智能体层',
        description: 'AI Agent 注册与调度',
        modules: ['agentRegistry'],
        color: '#f59e0b',
        status: 'healthy',
        moduleCount: 1,
      },
      {
        id: 'store',
        name: '状态层',
        description: 'Zustand Store',
        modules: ['engineStore'],
        color: '#ef4444',
        status: 'healthy',
        moduleCount: 1,
      },
      {
        id: 'pages',
        name: '页面层',
        description: '5舱页面入口',
        modules: ['input'],
        color: '#ec4899',
        status: 'healthy',
        moduleCount: 1,
      },
      {
        id: 'components',
        name: '组件层',
        description: 'UI组件库',
        modules: ['ui'],
        color: '#f97316',
        status: 'healthy',
        moduleCount: 1,
      },
    ],
    connections: [
      { from: 'config', to: 'core', label: '注入配置' },
      { from: 'core', to: 'data', label: '数据桥接路由' },
      { from: 'data', to: 'services', label: '数据读写' },
      { from: 'services', to: 'agents', label: '任务派发' },
      { from: 'agents', to: 'store', label: '状态广播' },
      { from: 'store', to: 'pages', label: '状态订阅' },
      { from: 'pages', to: 'components', label: '组件渲染' },
      { from: 'services', to: 'data', label: '数据回写（反馈）' },
    ],
    engineLayers: [
      { id: 'L0', name: 'L0: 数据采集', deterministic: true, llmEnhanceable: false, weight: 0.05, status: 'active' },
      { id: 'L3', name: 'L3: 财务分析', deterministic: true, llmEnhanceable: false, weight: 0.2, status: 'active' },
      { id: 'L8', name: 'L8: 综合评分', deterministic: true, llmEnhanceable: false, weight: 0.05, status: 'active' },
    ],
    agentNodes: [
      { id: 'agent-1', name: '分析智能体', status: 'active', type: 'system' },
      { id: 'agent-2', name: '研究智能体', status: 'idle', type: 'default' },
    ],
    timestamp: 1700000000000,
  }
}

/** 取得某个分层卡片的可交互容器（role=button 的 div） */
function getLayerCard(layerName: string): HTMLElement {
  const nameEl = screen.getByText(layerName)
  const card = nameEl.closest('div[role="button"]')
  if (!card) {
    throw new Error(`未找到分层卡片: ${layerName}`)
  }
  return card as HTMLElement
}

describe('SystemArchitectureDiagram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSnapshot(makeSnapshot())
  })

  it('数据加载失败/无数据时显示「暂无架构数据」兜底', () => {
    setThrow()
    render(<SystemArchitectureDiagram />)
    expect(screen.getByText('暂无架构数据')).toBeInTheDocument()
  })

  it('渲染全部 8 个分层卡片与分层数徽标', () => {
    render(<SystemArchitectureDiagram />)
    expect(screen.getByText('8 个分层')).toBeInTheDocument()
    for (const name of [
      '配置层',
      '核心层',
      '数据层',
      '服务层',
      '智能体层',
      '状态层',
      '页面层',
      '组件层',
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })

  it('渲染层间连接箭头（↓）与连接标签', () => {
    render(<SystemArchitectureDiagram />)
    expect(screen.getAllByText('↓').length).toBeGreaterThan(0)
    // 仅主链（相邻分层）以箭头呈现；反馈边 services→data 在连接数据中但不在卡片间绘制
    for (const label of [
      '注入配置',
      '数据桥接路由',
      '数据读写',
      '任务派发',
      '状态广播',
      '状态订阅',
      '组件渲染',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('渲染反馈连接（反向依赖）小节，可视化 services→data 反向边', () => {
    render(<SystemArchitectureDiagram />)
    // 标题含「反馈连接」四字（O5 闭环关键词）
    expect(screen.getByText('反馈连接（反向依赖）')).toBeInTheDocument()
    // 反向边 services→data 以「服务层 → 数据层：数据回写（反馈）」呈现（↑ 虚线卡片）
    expect(
      screen.getByText('服务层 → 数据层：数据回写（反馈）'),
    ).toBeInTheDocument()
  })

  it('渲染 V6 评分引擎层与权重百分比', () => {
    render(<SystemArchitectureDiagram />)
    expect(screen.getByText('L0: 数据采集')).toBeInTheDocument()
    expect(screen.getByText('L3: 财务分析')).toBeInTheDocument()
    expect(screen.getByText('L8: 综合评分')).toBeInTheDocument()
    // weight * 100 四舍五入：L0/L8=5%，L3=20%
    expect(screen.getAllByText('5%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('渲染已注册 Agent 网格与计数', () => {
    render(<SystemArchitectureDiagram />)
    expect(screen.getByText('已注册智能体（2）')).toBeInTheDocument()
    expect(screen.getByText('分析智能体')).toBeInTheDocument()
    expect(screen.getByText('研究智能体')).toBeInTheDocument()
  })

  it('点击分层卡片展开/折叠模块列表', () => {
    render(<SystemArchitectureDiagram />)
    const card = getLayerCard('配置层')
    // 初始折叠：仅显示前 3 个模块，其余以 +N more 提示
    expect(screen.queryByText('thresholds')).not.toBeInTheDocument()
    expect(screen.getByText('+2 more')).toBeInTheDocument()
    fireEvent.click(card)
    expect(screen.getByText('thresholds')).toBeInTheDocument()
    expect(screen.queryByText('+2 more')).not.toBeInTheDocument()
    fireEvent.click(card)
    expect(screen.queryByText('thresholds')).not.toBeInTheDocument()
  })

  it('键盘 Enter/Space 可展开分层卡片', () => {
    render(<SystemArchitectureDiagram />)
    const card = getLayerCard('配置层')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(screen.getByText('thresholds')).toBeInTheDocument()
    fireEvent.keyDown(card, { key: ' ' })
    expect(screen.queryByText('thresholds')).not.toBeInTheDocument()
  })

  it('分层卡片具备键盘可达性（role=button, tabIndex=0）', () => {
    render(<SystemArchitectureDiagram />)
    const card = getLayerCard('配置层')
    expect(card).toHaveAttribute('role', 'button')
    expect(card).toHaveAttribute('tabindex', '0')
  })
})
