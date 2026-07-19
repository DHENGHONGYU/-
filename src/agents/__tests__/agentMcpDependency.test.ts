/**
 * @test_id V9-TEST-ST-001
 * Agent → MCP 依赖不变量校验专项测试（F5 整改验证）
 *
 * 验证：启动期每个 Agent 依赖的 MCP Server 必须已注册且启用，
 * validateAgentMcpDependencies() 正确报告缺失/禁用依赖。
  * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-007, V9-DOC-AI-002, V9-DOC-AI-005]
*/
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@/mcp/register'
import { initAgentSystem, shutdownAgentSystem, validateAgentMcpDependencies } from '@/agents'

describe('Agent MCP dependency invariant (F5)', () => {
  beforeAll(() => {
    initAgentSystem()
  })

  afterAll(() => {
    shutdownAgentSystem()
  })

  it('默认 Agent 依赖的 MCP Server 全部已注册且启用', () => {
    expect(validateAgentMcpDependencies()).toEqual([])
  })
})
