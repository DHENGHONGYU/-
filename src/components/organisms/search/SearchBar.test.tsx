/**
 * SearchBar 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：(organisms 层模式应用)
 *   模式1(默认值快照)：store keyword=''、placeholder、搜索按钮默认 variant
 *   模式3(事件回调)：onSearch 点击触发 / Enter 触发 / 不传 onSearch 不抛
 *   模式4(forwardRef/memo 等价)：store selector 多轮 rerender 不抛
 *   模式6(className 合并)：Input flex-1、外层 gap-2
 *   模式7(选择器)：queryByRole('searchbox' / 'button',{name:'搜索'})
 *   + Store mock 模式 (MultiFactorFilterPanel.test.tsx vi.hoisted 静态方法模板)
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from './SearchBar'

/**
 * Store mock：参考 MultiFactorFilterPanel.test.tsx 模式
 *  - vi.hoisted 静态提升
 *  - useStore selector 直接取 state 字段
 *  - 附带 getState / setState / subscribe 静态方法
 *  - setKeyword 被调用时**同步更新 state.keyword**（受控组件 value prop 变更后，后续 fireEvent.change 才能再次触发）
 */
const { useStore, keywordRef, setKeywordFn } = vi.hoisted(() => {
  const store = {
    keyword: '',
    setKeyword: vi.fn((k: string) => {
      store.keyword = k
    }),
  }
  const keywordRef = { get current() { return store.keyword }, set current(v) { store.keyword = v } }
  const setKeywordFn = store.setKeyword
  function useStore(selector?: (s: typeof store) => unknown) {
    if (typeof selector === 'function') return selector(store)
    return store
  }
  useStore.getState = () => store
  useStore.setState = (patch: Partial<typeof store> | ((s: typeof store) => Partial<typeof store>)) => {
    const next = typeof patch === 'function' ? patch(store) : patch
    Object.assign(store, next)
  }
  useStore.subscribe = vi.fn()
  return { useStore, keywordRef, setKeywordFn }
})

vi.mock('@/store/searchStore', () => ({
  useSearchStore: useStore,
}))

describe('SearchBar', () => {
  beforeEach(() => {
    // 每次用例前重置 store 状态
    useStore.setState({ keyword: '' })
    vi.clearAllMocks()
  })

  describe('基础渲染 (模式1:默认值快照)', () => {
    it('渲染搜索输入框(placeholder) + 搜索按钮', () => {
      render(<SearchBar />)
      expect(screen.getByPlaceholderText('搜索关键词、标的代码、文件名...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '搜索' })).toBeInTheDocument()
    })

    it('外层容器 className 包含 flex gap-2，Input 包含 flex-1', () => {
      const { container } = render(<SearchBar />)
      const root = container.firstElementChild as HTMLElement
      expect(root.className).toContain('flex')
      expect(root.className).toContain('gap-2')
      const input = screen.getByPlaceholderText('搜索关键词、标的代码、文件名...')
      expect(input.className).toContain('flex-1')
    })

    it('输入框 value = useSearchStore keyword (store selector)', () => {
      useStore.setState({ keyword: '贵州茅台' })
      render(<SearchBar />)
      const input = screen.getByPlaceholderText('搜索关键词、标的代码、文件名...') as HTMLInputElement
      expect(input.value).toBe('贵州茅台')
    })

    it('搜索按钮 variant=default (bg-surface-2 / not bg-primary, not border)', () => {
      render(<SearchBar />)
      const btn = screen.getByRole('button', { name: '搜索' })
      expect(btn.className).toContain('bg-surface-2')
      // default ≠ primary, default ≠ outline
      expect(btn.className).not.toContain('bg-primary')
      expect(btn.className).not.toContain('border-input')
    })
  })

  describe('输入 onChange 触发 setKeyword (模式3:事件回调)', () => {
    it('输入非空字符串 "平安银行" -> setKeyword 被调用 1 次，参数匹配', () => {
      // 保证初始值与输入值不同（受控组件：相同值时 React 可能不触发 onChange handler）
      useStore.setState({ keyword: '' })
      render(<SearchBar />)
      const input = screen.getByPlaceholderText('搜索关键词、标的代码、文件名...') as HTMLInputElement
      fireEvent.change(input, { target: { value: '平安银行' } })
      expect(setKeywordFn).toHaveBeenCalledTimes(1)
      expect(setKeywordFn).toHaveBeenLastCalledWith('平安银行')
    })

    it('输入值从非空字符串清空为空字符串 -> setKeyword 被调用 1 次，参数为空串', () => {
      // 初始 value != 目标值，才能保证 React 受控组件触发 onChange handler
      useStore.setState({ keyword: 'ABC' })
      render(<SearchBar />)
      const input = screen.getByPlaceholderText('搜索关键词、标的代码、文件名...') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      expect(setKeywordFn).toHaveBeenCalledTimes(1)
      expect(setKeywordFn).toHaveBeenLastCalledWith('')
    })
  })

  describe('点击搜索按钮触发 onSearch', () => {
    it('传 onSearch 时点击搜索按钮 -> onSearch 触发 1 次', () => {
      const onSearch = vi.fn()
      render(<SearchBar onSearch={onSearch} />)
      fireEvent.click(screen.getByRole('button', { name: '搜索' }))
      expect(onSearch).toHaveBeenCalledTimes(1)
    })

    it('不传 onSearch 时点击按钮不抛异常', () => {
      render(<SearchBar />)
      expect(() => fireEvent.click(screen.getByRole('button', { name: '搜索' }))).not.toThrow()
    })
  })

  describe('按 Enter 触发 onSearch', () => {
    it('在输入框按 Enter + 传 onSearch -> onSearch 被调用 1 次', () => {
      const onSearch = vi.fn()
      render(<SearchBar onSearch={onSearch} />)
      const input = screen.getByPlaceholderText('搜索关键词、标的代码、文件名...')
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSearch).toHaveBeenCalledTimes(1)
    })

    it('按 Enter 但未传 onSearch -> 不抛异常，不调用不存在函数', () => {
      render(<SearchBar />)
      const input = screen.getByPlaceholderText('搜索关键词、标的代码、文件名...')
      expect(() => fireEvent.keyDown(input, { key: 'Enter' })).not.toThrow()
    })

    it('按其他键(如 Escape) 不会触发 onSearch', () => {
      const onSearch = vi.fn()
      render(<SearchBar onSearch={onSearch} />)
      const input = screen.getByPlaceholderText('搜索关键词、标的代码、文件名...')
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onSearch).not.toHaveBeenCalled()
    })
  })

  describe('多轮 rerender 稳定性 (模式4 memo 等价)', () => {
    it('相同 props 两次 rerender 不抛异常，状态仍然同步', () => {
      const { rerender } = render(<SearchBar />)
      useStore.setState({ keyword: '600519' })
      rerender(<SearchBar />)
      const input = screen.getByPlaceholderText('搜索关键词、标的代码、文件名...') as HTMLInputElement
      expect(input.value).toBe('600519')
    })
  })
})
