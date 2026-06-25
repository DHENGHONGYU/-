import type { StandardEnvelope } from './envelope'

export interface FallbackQueueStats {
  length: number
}

export class FallbackQueue {
  private queue: StandardEnvelope[] = []

  push(envelope: StandardEnvelope): void {
    this.queue.push(envelope)
  }

  drain(): StandardEnvelope[] {
    const copy = [...this.queue]
    this.queue = []
    return copy
  }

  peek(): readonly StandardEnvelope[] {
    return this.queue
  }

  get length(): number {
    return this.queue.length
  }

  clear(): void {
    this.queue = []
  }
}

export const fallbackQueue = new FallbackQueue()
