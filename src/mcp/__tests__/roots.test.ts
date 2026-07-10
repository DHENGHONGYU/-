import { describe, it, expect, beforeEach } from 'vitest'
import { RootsManager } from '@/mcp/core/roots'

describe('RootsManager', () => {
  let manager: RootsManager

  beforeEach(() => {
    manager = new RootsManager()
  })

  it('应该设置 and list roots', () => {
    manager.setRoots([
      { uri: 'file:///workspace', name: 'workspace' },
      { uri: 'file:///data', name: 'data' },
    ])
    const result = manager.listRoots()
    expect(result.roots).toHaveLength(2)
    expect(result.roots[0]!.uri).toBe('file:///workspace')
    expect(result.roots[1]!.uri).toBe('file:///data')
  })

  it('应该add a single root', () => {
    manager.addRoot({ uri: 'file:///workspace', name: 'workspace' })
    expect(manager.listRoots().roots).toHaveLength(1)
  })

  it('不应该 add duplicate root', () => {
    manager.addRoot({ uri: 'file:///workspace', name: 'workspace' })
    manager.addRoot({ uri: 'file:///workspace', name: 'duplicate' })
    expect(manager.listRoots().roots).toHaveLength(1)
  })

  it('应该remove a root', () => {
    manager.addRoot({ uri: 'file:///workspace', name: 'workspace' })
    const removed = manager.removeRoot('file:///workspace')
    expect(removed).toBe(true)
    expect(manager.listRoots().roots).toHaveLength(0)
  })

  it('应该返回 false when removing non-existent root', () => {
    const removed = manager.removeRoot('file:///nonexistent')
    expect(removed).toBe(false)
  })

  it('应该允许 all URIs when no roots configured', () => {
    expect(manager.isAllowed('file:///any/path')).toBe(true)
  })

  it('应该block URIs outside root scope', () => {
    manager.addRoot({ uri: 'file:///workspace', name: 'workspace' })
    expect(manager.isAllowed('file:///workspace/project')).toBe(true)
    expect(manager.isAllowed('file:///outside')).toBe(false)
  })
})