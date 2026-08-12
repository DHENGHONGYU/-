/**
 * @test_id V9-TEST-UT-058
 * @covers_docs [V9-DOC-AI-006, V9-DOC-AI-003, V9-DOC-AI-002, V9-DOC-AI-014]
 */
import { describe, expect, it } from 'vitest'
import { eventBus } from '@/lib/eventBus'
import { destroyPageSubscriptions, initPageSubscriptions } from '@/store/pageStore'
import { destroyAgentSubscriptions, initAgentSubscriptions } from '@/store/agentStore'

describe('Store eventBus subscriptions cleanup (DF-003)', () => {
  it('应该cancel all store subscriptions and leave eventBus with zero listeners', () => {
    expect(eventBus.getStats().totalListeners).toBeGreaterThan(0)

    destroyPageSubscriptions()
    destroyAgentSubscriptions()

    expect(eventBus.getStats().totalListeners).toBe(0)

    // Restore subscriptions so other test files are not affected.
    initPageSubscriptions()
    initAgentSubscriptions()
  })
})
