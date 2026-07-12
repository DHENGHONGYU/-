import { describe, it, expect, vi } from 'vitest'
// 注意：本文件【不】mock theme.tokens，验证文件 A 的 mock 是否泄漏到本文件
import { COLOR_TOKENS } from '@/constants/theme.tokens'
describe('orderB', () => {
  it('does NOT see A (no leak)', () => {
    // 真实 COLOR_TOKENS 没有 marker 字段；若看到 'A' 说明文件 A 的 mock 泄漏
    expect((COLOR_TOKENS as unknown as { marker?: string }).marker).toBeUndefined()
  })
})
