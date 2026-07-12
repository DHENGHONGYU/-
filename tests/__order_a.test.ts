import { describe, it, expect, vi } from 'vitest'
vi.mock('@/constants/theme.tokens', () => ({ COLOR_TOKENS: { marker: 'A' } }))
import { COLOR_TOKENS } from '@/constants/theme.tokens'
describe('orderA', () => {
  it('sees A', () => {
    expect((COLOR_TOKENS as unknown as { marker: string }).marker).toBe('A')
  })
})
