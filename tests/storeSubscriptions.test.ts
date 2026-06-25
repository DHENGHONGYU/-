import { describe, expect, it } from 'vitest'
import { eventBus } from '@/lib/eventBus'
import {
  destroyDataflowSubscriptions,
  initDataflowSubscriptions,
} from '@/store/dataflowStore'
import { destroyPageSubscriptions, initPageSubscriptions } from '@/store/pageStore'
import { destroyWidgetSubscriptions, initWidgetSubscriptions } from '@/store/widgetStore'
import { destroyAgentSubscriptions, initAgentSubscriptions } from '@/store/agentStore'

describe('Store eventBus subscriptions cleanup (DF-003)', () => {
  it('should cancel all store subscriptions and leave eventBus with zero listeners', () => {
    expect(eventBus.getStats().totalListeners).toBeGreaterThan(0)

    destroyDataflowSubscriptions()
    destroyPageSubscriptions()
    destroyWidgetSubscriptions()
    destroyAgentSubscriptions()

    expect(eventBus.getStats().totalListeners).toBe(0)

    // Restore subscriptions so other test files are not affected.
    initDataflowSubscriptions()
    initPageSubscriptions()
    initWidgetSubscriptions()
    initAgentSubscriptions()
  })
})
