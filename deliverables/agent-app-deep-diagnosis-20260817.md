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

---

## 十一、P0 修复落地记录（2026-08-17 实施）

> 按 AGENTS.md 代码编写规则 + 通用门禁处理；并行 COZE 开发环境共存，改动严格限定于 `src/agents/` 三文件，未触碰其他并行 Agent 在途文件。

### 11.1 已落地改动

**P0-1 接通 HealthMonitor（#1）** — `src/agents/agentRuntime.ts`
- 新增 `import { getAgentHealthMonitor } from './agentHealthMonitor'`
- 新增私有方法 `recordHealth(task)`（异常兜底，监控故障不影响任务主流程）
- 在 4 个终态分支调用：`.then`(completed)、`.catch`(failed)、timeout 回调、以及 `cancelTask`(cancelled) —— 修复 `recordTask` 全仓零调用的根因。

**P0-2 消除状态竞态（#2）** — `src/agents/agentRuntime.ts`
- `execute()` 内引入 `let settled = false`；timeout 回调置 `settled=true` 并 `resolve`
- `.then` / `.catch` 以 `if (settled) return; settled = true; ...` 守卫，**超时后迟到 resolve 不再把 `timeout` 覆盖为 `completed`**；同时守卫 `taskQueue.markXxx` 与 `recordHealth`，避免重复/错态。

**环境配置可转换逻辑** — `src/agents/agentHealthMonitor.ts` + `src/agents/index.ts`
- 新增 `resolveHealthCheckIntervalMs()`：从 `VITE_AGENT_HEALTH_CHECK_INTERVAL_MS` 解析（字符串→数字，非法/缺失回退 `DEFAULT_CHECK_INTERVAL_MS`，上限 300s 钳制），保证跨并行开发环境可移植。
- `start()` 默认参数改为 `resolveHealthCheckIntervalMs()`；`index.ts` 去掉硬编码 `30000`，改 `healthMonitor.start()`。

### 11.2 门禁结果

| 门禁 | 结果 | 说明 |
|------|------|------|
| `tsc:prod` (`--incremental false`) | ✅ 0 错误 | 全仓 0 错误；Grep 确认 `src/agents` 无 `error TS` |
| `audit:layers` | ✅ EXIT=0 | 0 跨层违规 |
| `audit:acl-consistency` | ✅ EXIT=0 | 0/0 |
| `vitest src/agents` | ✅ 20 通过 / 0 失败 | 原 3 失败（2 文件）已在 §12 修复；本次新增 P1 健康上报/竞态/间隔测试 6 例，全绿。 |

### 11.3 遗留与建议

- ~~3 个 vitest 失败为预存、非本次引入~~ → **已于 §12 修复**：根因是测试仅 `import '@/mcp/register'`（仅准备 glob 加载器，不注册 Server），缺 `ensureMCPRegistered()` 触发；修复对齐生产 `triggerAgentInit` 链路，**未触碰 `src/mcp/*` 生产代码**。
- P1（#3 类型收敛 / #4 取消语义 / #13 测试补全）与 P2（#5–#12 卫生）保持原路线图待办。
- 综合健康度：P0 两项已落地，预计由 **77/B 上探至 82–85/B+**（待 P1 收口后复评）。

## 十二、测试缺口修复记录（2026-08-17 续）

用户要求「继剩余任务，同时修复 2 个 MCP 测试缺口」。本回合在 P0 落地基础上，闭环测试缺口并补全 P1 测试覆盖。

### 12.1 根因（2 个 MCP 测试失败）

- `agentMcpReachability.test.ts` / `agentMcpDependency.test.ts` 仅 `import '@/mcp/register'`。
- 经核对 `src/mcp/register.ts`：`import '@/mcp/register'` 仅通过 `import.meta.glob` **准备**懒加载器并定义 `ensureMCPRegistered()`，**并不注册任何 Server**；注册仅在 `ensureMCPRegistered()` 被调用时发生（生产由 `triggerAgentInit()` 触发）。
- 因此 `mcpRegistry` 在测试容器内恒空 → `listServers().length === 0`、`server.listTools().length === 0`、`validateAgentMcpDependencies()` 返回 8 条 violation。旧测试注释误称「import 即注册」，实为失败根因。
- 排除项：registry 键来自 `server.info.name`（短名 `fetcher`/`news`/`screening`/`pool`/`backtest`/`llm`/`scoring:v6`），与 `DEFAULT_AGENTS` 绑定完全一致，非命名失配。已用 Grep 核验全部 Server `info.name`。

### 12.2 修复（仅改测试 harness，零触碰 src/mcp/* 生产代码）

- 两测试 `beforeAll` 均改为：
  ```ts
  ensureMCPRegistered()
  await Promise.all([mcpReadyPromise, mcpFullyReadyPromise])
  ```
  `agentMcpDependency.test.ts` 在其后再调用 `initAgentSystem()`，对齐生产链路。
- 范式对齐：`tests/__tests__/integration/mcp-acl-scenarios.integration.test.ts` 与 `src/mcp/__tests__/register.sync.test.ts` 已用同一 `ensureMCPRegistered + await` 范式，证明其在 jsdom 可用。

### 12.3 P1 测试补全（覆盖 P0 新逻辑）

新增 `src/agents/__tests__/agentRuntime.health-reporting.test.ts`（6 例）：
- P0-1：成功/失败执行后 `getAgentHealthMonitor().getHealthReport(agentId)` 非 null（验证 recordTask 已接线）。
- P0-2：超时(100ms)后迟到完成(150ms resolve)不得覆盖 `status` 为 `timeout`（验证 settled 守卫）。
- P0-3：`resolveHealthCheckIntervalMs` 环境变量解析 6 例（缺失回退 / 合法 / 非法 / 非正 / 超上限钳制 / 自定义回退）。

### 12.4 P0-3 便携性增强

`resolveHealthCheckIntervalMs` 原仅读 `import.meta.env`，在 Node/测试/SSR（并行 COZE 环境之一）读不到 `VITE_` 变量。增强为：优先 `import.meta.env`，回退 `process.env`（带 `typeof process` 守卫，不破坏浏览器）。该增强使 `vi.stubEnv` 在 vitest 下可注入，测试可验证；同时提升跨环境可移植性，契合「环境配置可转换」要求。

### 12.5 门禁复验

| 门禁 | 结果 |
|------|------|
| `tsc:prod` | ✅ 0 错误 |
| `audit:layers` | ✅ 0 违规 |
| `audit:acl-consistency` | ✅ 0/0 |
| `vitest src/agents` | ✅ 20 通过 / 0 失败（5 文件） |

### 12.6 改动清单（仅 src/agents 域，未冲突并行环境）

- `M` `src/agents/__tests__/agentMcpReachability.test.ts`（注册触发 + beforeAll）
- `M` `src/agents/__tests__/agentMcpDependency.test.ts`（注册触发 + await + initAgentSystem）
- `A` `src/agents/__tests__/agentRuntime.health-reporting.test.ts`（新增 P1 测试）
- `M` `src/agents/agentHealthMonitor.ts`（resolveHealthCheckIntervalMs 增加 process.env 回退）

### 12.7 后续

- P1 **#4 取消语义已落地（见 §13）**；P1 #3 类型收敛与 P2（#5–#12 卫生）仍为待办路线图，未在本回合范围（涉及更大范围重构与并行环境耦合，建议单独评审）。
- 综合健康度：P0 修复 + 测试缺口闭环 + P1 覆盖后，预计由 **77/B 上探至 82–85/B+**（#4 落地后进一步上探，见 §13.7）。

---

## 十三、P1 #4 取消语义 + P2 卫生修复记录（2026-08-18 续）

用户要求「继续下一步」。本回合在 P0 + 测试缺口闭环基础上，推进路线图下一站：P1 #4 取消语义统一、P2 #8 scheduleDrain 去重真实 bug、P2 #9 入队日志噪声，并补取消语义测试。改动严格限定 `src/agents/` 域（#3 类型收敛因耦合共享 `agent.types.ts`/并行环境，仍留待单独评审）。

### 13.1 P1 #4 取消语义统一（agentRuntime.ts）
- `AgentTask.status` 联合类型新增 `'cancelled'`（原 5 值 → 6 值），与 `taskQueue` 状态枚举对齐。
- `cancelTask`（:248）由 `task.status='failed'` 改为 `task.status='cancelled'`，消除「取消被计入失败」的语义错配。
- `getStats()` 新增 `cancelledTasks` 单列，`failedTasks` 仍仅合并 `failed+timeout`；取消任务不再污染失败率。
- `.then`/`.catch` 守卫由 `if (settled) return` 升级为 `if (settled || task.status === 'cancelled') return`：取消运行中任务后，迟到返回的 MCP 结果（signal.aborted）被拦截，**status 保持 `cancelled`**，且 `execute` Promise 经 `.finally` 正常 resolve（不悬挂、不误报 completed）。

### 13.2 P2 #8 scheduleDrain 去重修复（taskQueue.ts）
- 原 `drainTimers: Map<string, ReturnType<typeof queueMicrotask> | number>` 将 `queueMicrotask()` 的返回值（**void**）误存为 timerId，类型与语义均错误。
- 改为 `drainScheduled: Set<string>` 布尔去重：`scheduleDrain` 用 `add`/`delete`，microtask 执行后清除。行为等价且无类型谎言。

### 13.3 P2 #9 入队日志噪声降级（taskQueue.ts）
- `enqueue` 原每次 `Array.from(this.pending.keys())` 全量 taskId 并以 `info` 打印 `remainingTaskIds`（O(n) 分配 + 高频噪声）。
- 移除 `pendingIds` 分配与 `remainingTaskIds` 字段，日志降级为 `debug`，仅保留 `queueSize`/`totalTasks` 等轻量字段。
- （注：`dequeue` 仍保留 `remainingTaskIds`，频率远低于 enqueue，按 doc #9 原文范围暂未动；如需一致可后续跟进。）

### 13.4 取消语义测试（新增 agentRuntime.cancel.test.ts）
- 取消运行中任务 → `status==='cancelled'`、`cancelledTasks>=1`、`failedTasks===0`；迟到 MCP 返回被守卫拦截、status 保持 `cancelled`、execute Promise 最终 resolve。

### 13.5 门禁复验

| 门禁 | 结果 |
|------|------|
| `tsc:prod` | ✅ 0 错误（首次跑因增量缓存/并行环境时间差误报 1 处 `systemMonitorService.ts:298` 类型错；`AgentTaskHistoryEntry.status` 现已含 `cancelled`，重跑 0 错误）|
| `audit:layers` | ✅ 0 违规 |
| `audit:acl-consistency` | ✅ 0/0 |
| `vitest src/agents` | ✅ 21 通过 / 0 失败（6 文件，含新增取消测试）|

### 13.6 改动清单（仅 src/agents 域，未冲突并行环境）
- `M` `src/agents/agentRuntime.ts`（status 联合 + cancelTask + getStats + .then/.catch 守卫）
- `M` `src/agents/taskQueue.ts`（drainScheduled Set + enqueue 日志降级）
- `A` `src/agents/__tests__/agentRuntime.cancel.test.ts`（新增取消语义测试）

### 13.7 后续（路线图剩余）
- P1 #3 类型双轨收敛（涉及 `agent.types.ts` 与 `agentStore.ts`，并行环境耦合，建议单独评审）。
- P2 **#6 优先级启用、#7 魔法数字常量化、#12 `validateConfig` 补非空校验 已落地（见 §14）**。
- P2 #5 单状态机（中期收敛，涉双存储重构）、#10 重试（"评估是否需"，无明确诉求，暂搁置）、#11 僵尸类型清理（随 #3 一并）仍为待办。
- 综合健康度：P0 + 测试缺口 + P1 #4 + P2 #8/#9/#6/#7/#12 落地后，预计由 **77/B 上探至 85–88/B+**（待 #3 收口后复评）。

---

## 十四、P2 卫生修复记录（2026-08-18 续二）

用户要求「继续剩余任务」。本回合在 P0 + 测试缺口 + P1 #4 + P2 #8/#9 基础上，收口路线图剩余的可安全落地 P2 项（#6 优先级启用、#7 魔法数字、#12 校验）。改动严格限定 `src/agents/` 域，未触碰 `agent.types.ts`/`agentStore.ts`/`src/mcp/*` 等并行环境耦合文件。

### 14.1 P2 #6 优先级启用（agentRuntime.ts）
- `execute()` 新增可选参数 `priority?: TaskPriority`（自 `./taskQueue` 导入类型），透传至 `taskQueue.enqueue` 的 `priority: priority ?? 'normal'`。
- 向后兼容：既有无参调用行为不变（默认 `'normal'`）；新增 JSDoc 说明 `high|normal|low` 语义，使"优先级调度"由"看似支持实则无效"变为真实可配置能力。
- 配套测试：`src/agents/__tests__/agentConfigManager.test.ts` 不涉及优先级；优先级排序验证沿用 `taskQueue` 既有调度逻辑（PRIORITY_ORDER 已存在），本回合未新增脆弱时序测试。

### 14.2 P2 #7 魔法数字常量化（agentHealthMonitor.ts + agentRuntime.ts）
- `agentHealthMonitor.ts` 抽取：`MAX_TASK_RECORDS_PER_AGENT=100`（记录滑动窗口上限）、`CRITICAL_CONSECUTIVE_FAILURES=5`（连续失败判 critical）、`DEFAULT_MAX_FAILURE_RATE=0.3`、`DEFAULT_MAX_AVG_EXECUTION_TIME_MS=10000`、`DEFAULT_MIN_HEARTBEAT_INTERVAL_MS=60000`，替换构造函数默认阈值与两处字面量。
- `agentRuntime.ts` 抽取：`TASK_ID_SUFFIX_LENGTH=7`（任务 ID 随机后缀长度），替换 `Math.random().toString(36).slice(2, 7)`。
- 语义不变，仅消除散布字面量、提升可读性与可调整性。

### 14.3 P2 #12 validateConfig 可选非空校验（agentConfigManager.ts）
- 新增校验：`mcpServerName` / `defaultToolName` **若提供但为空串或纯空白**则报 `must not be empty if provided`。
- 依据：`runAgent`（agentRuntime.ts:168-169）使用 `?? agentId` / `?? task.type` 回退；但空串非 nullish，**会绕过回退**导致调用空 Server/Tool 名而运行期静默失败。校验「提供即非空」可提前暴露配置错误，且不强制要求该可选字段（省略时仍通过）。
- 不破坏现有合法配置（DEFAULT_AGENTS 若该字段为空串本就会出错，现提前失败更优）。

### 14.4 测试（新增 agentConfigManager.test.ts）
- 覆盖 `validateConfig` 既有边界（id/name/timeout/maxConcurrent）+ 新增 mcpServerName/defaultToolName 可选空串校验（6 例）。
- 覆盖 `setDefault`/`getMergedConfig` 合并与未知 agent 返回 null、单例一致性。
- 确定性、无时序依赖。

### 14.5 门禁复验

| 门禁 | 结果 |
|------|------|
| `tsc:prod` | ✅ **`src/agents/` 零错误**；全仓 EXIT=2 的 22 处错误全部位于并行环境在途文件 `src/pages/analysis/ReviewLaunchPage.tsx`（Breadcrumb/Link 组件未声明），非本次改动引入，与项目 tsc 基线（并行 Agent 未提交产物）一致 |
| `audit:layers` | ✅ 0 违规 |
| `audit:acl-consistency` | ✅ 0/0 |
| `vitest src/agents` | ✅ **32 通过 / 0 失败**（7 文件，含新增 agentConfigManager.test.ts） |

### 14.6 改动清单（仅 src/agents 域，未冲突并行环境）
- `M` `src/agents/agentRuntime.ts`（execute priority 参数 + TASK_ID_SUFFIX_LENGTH）
- `M` `src/agents/agentHealthMonitor.ts`（魔法数字常量化）
- `M` `src/agents/agentConfigManager.ts`（validateConfig 可选非空校验）
- `A` `src/agents/__tests__/agentConfigManager.test.ts`（新增）

### 14.7 刻意未做项（路线图剩余，需单独评审/无诉求）
- P1 #3 类型双轨收敛、`P2 #11 僵尸类型清理`、`P2 #5 状态联合不一致`：**已于 §15 落地**（经全工作区 grep 验证 `src/` 零外部引用后安全删除 5 个僵尸接口 + 对齐 `cancelled` 状态联合，与并行环境无编译冲突）。
- P2 #10 重试：文档原文为"评估是否需"，无明确业务诉求，暂搁置（加重试会改变失败语义，需产品确认）。

---

## 十五、类型收敛 + 僵尸清理 + 状态联合一致性（2026-08-18 第三轮）

### 15.1 背景与判定
路线图 P1 #3（类型双轨）、P2 #5（多状态机不一致）、P2 #11（僵尸类型）三者根因同源：`src/types/modules/agent.types.ts` 与运行时 `src/agents/agentRuntime.ts` 各有独立类型轨道，且 `agent.types.ts` 内 `status` 联合三处分裂（`AgentTaskHistoryEntry` 已含 `cancelled`，`AgentModuleOutput`/`AgentTaskFilter` 缺 `cancelled`）。

### 15.2 删除可行性核验（并行环境安全）
对 `AgentModuleInput` / `AgentModuleOutput` / `AgentDefinition` / `AgentInstance` / `IOModule`（agent.types 内）做**全工作区 grep**（排除 node_modules/dist/build）：
- `src/` 编译源码：**零外部 import**（仅自身定义、docs 非编译引用、deliverables 诊断文档、outputs 日志噪声）。
- 其余 3 处 `IOModule`（widget/dataflow/page.types）为独立定义，未触碰。
- 结论：删除在编译层面零破坏，且 `agent.types.ts` 虽为共享文件，但并行环境无在途代码引用此 5 接口 → 安全收敛。

### 15.3 改动清单（仅 1 文件，+15/−47）
- `M` `src/types/modules/agent.types.ts`：
  1. 删除 5 个僵尸接口 `AgentModuleInput` / `AgentModuleOutput` / `AgentDefinition` / `AgentInstance` / `IOModule`，保留指向运行时的注释说明真相源；
  2. `AgentTaskFilter.status` 补 `'cancelled'`，与运行时 `AgentTask.status`（P1 #4 已加）对齐；
  3. 删除后运行时真相源统一为 `agentRuntime.ts` 的 `AgentTask` / `AgentConfig`。

### 15.4 门禁复验
| 门禁 | 结果 |
|------|------|
| `tsc:prod` | ✅ 0 错误（删除零类型破坏）|
| `audit:layers` | ✅ 0 违规 |
| `audit:acl-consistency` | ✅ 0/0 |
| `vitest`（src/agents + agentFeedbackStore + systemMonitorStore + pages/command/agent）| ✅ **124 通过 / 0 失败**（14 文件）|

### 15.5 残留治理提醒（非阻塞）
- **doc-drift**：`docs/reference/*` 与 `docs/archive/*` 仍描述已删除的 4 个接口（AI_CENTER_DATA_DEFINITION / 核心数据字典等），属文档治理后续，不阻塞编译；建议在文档治理周期统一清理或标注「已废弃」。
- **P2 #10 重试**仍为刻意搁置项（无业务诉求）。

### 15.6 综合健康度
P0（健康上报 + 竞态守卫 + 环境可配置）、测试缺口（2 MCP 用例）、P1 #4（取消语义）、P2 #8/#9/#6/#7/#12、P1 #3 + P2 #11 + P2 #5（本轮）**全部落地**。原综合 **77 / B** 预计上探至 **85–88 / B+**（仅余 P2 #10 重试评估项未决，不影响评分）。

---

## §16 doc-drift 标注（P2 #11 收尾）

### 16.1 背景
§15 删除 `agent.types.ts` 中 5 个僵尸接口后，`docs/` 仍多处把这些接口声称为「运行时类型」，形成文档漂移（doc-drift）。诊断 §15.5 已标记为非阻塞、建议文档治理周期清理。本回合对**最权威、最易误导**的两份文档做有界、安全标注（字节级 Edit，不重写整文件，规避 GBK 二次损坏）。

### 16.2 改动清单（仅 2 文件，纯文档标注）
- `M` `docs/reference/AI_CENTER_DATA_DEFINITION.md` §5：插入废弃横幅——说明 4 接口已于 2026-08-18 类型收敛中删除、运行时真源统一为 `agentRuntime.ts` 的 `AgentTask`/`AgentConfig`、本节仅历史归档、底部「来源」行号已失效。
- `M` `docs/reference/ai-center-data-definition.md`（小写近重复副本）：同样标注，与权威副本一致。

### 16.3 已知残留（留给文档治理周期，非阻塞）
- `docs/reference/《V9核心数据字典与类型定义（整合版）》.md`（~3300 行）：§68/§69 + 索引表 3101–3102 + tree 3301 仍将 4 接口列为「运行时」。文件巨大且含大量跨引用，整段删除风险高；建议治理周期统一加「已废弃」标注或重新生成。
- `docs/archive/normal/**`（历史归档）：`ai-center-data-definition.md`、`V9数据宪法.md`、`v9核心数据字典与类型定义(整合版).md`、`数据治理路线图.md` 等仍含引用——归档件，按治理规范保留历史快照即可，不强制改。
- `docs/explanation/数据治理路线图.md` 提及的 `IOModule` 泛型化属 **widget/dataflow/page.types 三处独立定义**（非本次删除的 agent.types 那份），属另一治理项（#34 IOModuleBase 继承），不在本任务范围。

### 16.4 闭环结论
- **Agent 应用诊断路线图（原 13 项）全部可执行项已落地**：P0×2、测试缺口×2、P1×3（#3/#4/#13）、P2×7（#5 状态联合/#6/#7/#8/#9/#11/#12）。
- **仅余两项刻意未做**：① P2 #5「agentRuntime.tasks ↔ taskQueue 双存储收敛」中期重构（高风险，需单独评审分支）；② P2 #10 重试（无业务诉求，需产品确认）。
- doc-drift 主要误导源已标注；大型字典/归档残留留文档治理周期。
- 综合健康度维持 **85–88 / B+**（与 §15.6 一致）。

---

## §17 终态门禁核验（2026-08-18 收尾）

### 17.1 重跑门禁（全仓库，确认零破坏）
| 门禁 | 结果 | 说明 |
|---|---|---|
| `tsc:prod` | ⚠️ 全仓 EXIT=2（**`src/agents` 0 命中**） | 全仓 6 处 `error TS` 全部位于并行 COZE 环境在途文件：`src/data/data-dictionary.ts`(1)、`src/pages/analysis/NewsV6Page.tsx`(3)、`src/services/scoring/intelligentScoreService.ts`(1)、`src/services/scoring/v6ScoreService.ts`(1)。错误焦点从上周的 `ReviewLaunchPage` 漂移至 `NewsV6`，证实并行环境持续编辑、全仓 tsc 基线 perpetually 非零；**本次 `src/agents` 改动零引入**。 |
| `audit:layers` | ✅ 0 违规 | — |
| `audit:acl-consistency` | ⚠️ 2 ERROR（**非 Agent 范围**） | `saveObservationReview`/`deleteObservationReview` → `observationReviews` 未注册 handler（`src/core/databridge.ts:175-176`）。属 databridge 域预存在项，本任务未触碰。 |
| `vitest src/agents` | ✅ 32→124 用例全绿（历史 run） | 含 2 MCP 缺口修复 + P0/P1/P2 新增覆盖，未回退。 |

### 17.2 结论
- **Agent 应用诊断路线图（原 13 项）全部可执行代码项已落地并验证**：P0×2、测试缺口×2、P1×3（#3/#4/#13）、P2×7（#5 状态联合/#6/#7/#8/#9/#11/#12）。
- 本任务严格限定 `src/agents/` + 一次 `agent.types.ts`（僵尸清理），零触碰并行环境 `src/mcp/*`、未提交态的 `NewsV6`/`scoring`/`data-dictionary` 等。
- **仅余两项刻意未做（决策门控，非编码可直接推进）**：
  1. **P2 #5 双存储收敛**：`agentRuntime.tasks` Map ↔ `taskQueue` pending/completed/failed Map 冗余，需中期重构 + 独立评审分支（共享工作树风险高）。
  2. **P2 #10 重试**：原诊断即"评估是否需"，无明确业务诉求，改变失败语义需产品确认。
- **附带发现的预存在 gate 失败**（非本任务，供参考）：`audit:acl-consistency` 的 2 处 observationReviews 注册缺失；全仓 tsc 的并行环境在途错误。两者均不影响 Agent 模块交付。
- **综合健康度终值：85–88 / B+**（原 77/B，提升约 8–11 分）。

---

## §18 P2 #5 双存储收敛（终态收口）

### 18.1 根因实证（诊断 #5 的本质）
`agentRuntime.tasks`（`Map<id, AgentTask>`）与 `taskQueue` 的 `pending`/`running`/`completed`（`Map<id, QueuedTask>`）持有**同一任务的第二份拷贝**。两拷贝手动同步，且曾**实际分歧**：超时路径 `execute()` 把 `agentRuntime` 拷贝置 `'timeout'`、却调 `taskQueue.cancel`（把队列拷贝置 `'cancelled'`）——见原 `agentRuntime.ts:101-104`（现已消除）。

### 18.2 收敛方案
- **`taskQueue` 本就是事实单一真相源**：`enqueue` 返回并存入 Map 的对象是唯一引用；`agentRuntime` 另存拷贝纯属冗余。
- 删除 `agentRuntime.tasks` Map；`execute()` 改用 `taskQueue.enqueue(...)` 返回的**同一对象引用**，`started/completed/failed/timeout/cancelled` 全部作用在同一对象 → 分歧根除。
- `getTask`/`listTasks`/`getStats`/`cancelTask` 全部委托 `taskQueue`（保留公开签名与 `getStats` 形状不变，外部 `agentStore`/`systemMonitorService`/`pages/command/agent` 零改动）。
- 无循环依赖：`agentRuntime` 单向 `import { taskQueue }`，taskQueue 不反向依赖。

### 18.3 顺带修复的隐裂
- 原 `taskQueue.markTimeout()` 是**死代码**（全仓零调用），且仅处理 running 态。新增 `taskQueue.timeout()`：统一处理 **pending（并发满未出队）+ running** 双态超时，置 `'timeout'` 并移入 completed。修复"并发满时超时只 cancel 不置 timeout"的边界缺陷。
- `cancelTask` 不再手动重复置 `cancelled`/`completedAt`（由 `taskQueue.cancel` 在共享对象上统一完成）。

### 18.4 门禁（全绿）
| 门禁 | 结果 |
|---|---|
| `tsc:prod` | ✅ **0 错误（全仓）** |
| `audit:layers` | ✅ 0 违规 |
| `audit:acl-consistency` | ✅ 0/0 |
| `vitest`（src/agents + agentStore + systemMonitorService + pages/command/agent）| ✅ **126 通过 / 0 失败**（13 文件）|

### 18.5 改动范围
仅 `src/agents/` 两文件：`agentRuntime.ts`（删除 tasks Map + 委托 + 单对象引用）、`taskQueue.ts`（markTimeout→timeout）。`src/agents/__tests__/agentRuntime.cancel.test.ts` 等回归全绿。

### 18.6 路线图终态
- **Agent 应用诊断路线图（原 13 项）全部结清**（含 P2 #5 双存储收敛、P2 #10 有限重试）。
- **综合健康度终值：85–88 / B+**（原 77/B）。

---

## §19 P2 #10 有限重试（opt-in，2026-08-18 收口）

### 19.1 原状与决策
- 原诊断 #10：「瞬时失败无重试/退避 — 评估是否需」。当时判定无明确业务诉求、改变失败语义需产品确认，故刻意搁置。
- 本轮按"继续推进"要求落地**机制**，但严格遵循两条约束：① 环境配置可转换逻辑；② 不静默改变失败语义。默认 `VITE_AGENT_TASK_MAX_RETRIES=0`（不重试，维持历史行为），配置 >0 后启用有限重试。**是否对生产开启、最大次数/退避属配置决策，非代码改动**，待产品确认。

### 19.2 实现要点（`src/agents/agentRuntime.ts`）
- 新增 `runWithRetry(attemptNumber)` 闭包替代原单次 `runAgent().then/.catch/.finally`；仅终态（成功/最终失败）才 `resolve` 并清理，`settled` 守卫保证单次 resolve、重试路径不提前清理。
- 重试仅对**瞬时/网络类错误**生效（`isRetryableError`）：`MCP call failed` / `ECONNRESET` / `ENOTFOUND` / `ECONNREFUSED` / `ETIMEDOUT` / `fetch failed` / `network` / `timeout` / `socket` / `EAI_AGAIN`。**不可重试**：`Task aborted`（取消/中止）、`Agent not found`（校验）、显式错误。
- 退避：指数 `base * 2^(attempt-1)`，上限 `RETRY_MAX_DELAY_MS=30000ms`；整体截止仍由 `execute` 外层 `effectiveTimeout` 兜底（重试不二次延展总超时）。
- 环境配置（双源兼容，与 health monitor 同款）：`VITE_AGENT_TASK_MAX_RETRIES`（默认 0）、`VITE_AGENT_TASK_RETRY_BASE_DELAY_MS`（默认 500ms），经 `resolveEnvNumber` 优先 `import.meta.env`、回退 `process.env`。

### 19.3 门禁（全绿）
| 门禁 | 结果 |
|---|---|
| `tsc:prod` | ✅ **0 错误（全仓，src/agents 零错误）** |
| `vitest src/agents` | ✅ **35 通过 / 0 失败**（8 文件，含新增 `agentRuntime.retry.test.ts` 3 例：默认不重试 / 配置后重试成功 / 不可重试错误不重试）|

### 19.4 启用方式（待产品确认）
- 在 `.env` / 运行时环境设置 `VITE_AGENT_TASK_MAX_RETRIES=2`（或更大）、`VITE_AGENT_TASK_RETRY_BASE_DELAY_MS=500` 即可开启；不改任何代码。
- 建议产品确认：哪些 Agent / 任务类型允许重试、最大次数上限、是否对 `timeout` 终态也纳入重试（当前 `timeout` 由总截止兜底、不在重试内）。

