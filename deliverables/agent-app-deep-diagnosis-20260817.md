# Agent 应用模块 · 深度诊断报告

> **日期**: 2026-08-17
> **诊断对象**: `D:\FinSightV9\src\agents\`（scene #17「Agent 应用」）
> **上游基线**: `docs/reference/agent-audit-report.md`（2026-06-27）、上一轮三维评分（综合 77/B）
> **诊断方法**: 全量 Read + Grep 不变量校验；复用 `architecture-radar-scan` SKILL 的 P0/P1/P2 证据规范
> **本轮新增事实核验**:
> - `new AgentRuntime` / `new TaskQueue` / `new AgentHealthMonitor` 在生产代码除单例外**各仅 1 处**（agentRuntime.ts:251 / taskQueue.ts:272 / agentHealthMonitor.ts:175·180）→ 旧基线报告的「双实例 P0-2」已修复。
> - `recordTask` 全仓**仅定义、零调用**（agentHealthMonitor.ts:78）→ 健康监控数据链断裂确认。
> - `mcpBridge.callTool(serverName, toolName, args, context?)`（mcpBridge.ts:63）**不接受 `AbortSignal`**，底层为进程内 MCP Server（client.ts:114 `entry.server.callTool`）→ 无法真正中断在途调用。
> - `getAllReports()` 下游消费 3 处（systemMonitorService.ts:158 / 205 / 221）→ 健康数据缺失的爆炸半径覆盖整个系统监控。

---

## 一、问题 #1 — HealthMonitor 永久空报告（严重度：高）

### 1.1 根因
`agentRuntime.execute()` 在任务终态分支（完成 / 失败 / 超时）只做了三件事：`taskQueue.markXxx()`、`eventBus.emit('AGENT_TASK_*')`、局部 Promise `resolve(task)`。**从未调用 `getAgentHealthMonitor().recordTask(task)`**。而 `AgentHealthMonitor` 的所有报告（`getHealthReport` / `getAllReports`）都依赖 `this.tasks` 这个仅由 `recordTask()` 写入的 Map。数据入口从不存在 → 报告永远为空。

### 1.2 证据（path:line）
- `src/agents/agentRuntime.ts:112-119`（`.then` 完成分支）—— 无 `recordTask`
- `src/agents/agentRuntime.ts:121-128`（`.catch` 失败分支）—— 无 `recordTask`
- `src/agents/agentRuntime.ts:88-98`（timeout 分支）—— 无 `recordTask`
- `src/agents/agentHealthMonitor.ts:78`（唯一定义点）、`:129-136`（`getAllReports` 遍历空 Map）
- 全仓 Grep `recordTask`：仅命中定义行，无任何调用方

### 1.3 触发条件
只要 Agent 系统通过 `triggerAgentInit()` 正常启动并执行任意任务，即稳定复现（非偶发）。`healthMonitor.start(30000)`（index.ts:249）照常运行 `_checkAll`，但因 `tasks` 为空，`getHealthReport` 返回 `null`，`_checkAll` 静默跳过 —— **子系统看起来在跑，实则零产出**。

### 1.4 爆炸半径
`systemMonitorService.ts` 三处消费 `getAllReports()`：
- `:158` → `getAgentSystemStatus().healthReports` → `agentHealthSnapshots` 映射为空
- `:205` `getAgentHealthSnapshots()` → 返回 `[]`
- `:221` `getAgentMetricsSummary()` → `buildMetricsSummary([], runtimeStats)` → `healthyCount/warningCount/criticalCount/totalTasks/...` 全为 0

→ 任何依赖 `SystemMonitorSnapshot.agentHealthSnapshots` / `agentMetrics` 的健康看板/系统监控面板，Agent 维度**恒为空或全零**。这是"看似完成、实则失效"型缺陷，危害高于显式报错。

### 1.5 修复路径（代码级，2 插入点）
在 `agentRuntime.ts` 顶部新增 import，并在两个终态分支各插入一行：

```ts
// agentRuntime.ts:4 附近新增
import { getAgentHealthMonitor } from './agentHealthMonitor'
```

```ts
// .then 分支（约 :119 之后）
.then((result) => {
  task.status = 'completed'
  task.result = result
  task.completedAt = Date.now()
  taskQueue.markCompleted(taskId, result)
  getAgentHealthMonitor().recordTask(task)        // ← 新增
  const duration = task.completedAt - (task.startedAt ?? task.createdAt)
  ...
})

// .catch 分支（约 :128 之后）
.catch((error) => {
  task.status = 'failed'
  task.error = error instanceof Error ? error.message : String(error)
  task.completedAt = Date.now()
  taskQueue.markFailed(taskId, task.error)
  getAgentHealthMonitor().recordTask(task)         // ← 新增
  ...
})
```

> 可选：`runAgent` 成功后追加 `getAgentHealthMonitor().recordHeartbeat(agentId)`（agentHealthMonitor.ts:89 已定义但同样零调用），让 `lastHeartbeat` 有值。

### 1.6 验证
- 新增/补充测试：执行 1 个任务后断言 `getAgentHealthMonitor().getAllReports().length >= 1` 且 `status` 与任务结果一致。
- `npx tsc --noEmit && npm test -- --run`；观察 `systemMonitorService` 快照中 `agentHealthSnapshots` 非空。

---

## 二、问题 #2 — 超时/取消未真正中断 + 状态竞态（严重度：高）

### 2.1 根因（含关键架构发现）
存在**两层**问题：

**(a) 状态竞态（确凿 bug）**：超时处理器（agentRuntime.ts:88-98）直接把 `task.status='timeout'` 并 `resolve(task)`；但此时 `runAgent()` 的 Promise 仍在飞行。其 `.then`（:112）随后执行 `task.status='completed'` 并**覆盖** `'timeout'`。由于 MCP 调用通常晚于超时或在超时后返回，`status` 最终取决于谁最后写 —— 一个真正超时的任务可能被误报为 `completed`。

**(b) 取消无法真正中断在途调用（架构限制）**：`AbortController` 的 `signal` 仅在 `runAgent` 的 `callTool` **resolve 之后**才被检查（agentRuntime.ts:162-165），且仅用于抛错；`signal` **从未传入 `mcpBridge.callTool`**（其签名为 `(serverName, toolName, args, context?)`，无 signal 形参）。更关键：底层是**进程内 MCP Server**（`client.callTool → entry.server.callTool`，client.ts:114），并非可 `AbortSignal` 中断的网络请求。因此即便透传 signal，工具处理函数若不主动读取 signal，在途调用仍会跑完。**结论：本架构下"超时=运行时停止等待并判超时、丢弃迟到结果"，而非"中断工具执行"。** 修复应聚焦消除竞态、明确语义，而非幻想 signal 取消。

### 2.2 证据（path:line）
- `agentRuntime.ts:88-98` timeout 分支直接 mutate `task.status` 并 resolve
- `agentRuntime.ts:112-119` `.then` 无条件 `task.status='completed'`（覆盖竞态）
- `agentRuntime.ts:130-136` `.finally` 再次 `resolve(task)`（resolve 幂等无害，但暴露设计假设脆弱）
- `agentRuntime.ts:162-165` `signal.aborted` 仅 post-hoc 检查
- `mcpBridge.ts:63-68` 签名无 signal；`client.ts:114` 进程内 `entry.server.callTool`

### 2.3 触发条件
任务实际耗时 > `effectiveTimeout`（如 MCP 工具慢/挂起）时必现；在 mock 测试中 `mockCallTool` 用 `setTimeout(...,10000)` + `execute(...,100)` 可以稳定复现（现有 agentRuntime.mcp.test.ts 第 64 行正是此写法，但断言只检查 `status==='timeout'`，**未覆盖迟到 resolve 覆盖**竞态 → 测试盲区）。

### 2.4 爆炸半径
- 任务状态错判 → 健康监控失败率/耗时失真（与 #1 叠加放大）
- 上层 `eventBus.emit('AGENT_TASK_TIMEOUT')` 已发出，但 `task.status` 内部被覆盖为 `completed` → 监控系统与运行时自述状态不一致
- 用户侧：超时任务显示为成功，误导重试/告警决策

### 2.5 修复路径（竞态修复，最小且安全）
引入 `settled` 守卫，保证终态只写一次、迟到结果被忽略：

```ts
return new Promise((resolve) => {
  const controller = new AbortController()
  let started = false
  let subscribed = true
  let settled = false                                   // ← 新增
  const settle = (status: AgentTask['status'], apply: () => void) => {
    if (settled) return
    settled = true
    apply()
    resolve(task)
  }

  const timeoutId = setTimeout(() => {
    taskQueue.cancel(taskId)
    settle('timeout', () => {
      task.status = 'timeout'
      task.error = `Task timeout after ${task.timeout}ms`
      task.completedAt = Date.now()
      this.runningTasks.delete(taskId)
      controller.abort()
    })
    eventBus.emit('AGENT_TASK_TIMEOUT', { taskId, agentId, type })
  }, effectiveTimeout)

  const unsubscribe = taskQueue.subscribe((qt) => {
    if (qt.id !== taskId) return
    if (qt.status === 'running' && !started) {
      started = true
      task.status = 'running'
      task.startedAt = Date.now()
      this.runningTasks.set(taskId, { controller, timeout: timeoutId })
      eventBus.emit('AGENT_TASK_STARTED', { taskId, agentId, type })
      this.runAgent(agentId, task, controller.signal)
        .then((result) => {
          settle('completed', () => {            // ← 改用 settle 守卫
            task.status = 'completed'; task.result = result
            task.completedAt = Date.now()
            taskQueue.markCompleted(taskId, result)
            getAgentHealthMonitor().recordTask(task)
          })
          eventBus.emit('AGENT_TASK_COMPLETED', { taskId, agentId, type, result })
        })
        .catch((error) => {
          settle('failed', () => {              // ← 改用 settle 守卫
            task.status = 'failed'
            task.error = error instanceof Error ? error.message : String(error)
            task.completedAt = Date.now()
            taskQueue.markFailed(taskId, task.error)
            getAgentHealthMonitor().recordTask(task)
          })
          eventBus.emit('AGENT_TASK_FAILED', { taskId, agentId, type, error: task.error })
        })
        .finally(() => {
          clearTimeout(timeoutId)
          this.runningTasks.delete(taskId)
          if (subscribed) { subscribed = false; unsubscribe() }
          // 注意：不再在此 resolve，避免与 settle 冲突
        })
      return
    }
    if (subscribed && (qt.status === 'completed' || qt.status === 'failed' || qt.status === 'timeout' || qt.status === 'cancelled')) {
      subscribed = false
      unsubscribe()
    }
  })
  taskQueue.enqueue({ id: taskId, agentId, type, payload, timeout: effectiveTimeout, priority: 'normal' })
})
```

> **语义声明（必须同步到注释/文档）**：超时 = 运行时放弃等待并判定 `timeout`，迟到返回的 MCP 结果被丢弃。若需"真正中断工具执行"，属架构级改造：需为进程内 MCP 工具处理函数引入"可协作取消"（接收 `AbortSignal` 并在长耗时步骤中检查），超出本模块单次修复范围。

### 2.6 验证
- 新增测试：mock `callTool` 在 `setTimeout(200)` 返回、以 `timeout=50` 调用，断言 `task.status==='timeout'` 且**迟到 `.then` 不将其改写为 `completed`**（可在 mock 中记录 status 最终值）。
- `npm test -- --run`；`npx tsc --noEmit`。

---

## 三、问题 #3 — 类型定义双轨制（严重度：中）

### 根因
同一领域存在两套并行类型：`src/agents/agentRuntime.ts` 的 `AgentConfig` / `AgentTask`（运行时实际使用并导出），与 `src/types/modules/agent.types.ts` 的 `AgentDefinition` / `AgentInstance` / `AgentTaskHistoryEntry` / `AgentModuleInput` / `AgentModuleOutput` 等（疑似早期/另一套抽象）。`agentStore.ts` 同时引用两者（`AgentTask` 来自 runtime，`AgentTriggerPayload`/`MCPCallRecord` 来自 agent.types），造成"哪个是真相源"模糊。

### 证据
- `agentRuntime.ts:10-32` 定义 `AgentConfig`/`AgentTask`
- `agent.types.ts:8-166` 定义 `AgentModuleInput`/`AgentDefinition`/`AgentInstance`/`AgentTaskHistoryEntry` 等
- `agentStore.ts:8-9` 同时 import 两套

### 影响
新增 Agent 能力时易改错类型；`AgentTask`（runtime）与 `AgentTaskHistoryEntry`（types）形状不同却命名相似，消费方易混淆。

### 修复路径
以 `agentRuntime.ts` 的 `AgentConfig`/`AgentTask` 为唯一真相源；将 `agent.types.ts` 中未被运行时采用的定义（`AgentModuleInput`/`AgentModuleOutput`/`AgentDefinition`/`AgentInstance` 等）迁移或删除，仅保留 `agentStore` 实际引用的 `AgentTriggerPayload`/`AgentTaskFilter`/`MCPCallRecord`/`AgentHealthSnapshot`/`AgentMetricsSummary`/`AgentFeedback*`。迁移后用 `tsc --noEmit` 校验零引用残留。

---

## 四、问题 #4 — 取消语义不一致（严重度：中）

### 根因
`cancelTask`（agentRuntime.ts:209-236）将任务置为 `status='failed'` + `error='Task cancelled'`；而 `taskQueue.cancel`（taskQueue.ts:165-192）对运行中任务置 `'cancelled'`。两套枚举不一致。`getStats()`（agentRuntime.ts:238-248）将 `failed + timeout` 合并计入 `failedTasks` → 被取消的任务虚增失败率，进而污染 HealthMonitor（#1 修复后尤为明显）。

### 修复路径
`cancelTask` 应统一置 `status='cancelled'`（与 TaskQueue 一致），`getStats()` 单独统计 `cancelled` 不计入失败。补充测试断言取消后 `task.status==='cancelled'` 且 `failedTasks` 不增。

---

## 五、问题 #5 — 任务双状态机（严重度：中）

### 根因
同一任务的生命周期被 `agentRuntime.tasks`（Map，枚举 `pending|running|completed|failed|timeout`）与 `taskQueue`（pending/running/completed/failed/timeout/**cancelled**）双重维护，枚举不完全对齐，且两者通过事件/订阅异步同步，扩大竞态面（与 #2 同源）。

### 修复路径（中期）
收敛为单一任务存储：要么以 `taskQueue` 为唯一真相源、`agentRuntime` 仅持有 `agentId→taskId` 索引；要么在 runtime 侧复用 queue 的状态枚举。短期以 #2 的 `settled` 守卫先止血。

---

## 六、问题 #6 — 队列优先级特性闲置（严重度：中）

### 根因
`TaskQueue` 完整支持 `high|normal|low`（`taskQueue.ts:19-42`），但 `agentRuntime.execute` 入队时硬编码 `priority: 'normal'`（agentRuntime.ts:147）→ 优先级调度从未被使用（全仓 Grep 确认 Agent 模块内无其他 `'high'|'low'` 入队）。

### 修复路径
二选一：
- **启用**：`execute(agentId, type, payload, timeout?, priority?: TaskPriority)` 透传到 `enqueue`；调用方（如高优采集）按需传 `high`。
- **标注**：若当前无业务诉求，显式注释为预留能力并加 `TODO`，避免"看似支持、实则无效"。

---

## 七、问题 #13 — 测试覆盖结构不均（严重度：中）

### 根因
`src/agents/__tests__/` 仅覆盖 runtime + MCP 集成（4 文件）；`agentConfigManager` / `agentRegistry` / `agentHealthMonitor` 的单元测试位于仓库根 `tests/`，文件夹内测试套件不完整；且 #1（recordTask→report）、#2（超时竞态）、#4（cancel 语义）均无针对性用例。

### 修复路径
- 在 `src/agents/__tests__/` 补 `agentHealthMonitor.test.ts`（喂 recordTask → 断言 report 的 failureRate/status）、`agentConfigManager.test.ts`（validateConfig 边界）、`agentRegistry.test.ts`。
- 在 `agentRuntime` 测试中补：超时后迟到 resolve 不改写状态（#2）、`cancelTask` 置 `cancelled`（#4）、`recordTask` 被调用（#1）。

---

## 八、低严重度问题汇总（一句话）

| # | 文件 | 问题 | 处置 |
|---|------|------|------|
| 7 | agentHealthMonitor.ts / index.ts / taskQueue.ts | 魔法数字散落（30_000/0.3/10000/60000/0.5/100/5 等） | 抽常量到模块 config 对象或 `src/constants/` |
| 8 | taskQueue.ts:248-253 | `scheduleDrain` 将 `queueMicrotask` 返回值（void）存入 `drainTimers` 当 timerId | 改为 `boolean` 去重标志 |
| 9 | taskQueue.ts:66-75 | 每次入队 `Array.from(pending.keys())` 打印全量 taskId | 降级为 `debug` 或仅 DEV |
| 10 | agentRuntime.ts:121-129 | 瞬时失败无重试/退避 | 评估是否需；若需，加有限重试 |
| 11 | agent.types.ts | `AgentModuleInput`/`AgentDefinition`/`AgentInstance` 等疑似僵尸类型 | 随 #3 一并清理 |
| 12 | agentConfigManager.ts:91-113 | `validateConfig` 不校验 `mcpServerName`/`defaultToolName` 非空 | 补非空校验，提前失败 |

---

## 九、修复优先级路线图

| 优先级 | 项 | 目标文件:行 | 动作 |
|--------|----|-------------|------|
| **P0（高）** | #1 接通 HealthMonitor | agentRuntime.ts:4 / :119 / :128 | 新增 import + 两处 `recordTask` |
| **P0（高）** | #2 消除状态竞态 | agentRuntime.ts:83-149 | 引入 `settled` 守卫，统一终态只写一次 |
| **P1（中）** | #4 取消语义 | agentRuntime.ts:209-236 / :238-248 | `cancelTask` 置 `cancelled`，`getStats` 单列 |
| **P1（中）** | #3 类型收敛 | agentRuntime.ts / agent.types.ts / agentStore.ts | 以 runtime 类型为真相源，清冗余 |
| **P1（中）** | #13 测试补全 | src/agents/__tests__/* | 补 monitor/config/registry + 竞态/取消用例 |
| **P2（低）** | #5 单状态机 | agentRuntime.ts + taskQueue.ts | 收敛任务存储（中期） |
| **P2（低）** | #6 优先级 | agentRuntime.ts:147 | 启用或标注 |
| **P2（低）** | #7-#12 | 各文件 | 卫生清理 |

---

## 十、结论

模块相对 2026-06-27 基线**显著进步**：双实例（旧 P0-2）已修复、占位符已替换为真实 MCP 调度、懒加载初始化已落地。但本轮深挖确认两个**高严重度**遗留缺陷：

1. **HealthMonitor 数据链断裂**（#1）—— 一个"安静失效"的子系统，且因 `systemMonitorService` 三处消费，爆炸半径覆盖整个系统监控的 Agent 维度。修复成本极低（2 行插入）。
2. **超时/取消状态竞态**（#2）—— 超时任务可能被误报为成功；并且由于 MCP 为进程内调用，"signal 取消在途"在本架构不可行，须以"放弃等待+丢弃迟到结果"为正确语义并止血竞态。

建议下一迭代**先落 P0 两项**（合计改动 < 40 行，且均有可加测试），再推进 P1 类型收敛与测试补全。综合健康度评估维持 **77 / B**，但 P0 修复后预计可上探至 **82–85 / B+**。
