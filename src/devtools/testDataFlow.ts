import { getLogger, setLogLevel, type LogLevel } from '@/lib/logger'
import { dataFlowEngine } from '@/core/dataflow/dataflowEngine'
import { agentRuntime } from '@/agents/agentRuntime'
import { eventBus } from '@/lib/eventBus'

const logger = getLogger()
const isDev = import.meta.env.DEV

function logSection(title: string): void {
  logger.info(`═══════════════════════════════════════`)
  logger.info(`  ${title}`)
  logger.info(`═══════════════════════════════════════`)
}

function logObject(label: string, obj: unknown): void {
  logger.debug(`${label}: ${JSON.stringify(obj, null, 2)}`)
}

function printInstructions(): void {
  logger.info(``)
  logger.info(`【使用说明】`)
  logger.info(`  打开浏览器控制台 (F12) 查看日志输出`)
  logger.info(`  当前日志级别: DEBUG (显示所有日志)`)
  logger.info(`  `)
  logger.info(`【可用命令】`)
  logger.info(`  __DEV__.runAll()          - 运行全部测试`)
  logger.info(`  __DEV__.testEventBus()    - 测试事件总线`)
  logger.info(`  __DEV__.testDataFlow()    - 测试数据流引擎`)
  logger.info(`  __DEV__.testAgent()       - 测试 Agent 运行时`)
  logger.info(`  __DEV__.setLevel('info')  - 切换到 INFO 级别`)
  logger.info(`  __DEV__.setLevel('debug') - 切换到 DEBUG 级别`)
  logger.info(`═══════════════════════════════════════`)
  logger.info(``)
}

export async function testEventBus(): Promise<void> {
  logSection('测试 EventBus 事件总线')

  logger.info('[EventBus] Step 1: 订阅 USER_LOGIN 事件')
  const unsub = eventBus.on('USER_LOGIN', (payload) => {
    logger.info(`[EventBus] 收到 USER_LOGIN 回调: userId=${(payload as { userId: string }).userId}`)
  })

  logger.info('[EventBus] Step 2: 发布 USER_LOGIN 事件')
  eventBus.emit('USER_LOGIN', { userId: 'user_001', timestamp: Date.now() })

  logger.info('[EventBus] Step 3: 订阅 STOCK_UPDATE 事件')
  const unsubStockUpdate = eventBus.on('STOCK_UPDATE', (payload) => {
    const data = payload as { symbol: string; price: number }
    logger.info(`[EventBus] 收到 STOCK_UPDATE: ${data.symbol} = ${data.price}`)
  })

  logger.info('[EventBus] Step 4: 批量发布股票更新')
  const stocks = [
    { symbol: '600000', name: '浦发银行', price: 10.5 },
    { symbol: '600036', name: '招商银行', price: 35.2 },
    { symbol: '000001', name: '平安银行', price: 12.8 },
  ]
  stocks.forEach((s) => {
    eventBus.emit('STOCK_UPDATE', s)
  })

  logger.info('[EventBus] Step 5: 取消订阅并再次发布')
  unsub() // 正确调用返回的 unsubscribe 函数
  eventBus.emit('USER_LOGIN', { userId: 'should_ignore' })

  // 清理 STOCK_UPDATE 订阅，避免内存泄漏
  unsubStockUpdate()

  logger.info('[EventBus] ✅ 测试完成')
}

export async function testDataFlow(): Promise<void> {
  logSection('测试 DataFlowEngine 数据流引擎')

  logger.info('[DataFlow] Step 1: 订阅 stocks 通道')
  let receiveCount = 0
  const unsub = dataFlowEngine.subscribe('stocks', (packet) => {
    receiveCount++
    logger.info(`[DataFlow] 收到数据包 #${receiveCount}: channel=${packet.channel}, seq=${packet.seq}`)
    logObject('[DataFlow] 数据内容', packet.data)
  })

  logger.info('[DataFlow] Step 2: 发布股票数据')
  dataFlowEngine.publish('stocks', {
    data: [
      { symbol: '600000', name: '浦发银行', price: 10.5, change: 0.5 },
      { symbol: '600036', name: '招商银行', price: 35.2, change: -1.2 },
    ],
    source: 'mock-generator',
  })

  logger.info('[DataFlow] Step 3: 发布行业数据')
  dataFlowEngine.publish('industries', {
    data: [
      { code: '801010', name: '种植业', change: 2.5 },
      { code: '801020', name: '渔业', change: -0.8 },
    ],
    source: 'mock-generator',
  })

  logger.info('[DataFlow] Step 4: 再次发布股票数据（验证序列号递增）')
  dataFlowEngine.publish('stocks', {
    data: [{ symbol: '000001', name: '平安银行', price: 12.8, change: 0.3 }],
    source: 'mock-generator',
  })

  await new Promise((r) => setTimeout(r, 100))

  logger.info(`[DataFlow] Step 5: 取消订阅，共接收 ${receiveCount} 条消息`)
  unsub()

  logger.info('[DataFlow] ✅ 测试完成')
}

export async function testAgent(): Promise<void> {
  logSection('测试 AgentRuntime 智能体运行时')

  logger.info('[Agent] Step 1: 注册测试智能体')
  agentRuntime.register({
    id: 'mock-analyst',
    name: '模拟分析师',
    description: '用于测试的模拟智能体',
    defaultTimeout: 5000,
    maxConcurrent: 3,
  })

  logger.info('[Agent] Step 2: 提交分析任务')
  const task = await agentRuntime.execute(
    'mock-analyst',
    'analysis',
    { symbol: '600000', type: 'fundamental' },
    3000,
  )
  logObject('[Agent] 任务结果', task)

  logger.info('[Agent] Step 3: 提交批量任务（模拟并行）')
  const batchResults = await Promise.allSettled([
    agentRuntime.execute('mock-analyst', 'analysis', { symbol: '600000' }, 3000),
    agentRuntime.execute('mock-analyst', 'analysis', { symbol: '600036' }, 3000),
  ])
  logObject('[Agent] 批量结果', batchResults)

  logger.info('[Agent] ✅ 测试完成')
}

export async function testFullFlow(): Promise<void> {
  logSection('测试完整数据流链路')

  logger.info('[FullFlow] Step 1: EventBus 发布市场数据更新事件')
  eventBus.emit('MARKET_DATA_UPDATE', {
    type: 'batch',
    stocks: [
      { symbol: '600000', price: 10.5, volume: 1000000 },
      { symbol: '600036', price: 35.2, volume: 2000000 },
    ],
  })

  logger.info('[FullFlow] Step 2: DataFlowEngine 发布实时行情')
  dataFlowEngine.publish('realtime-quotes', {
    quotes: [
      { symbol: '600000', bid: 10.49, ask: 10.51, last: 10.5 },
      { symbol: '600036', bid: 35.19, ask: 35.21, last: 35.2 },
    ],
    timestamp: Date.now(),
  })

  logger.info('[FullFlow] ✅ 完整链路测试完成')
}

export async function runAll(): Promise<void> {
  if (!isDev) {
    logger.warn('[DevTools] 仅在开发环境可用')
    return
  }

  logger.info('')
  logger.info('╔═══════════════════════════════════════╗')
  logger.info('║    V9 数据流日志测试 - 开始执行        ║')
  logger.info('╚═══════════════════════════════════════╝')

  await testEventBus()
  await new Promise((r) => setTimeout(r, 50))

  await testDataFlow()
  await new Promise((r) => setTimeout(r, 50))

  await testAgent()
  await new Promise((r) => setTimeout(r, 50))

  await testFullFlow()

  logger.info('')
  logger.info('╔═══════════════════════════════════════╗')
  logger.info('║    V9 数据流日志测试 - 全部完成        ║')
  logger.info('╚═══════════════════════════════════════╝')
  logger.info('')
}

export function setLevel(level: LogLevel): void {
  setLogLevel(level)
  logger.info(`[DevTools] 日志级别已切换为: ${level.toUpperCase()}`)
}

if (isDev && typeof window !== 'undefined') {
  const devTools = {
    runAll,
    testEventBus,
    testDataFlow,
    testAgent,
    testFullFlow,
    setLevel,
  }

  ;(window as unknown as { __DEV__: typeof devTools }).__DEV__ = devTools

  setLogLevel('debug')

  setTimeout(() => {
    printInstructions()
    logger.info(`[DevTools] 输入 __DEV__.runAll() 开始测试`)
  }, 500)
}
