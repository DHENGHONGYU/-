import { describe, it, expect, beforeEach } from 'vitest'
import { ProgressTracker } from '@/mcp/core/progress'

describe('ProgressTracker', () => {
  let tracker: ProgressTracker

  beforeEach(() => {
    tracker = new ProgressTracker()
  })

  it('should start tracking a task', () => {
    tracker.start('task-1', 100, 'Processing')
    const progress = tracker.getProgress('task-1')
    expect(progress).toBeDefined()
    expect(progress!.token).toBe('task-1')
    expect(progress!.total).toBe(100)
    expect(progress!.current).toBe(0)
    expect(progress!.message).toBe('Processing')
  })

  it('should update progress', () => {
    tracker.start('task-1', 100)
    tracker.update('task-1', 50, 'Half done')
    const progress = tracker.getProgress('task-1')
    expect(progress!.current).toBe(50)
    expect(progress!.message).toBe('Half done')
  })

  it('should not exceed total', () => {
    tracker.start('task-1', 100)
    tracker.update('task-1', 150)
    expect(tracker.getProgress('task-1')!.current).toBe(100)
  })

  it('should increment progress', () => {
    tracker.start('task-1', 100)
    tracker.increment('task-1', 25)
    expect(tracker.getProgress('task-1')!.current).toBe(25)
    tracker.increment('task-1', 25)
    expect(tracker.getProgress('task-1')!.current).toBe(50)
  })

  it('should complete and clean up', () => {
    tracker.start('task-1', 100)
    tracker.complete('task-1', 'All done')
    expect(tracker.getProgress('task-1')).toBeUndefined()
  })

  it('should return all active tracks', () => {
    tracker.start('task-1', 100)
    tracker.start('task-2', 200)
    const active = tracker.getAllActive()
    expect(active).toHaveLength(2)
  })

  it('should ignore updates for unknown tokens', () => {
    tracker.update('unknown', 50)
    expect(tracker.getProgress('unknown')).toBeUndefined()
  })

  it('should ignore increment for unknown tokens', () => {
    tracker.increment('unknown', 10)
    expect(tracker.getProgress('unknown')).toBeUndefined()
  })
})