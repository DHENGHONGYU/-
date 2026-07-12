/**
 * WorkflowServer 单元测试
 *
 * 测试范围：
 * 1. info / listTools / listResources / listPrompts 元信息
 * 2. 工作流 CRUD（create / get / update / list / delete）
 * 3. 执行引擎：delay/note 步骤同步成功、批处理多标的、错误容错（onError=continue）
 *
 * 说明：测试仅用 delay/note 步骤（不依赖外部 Server），避免引入全局注册副作用；
 * run_workflow 为 fire-and-forget（立即返回 runId），通过轮询 get_run_status 验证终态。
 *
 * @module mcp/__tests__/workflowServer.test.ts
 * @created 2026-07-13
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowServer } from '../servers/workflow/workflowServer'
import type { ToolResult } from '@/mcp/core/types'
import type { WorkflowRun, WorkflowStep } from '../servers/workflow/workflowServer'

/** 从 ToolResult 解析 JSON 文本 */
function parseResult(res: ToolResult): unknown {
  const text = res.content[0]?.text
  if (text === undefined) throw new Error('empty tool result')
  return JSON.parse(text)
}

/** 轮询运行实例直到终态 */
async function pollRun(server: WorkflowServer, runId: string, tries = 80): Promise<WorkflowRun> {
  for (let i = 0; i < tries; i++) {
    const res = await server.callTool('get_run_status', { runId })
    const run = parseResult(res) as WorkflowRun
    if (['success', 'failed', 'partial', 'cancelled'].includes(run.status)) return run
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error(`run ${runId} did not reach terminal state`)
}

describe('WorkflowServer', () => {
  let server: WorkflowServer

  beforeEach(() => {
    server = new WorkflowServer()
  })

  describe('info', () => {
    it('应返回正确的 Server 信息', () => {
      expect(server.info.name).toBe('workflow:main')
      expect(server.info.version).toBe('1.0.0')
      expect(server.info.dependencies).toEqual([])
    })
  })

  describe('listTools', () => {
    it('应返回 17 个 Tool', () => {
      const tools = server.listTools()
      expect(tools).toHaveLength(17)
      const names = tools.map((t) => t.name)
      expect(names).toContain('create_workflow')
      expect(names).toContain('run_workflow')
      expect(names).toContain('get_run_status')
      expect(names).toContain('schedule_workflow')
      expect(names).toContain('register_trigger')
      expect(names).toContain('remove_trigger')
      expect(names).toContain('export_workflows')
      expect(names).toContain('import_workflows')
    })

    it('每个 Tool 应有 description 和 object 类型 inputSchema', () => {
      for (const tool of server.listTools()) {
        expect(tool.description).toBeTruthy()
        expect(tool.inputSchema.type).toBe('object')
      }
    })
  })

  describe('listResources', () => {
    it('应返回 4 个 Resource', () => {
      const resources = server.listResources()
      expect(resources).toHaveLength(4)
      const names = resources.map((r) => r.name)
      expect(names).toContain('工作流定义列表')
      expect(names).toContain('运行实例快照')
      expect(names).toContain('定时调度列表')
      expect(names).toContain('单个运行详情')
    })
  })

  describe('listPrompts', () => {
    it('应返回 1 个 Prompt', () => {
      const prompts = server.listPrompts()
      expect(prompts).toHaveLength(1)
      expect(prompts[0]!.name).toBe('workflow_designer')
    })
  })

  describe('工作流 CRUD', () => {
    const steps: WorkflowStep[] = [
      { id: 's1', type: 'note', name: '开始' },
      { id: 's2', type: 'delay', ms: 0 },
    ]

    it('create → get → update → list → delete 全流程', async () => {
      const created = parseResult(
        await server.callTool('create_workflow', { name: '研究流程A', steps }),
      ) as { id: string; name: string; steps: WorkflowStep[] }
      expect(created.id).toBeTruthy()
      expect(created.steps).toHaveLength(2)

      const got = parseResult(await server.callTool('get_workflow', { workflowId: created.id })) as {
        id: string
        name: string
      }
      expect(got.id).toBe(created.id)

      const updated = parseResult(
        await server.callTool('update_workflow', { workflowId: created.id, name: '研究流程A-改' }),
      ) as { name: string }
      expect(updated.name).toBe('研究流程A-改')

      const list = parseResult(await server.callTool('list_workflows', {})) as Array<{ id: string }>
      expect(list.find((w) => w.id === created.id)).toBeTruthy()

      const deleted = parseResult(
        await server.callTool('delete_workflow', { workflowId: created.id }),
      ) as { deleted: boolean }
      expect(deleted.deleted).toBe(true)

      const afterDel = parseResult(await server.callTool('list_workflows', {})) as Array<{ id: string }>
      expect(afterDel.find((w) => w.id === created.id)).toBeUndefined()
    })

    it('get_workflow 查询不存在应返回错误', async () => {
      const res = await server.callTool('get_workflow', { workflowId: 'nope' })
      expect(res.isError).toBe(true)
    })

    it('create_workflow 空步骤应拒绝', async () => {
      const res = await server.callTool('create_workflow', { name: '空', steps: [] })
      expect(res.isError).toBe(true)
    })
  })

  describe('执行引擎', () => {
    it('delay/note 步骤应成功完成', async () => {
      const created = parseResult(
        await server.callTool('create_workflow', {
          name: '延迟流程',
          steps: [
            { id: 's1', type: 'note', name: '第一步' },
            { id: 's2', type: 'delay', ms: 0 },
          ],
        }),
      ) as { id: string }

      const started = parseResult(
        await server.callTool('run_workflow', { workflowId: created.id }),
      ) as { runId: string; status: string }
      expect(started.status).toBe('running') // run_workflow 同步启动后返回
      expect(started.runId).toBeTruthy()

      const run = await pollRun(server, started.runId)
      expect(run.status).toBe('success')
      expect(run.stepResults).toHaveLength(2)
      expect(run.stepResults.every((r) => r.status === 'success')).toBe(true)
    })

    it('批处理：N 个标的 × M 步骤 = N*M 条结果', async () => {
      const created = parseResult(
        await server.callTool('create_workflow', {
          name: '批处理',
          steps: [{ id: 's1', type: 'note' }],
        }),
      ) as { id: string }

      const started = parseResult(
        await server.callTool('run_workflow', { workflowId: created.id, targets: ['600000', '000001', '300750'] }),
      ) as { runId: string }

      const run = await pollRun(server, started.runId)
      expect(run.status).toBe('success')
      expect(run.stepResults).toHaveLength(3)
      // 验证变量替换：每个标的的步骤记录了对应 target
      const targets = run.stepResults.map((r) => r.target).sort()
      expect(targets).toEqual(['000001', '300750', '600000'])
    })

    it('错误容错：未知 server 步骤 onError=continue 时 run 为 partial', async () => {
      const created = parseResult(
        await server.callTool('create_workflow', {
          name: '容错',
          steps: [
            { id: 's1', type: 'note', name: 'ok' },
            { id: 's2', type: 'mcp_tool', server: 'ghost-server', tool: 'no_tool', onError: 'continue' },
          ],
        }),
      ) as { id: string }

      const started = parseResult(
        await server.callTool('run_workflow', { workflowId: created.id }),
      ) as { runId: string }

      const run = await pollRun(server, started.runId)
      expect(run.status).toBe('partial')
      const failed = run.stepResults.find((r) => r.stepId === 's2')
      expect(failed?.status).toBe('failed')
      const ok = run.stepResults.find((r) => r.stepId === 's1')
      expect(ok?.status).toBe('success')
    })

    it('cancel_run 可取消运行', async () => {
      const created = parseResult(
        await server.callTool('create_workflow', {
          name: '取消',
          steps: [{ id: 's1', type: 'delay', ms: 5000 }],
        }),
      ) as { id: string }

      const started = parseResult(
        await server.callTool('run_workflow', { workflowId: created.id }),
      ) as { runId: string }

      const cancelled = parseResult(
        await server.callTool('cancel_run', { runId: started.runId }),
      ) as { cancelled: boolean; status: string }
      expect(cancelled.cancelled).toBe(true)
      expect(cancelled.status).toBe('cancelled')
    })
  })

  describe('调度与触发器元数据', () => {
    it('schedule_workflow 应返回调度定义', async () => {
      const created = parseResult(
        await server.callTool('create_workflow', { name: '调度', steps: [{ id: 's1', type: 'note' }] }),
      ) as { id: string }

      const scheduled = parseResult(
        await server.callTool('schedule_workflow', {
          workflowId: created.id,
          every: { unit: 'seconds', value: 1 },
        }),
      ) as { id: string; workflowId: string; nextRunAt: number }
      expect(scheduled.id).toBeTruthy()
      expect(scheduled.workflowId).toBe(created.id)
      expect(scheduled.nextRunAt).toBeGreaterThan(0)

      // 清理定时器，避免泄漏
      await server.callTool('remove_schedule', { scheduleId: scheduled.id })
    })

    it('register_trigger 应返回触发器定义', async () => {
      const created = parseResult(
        await server.callTool('create_workflow', { name: '触发', steps: [{ id: 's1', type: 'note' }] }),
      ) as { id: string }

      const trig = parseResult(
        await server.callTool('register_trigger', { workflowId: created.id, event: 'test:event' }),
      ) as { id: string; event: string; workflowId: string }
      expect(trig.id).toBeTruthy()
      expect(trig.event).toBe('test:event')
      expect(trig.workflowId).toBe(created.id)

      await server.callTool('remove_trigger', { triggerId: trig.id })
    })
  })

  describe('Resources', () => {
    it('workflow://defs 应返回 JSON', async () => {
      const res = await server.readResource('workflow://defs')
      expect(res.mimeType).toBe('application/json')
      expect(() => JSON.parse(res.text ?? '')).not.toThrow()
    })

    it('workflow://{runId}/run 查询不存在应返回错误 JSON', async () => {
      const res = await server.readResource('workflow://missing/run')
      const data = JSON.parse(res.text ?? '{}')
      expect(data.error).toContain('missing')
    })
  })
})
