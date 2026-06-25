import { getLogger } from '@/lib/logger'
import { setLogLevel } from '@/lib/logger'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION } from '@/config/envelopeConfig'
import { DataBridge } from '@/core/databridge'
import { getDataBridge } from '@/core/databridge'
import { DataFlowEngine } from '@/core/dataflow/dataflowEngine'
import { getDataFlowEngine } from '@/core/dataflow/dataFlowStore'
import { AgentRuntime } from '@/agents/agentRuntime'
import { getAgentRuntime } from '@/agents/agentStore'
import { eventBus } from '@/lib/eventBus'

const logger = getLogger()

const isDev = import.meta.env.DEV

function logSection(title: string): void {
  logger.info(`========== ${title} ==========`)
}

function logObject(label: string, obj: unknown): void {
  logger.debug(`${label}: ${JSON.stringify(obj, null, 2)}`)
}

export async function testDataBridgeFlow(): Promise<void> {
  if (!isDev) {
    logger.warn('[DevTools] testDataBridgeFlow: 仅在开发环境可用')
    return
  }

  logSection('测试 DataBridge 数据流')

  try {
    const bridge = getDataBridge()
    logger.info('[DevTools] 获取 DataBridge 实例成功')

    const testEnvelope = EnvelopeFactory.create(
      {
        action: ENVELOPE_ACTION.queryStocks,
        source: 'devtools',
        target: 'databridge',
        traceId: `test-${Date.now()}`,
      },
      { market: 'SH', limit: 5 },
    )

    logObject('[DevTools] 创建测试信封', testEnvelope)

    logger.info('[DevTools] 触发 forward 操作...')
    await bridge.forward(testEnvelope)

    logger.info('[DevTools] DataBridge 测试完成')
  } catch (error) {
    logger.error('[DevTools] DataBridge 测试失败', { error })
  }
}

export async function testDataFlowEngine(): Promise<void> {
  if (!isDev) {
    logger.warn('[DevTools] testDataFlowEngine: 仅在开发环境可用')
    return
  }

  logSection('测试 DataFlowEngine 数据流')

  try {
    const engine = getDataFlowEngine()
    logger.info('[DevTools] 获取 DataFlowEngine 实例成功')

    const channel = 'stocks' as const
    logger.info(`[DevTools] 订阅通道: ${channel}`)

    const subscriptionId = engine.subscribe(channel, (envelope) => {
      logger.info(`[DevTools] 收到订阅数据: action=${envelope.meta.action}`)
      logObject('[DevTools] 订阅数据内容', envelope.payload)
    })

    logger.info(`[DevTools] 订阅成功，ID: ${subscriptionId}`)

    logger.info('[DevTools] 模拟发布数据...')
    engine.publish(channel, {
      data: [
        { symbol: '600000', name: '浦发银行', price: 10.5 },
        { symbol: '600036', name: '招商银行', price: 35.2 },
      ],
      timestamp: Date.now(),
    })

    logger.info('[DevTools] 等待 500ms 后取消订阅...')
    await new Promise((resolve) => setTimeout(resolve, 500))

    const unsubscribed = engine.unsubscribe(channel, subscriptionId)
    logger.info(`[DevTools] 取消订阅结果: ${unsubscribed}`)

    logger.info('[DevTools] DataFlowEngine 测试完成')
  } catch (error) {
    logger.error('[DevTools] DataFlowEngine 测试失败', { error })
  }
}

export async function testAgentRuntime(): Promise<void> {
  if (!isDev) {
    logger.warn('[DevTools] testAgentRuntime: 仅在开发环境可用')
    return
  }

  logSection('测试 AgentRuntime 数据流')

  try {
    const runtime = getAgentRuntime()
    logger.info('[DevTools] 获取 AgentRuntime 实例成功')

    const agentId = 'test-agent'
    const taskType = 'analysis'
    const payload = {
      symbol: '600000',
      action: 'analyze',
      params: { period: '1d', indicators: ['MA', 'MACD'] },
    }

    logger.info(`[DevTools] 提交测试任务: agentId=${agentId}, type=${taskType}`)
    logObject('[DevTools] 任务参数', payload)

    const task = await runtime.execute(agentId, taskType, payload, 5000)

    logger.info('[DevTools] 任务执行完成')
    logObject('[DevTools] 任务结果', {
      id: task.id,
      status: task.status,
      result: task.result,
    })

    logger.info('[DevTools] AgentRuntime 测试完成')
  } catch (error) {
    logger.error('[DevTools] AgentRuntime 测试失败', { error })
  }
}

export async function testEventBus(): Promise<void> {
  if (!isDev) {
    logger.warn('[DevTools] testEventBus: 仅在开发环境可用')
    return
  }

  logSection('测试 EventBus 事件流')

  try {
    logger.info('[DevTools] 订阅测试事件: TEST_EVENT')

    const callback = (payload: unknown) => {
      logger.info('[DevTools] 收到测试事件回调')
      logObject('[DevTools] 事件载荷', payload)
    }

    eventBus.on('TEST_EVENT', callback)
    logger.info('[DevTools] 订阅成功')

    logger.info('[DevTools] 发布测试事件...')
    eventBus.emit('TEST_EVENT', {
      message: 'Hello from DevTools',
      timestamp: Date.now(),
      data: { value: 42 },
    })

    logger.info('[DevTools] 取消订阅...')
    eventBus.off('TEST_EVENT', callback)

    logger.info('[DevTools] 再次发布事件（应该没有处理）...')
    eventBus.emit('TEST_EVENT', { message: 'This should be ignored' })

    logger.info('[DevTools] EventBus 测试完成')
  } catch (error) {
    logger.error('[DevTools] EventBus 测试失败', { error })
  }
}

export async function testFullDataFlow(): Promise<void> {
  if (!isDev) {
    logger.warn('[DevTools] testFullDataFlow: 仅在开发环境可用')
    return
  }

  logSection('测试完整数据流链路')

  try {
    logger.info('[DevTools] Step 1: 通过 DataBridge 插入测试数据')

    const bridge = getDataBridge()
    const testEnvelope = EnvelopeFactory.create(
      {
        action: ENVELOPE_ACTION.insertStock,
        source: 'devtools',
        target: 'databridge',
        traceId: `fullflow-${Date.now()}`,
      },
      {
        symbol: 'TEST001',
        name: '测试股票',
        market: 'SH',
        industry: '测试行业',
      },
    )

    await bridge.forward(testEnvelope)
    logger.info('[DevTools] Step 2: 发布到 DataFlowEngine')

    const engine = getDataFlowEngine()
    engine.publish('stocks', {
      stocks: [{ symbol: 'TEST001', name: '测试股票' }],
      source: 'devtools',
    })

    logger.info('[DevTools] Step 3: 发布事件通知')
    eventBus.emit('DEVTOOLS_TEST_EVENT', {
      flow: 'full',
      timestamp: Date.now(),
    })

    logger.info('[DevTools] 完整数据流测试完成')
  } catch (error) {
    logger.error('[DevTools] 完整数据流测试失败', { error })
  }
}

export function runAllTests(): void {
  if (!isDev) {
    logger.warn('[DevTools] 仅在开发环境可用')
    return
  }

  logger.info('[DevTools] 启动所有数据流测试...')

  setLogLevel('debug')

  testDataFlowEngine()
    .then(() => testEventBus())
    .then(() => testFullDataFlow())
    .then(() => {
      logger.info('[DevTools] 所有测试已启动，请查看上方日志输出')
    })
    .catch((error) => {
      logger.error('[DevTools] 测试执行失败', { error })
    })
}

if (isDev && typeof window !== 'undefined') {
  (window as unknown as { __DEV_TOOLS__: typeof import('./devtools/testDataFlow') }).__DEV_TOOLS__ = {
    testDataBridgeFlow,
    testDataFlowEngine,
    testAgentRuntime,
    testEventBus,
    testFullDataFlow,
    runAllTests,
  }

  logger.info('[DevTools] 开发工具已注册到 window.__DEV_TOOLS__')
  logger.info('[DevTools] 可在控制台调用: __DEV_TOOLS__.runAllTests()')
}
