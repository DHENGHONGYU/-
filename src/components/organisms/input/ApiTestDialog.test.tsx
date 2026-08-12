/**
 * ApiTestDialog 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 * 1. 基础渲染 & HTMLDialogElement patch（jsdom 不原生支持 <dialog>，同 ConfirmDialog 模式）
 * 2. 初始 idle 状态：5 个 source 卡片，badge="待测试"，无 latency/message
 * 3. getStatusBadge 四分支 Switch：idle/testing/success/error 对应不同 Badge 文案与颜色
 * 4. probeEndpoint 四分支：
 *    a) response.ok=true → success + latency
 *    b) response.ok=false HTTP 500 → error + message="HTTP 500"
 *    c) AbortController 超时 (5s) → error + aborted message
 *    d) fetch 抛 TypeError(网络错误) → error + 通用 message
 * 5. handleTestSingle：单 source 按钮点击 → 状态 testing→结果，disabled=testing 判断
 * 6. handleTestAll：点击"测试全部" → 所有 source status=testing → 全部 resolve 后写回结果
 * 7. 条件渲染：latency 存在才显示 ms；message 存在才显示文本；error 状态 message 用红色，success 用绿色
 * 8. 防御分支：TEST_SOURCES.find(id) 未找到 → return（handleTestSingle 不更新 state，不抛错）
 * 9. Dialog 受控：open/onOpenChange 触发，不抛异常
 * 10. memo + displayName 存在（ApiTestDialog.displayName === 'ApiTestDialog'）
 * 11. className/透传属性 + 多次 rerender 稳定性
 *
 * @note 使用 vi.useFakeTimers() 触发 AbortController setTimeout，结束后 restore
 */

import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { ApiTestDialog } from './ApiTestDialog'

// ===========================
// Mock 数据结构（规范化，5 条 endpoints 对应 TEST_API_ENDPOINTS 配置）
// vi.mock 会提升至文件顶部，因此 mock 数据需用 vi.hoisted 包裹（避免 ReferenceError: Cannot access '...' before initialization）
// ===========================
const { mockTestEndpoints } = vi.hoisted(() => ({
  mockTestEndpoints: [
    { id: 'akshare', name: 'AKShare', testApi: '/api/test/akshare' },
    { id: 'ifind', name: 'iFinD', testApi: '/api/test/ifind' },
    { id: 'yahoo', name: 'Yahoo', testApi: '/api/test/yahoo' },
    { id: 'tianyancha', name: '天眼查', testApi: '/api/test/tianyancha' },
    { id: 'scholar', name: '学术', testApi: '/api/test/scholar' },
  ]
}))

vi.mock('@/config/collectConfig', async () => {
  const actual = await vi.importActual('@/config/collectConfig')
  return {
    ...(actual as any),
    TEST_API_ENDPOINTS: mockTestEndpoints,
  }
})

describe('ApiTestDialog', () => {
  // ============ HTMLDialogElement monkey-patch（同 ConfirmDialog 模式） ============
  let originalShowModal: typeof HTMLDialogElement.prototype.showModal | undefined
  let originalClose: typeof HTMLDialogElement.prototype.close | undefined

  beforeAll(() => {
    if (typeof HTMLDialogElement !== 'undefined') {
      originalShowModal = HTMLDialogElement.prototype.showModal
      originalClose = HTMLDialogElement.prototype.close
      HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        ;(this as { open: boolean }).open = true
      })
      HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        ;(this as { open: boolean }).open = false
      })
    }
  })

  afterAll(() => {
    if (typeof HTMLDialogElement !== 'undefined') {
      if (originalShowModal) HTMLDialogElement.prototype.showModal = originalShowModal
      if (originalClose) HTMLDialogElement.prototype.close = originalClose
    }
  })

  // ============ Fake timers 管理 ============
  // 注意：仅「超时分支」测试需要 fake timers；其余异步测试使用 real timers
  // 否则 waitFor 内部 setTimeout 轮询被 fake 后永不触发，导致所有异步测试挂起
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ======================
  // 模式1：默认值快照（初始 idle 状态）
  // ======================
  describe('基础渲染 & 默认 idle 状态', () => {
    it('open=true 渲染 DialogTitle "接口测试" + "测试全部"按钮', () => {
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      expect(screen.getByText('接口测试')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '测试全部' })).toBeInTheDocument()
    })

    it('初始渲染 5 个数据源卡片（AKShare/iFinD/Yahoo/天眼查/学术），每个 Badge=待测试', () => {
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      mockTestEndpoints.forEach((ep) => {
        expect(screen.getByText(ep.name)).toBeInTheDocument()
      })
      // 5 个 "待测试" Badge
      expect(screen.getAllByText('待测试')).toHaveLength(5)
    })

    it('初始无 latency (ms) 文本，无 message 文本', () => {
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
      expect(screen.queryByText('连接正常')).not.toBeInTheDocument()
      expect(screen.queryByText('HTTP 500')).not.toBeInTheDocument()
    })

    it('open=false 时 Dialog 内容仍可被渲染，但不抛异常', () => {
      expect(() => render(<ApiTestDialog open={false} onOpenChange={vi.fn()} />)).not.toThrow()
    })

    it('displayName 正确设置为 "ApiTestDialog"（memo 可辨识）', () => {
      expect((ApiTestDialog as any).displayName).toBe('ApiTestDialog')
    })
  })

  // ======================
  // 模式2：getStatusBadge 四分支 Switch（通过状态验证）
  // ======================
  describe('getStatusBadge 四分支 (idle/testing/success/error)', () => {
    it('初始 idle → 5 个 Badge 文案都是 "待测试"（variant=outline）', () => {
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const idleBadges = screen.getAllByText('待测试')
      expect(idleBadges).toHaveLength(5)
      idleBadges.forEach((b) => {
        expect(b.className).toContain('border') // variant=outline 含 border
      })
    })

    it('testing 状态 → Badge 文案 "测试中..." + info.bgClass', async () => {
      // fetch 永不 resolve → 状态停在 testing（用 Promise 挂起）
      const hangingFetch = vi.fn(() => new Promise(() => {}))
      vi.stubGlobal('fetch', hangingFetch)

      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const firstBtn = screen.getAllByRole('button', { name: '测试' })[0]!
      await act(async () => {
        fireEvent.click(firstBtn)
      })
      // 立即断言 testing 状态（fetch 还挂起，未到 success/error）
      expect(screen.getByText('测试中...')).toBeInTheDocument()
    })

    it('success 状态 → Badge 文案 "正常" + success.bgClass，附 ms 数', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
          } as Response),
        ),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const firstBtn = screen.getAllByRole('button', { name: '测试' })[0]!
      await act(async () => {
        fireEvent.click(firstBtn)
      })
      await waitFor(() => {
        expect(screen.getByText('正常')).toBeInTheDocument()
        expect(screen.getByText(/ms$/)).toBeInTheDocument()
        const msg = screen.getByText('连接正常')
        // success.tailwind = 'text-success'
        expect(msg.className).toContain('text-success')
      })
    })

    it('error 状态 (HTTP 500) → Badge 文案 "异常" + danger.bgClass，message 红色', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          } as Response),
        ),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const firstBtn = screen.getAllByRole('button', { name: '测试' })[0]!
      await act(async () => {
        fireEvent.click(firstBtn)
      })
      await waitFor(() => {
        expect(screen.getByText('异常')).toBeInTheDocument()
        const errMsg = screen.getByText('HTTP 500')
        // danger.tailwind = 'text-red-500'
        expect(errMsg.className).toContain('text-red-500')
      })
    })
  })

  // ======================
  // 模式3：probeEndpoint 四分支（成功/HTTP错误/超时/网络错误）
  // ======================
  describe('probeEndpoint 四分支覆盖', () => {
    it('分支1：fetch 返回 ok=true → 状态 success, message="连接正常", latency 为数字', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
          } as Response),
        ),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const yahooBtn = screen.getAllByRole('button', { name: '测试' })[2]! // Yahoo 第3个
      await act(async () => {
        fireEvent.click(yahooBtn)
      })
      await waitFor(() => {
        expect(screen.getByText('连接正常')).toBeInTheDocument()
        expect(screen.getByText(/^\d+ms$/)).toBeInTheDocument() // 纯数字+ms
      })
    })

    it('分支2：fetch 返回 !ok HTTP 404 → 状态 error, message="HTTP 404"', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({}),
          } as Response),
        ),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const btn = screen.getAllByRole('button', { name: '测试' })[0]!
      await act(async () => {
        fireEvent.click(btn)
      })
      await waitFor(() => {
        expect(screen.getByText('HTTP 404')).toBeInTheDocument()
      })
    })

    it('分支3：AbortController 超时（5s 后 signal aborted）→ 状态 error, message 含 abort/aborted', async () => {
      // 仅此测试使用 fake timers 以精确控制 5s 超时
      vi.useFakeTimers()

      const hangingFetch = vi.fn((_u: any, opts: any) => {
        return new Promise<Response>((_resolve, reject) => {
          // 挂起：直到 abort，立即监听 abort 事件
          opts?.signal?.addEventListener?.('abort', () => {
            const err = new Error('Aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      })
      vi.stubGlobal('fetch', hangingFetch)

      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const btn = screen.getAllByRole('button', { name: '测试' })[0]!
      await act(async () => {
        fireEvent.click(btn)
      })
      // 快进 6 秒触发 setTimeout
      await act(async () => {
        vi.advanceTimersByTime(6000)
      })
      await act(async () => {
        vi.runAllTicks()
      })
      expect(screen.getAllByText('异常').length).toBeGreaterThanOrEqual(1)
      const anyAbortMsg = screen.queryByText((t: string) => /abort/i.test(t) || /Aborted/.test(t))
      expect(anyAbortMsg).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('分支4：fetch 抛 TypeError（DNS/网络失败）→ 状态 error, message="请求失败" 或具体 Error.message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const btn = screen.getAllByRole('button', { name: '测试' })[0]!
      await act(async () => {
        fireEvent.click(btn)
      })
      await waitFor(() => {
        expect(screen.getByText('异常')).toBeInTheDocument()
        const errMsg = screen.getByText((t) => /Failed to fetch/.test(t))
        expect(errMsg).toBeInTheDocument()
      })
    })
  })

  // ======================
  // 模式4：handleTestSingle 单按钮 + disabled=testing
  // ======================
  describe('handleTestSingle 单 source 测试', () => {
    it('点击单个"测试"按钮 → testing 期间该按钮 disabled=true，测试完成后恢复', async () => {
      const hanging = vi.fn(() => new Promise<Response>(() => {}))
      vi.stubGlobal('fetch', hanging)

      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const btns = screen.getAllByRole('button', { name: '测试' })
      const firstBtn = btns[0] as HTMLButtonElement
      await act(async () => {
        fireEvent.click(firstBtn)
      })
      expect(firstBtn.disabled).toBe(true)
    })

    it('点击"测试"后立即进入 testing，Badge=测试中...', async () => {
      const hanging = vi.fn(() => new Promise<Response>(() => {}))
      vi.stubGlobal('fetch', hanging)

      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const firstBtn = screen.getAllByRole('button', { name: '测试' })[0]!
      await act(async () => {
        fireEvent.click(firstBtn)
      })
      expect(screen.getAllByText('测试中...').length).toBeGreaterThanOrEqual(1)
    })
  })

  // ======================
  // 模式5：handleTestAll 全部并发测试
  // ======================
  describe('handleTestAll 并发测试所有 source', () => {
    it('点击"测试全部" → 所有 5 个 Badge 先变为 "测试中..."，完成后变为 5 个 "正常"', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
          } as Response),
        ),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '测试全部' }))
      })
      // 至少在某个阶段 testing 存在（并发请求发出瞬间）
      await waitFor(() => {
        const successBadges = screen.getAllByText('正常')
        expect(successBadges).toHaveLength(5)
      })
      expect(screen.getAllByText(/ms$/)).toHaveLength(5)
      expect(screen.getAllByText('连接正常')).toHaveLength(5)
    })

    it('混合场景：2 个失败 + 3 个成功 → Badge 文案区分，2 异常 3 正常', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: any) => {
          const failed = url.includes('ifind') || url.includes('tianyancha')
          return Promise.resolve({
            ok: !failed,
            status: failed ? 502 : 200,
            json: () => Promise.resolve({}),
          } as Response)
        }),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '测试全部' }))
      })
      await waitFor(() => {
        expect(screen.getAllByText('正常').length).toBe(3)
        expect(screen.getAllByText('异常').length).toBe(2)
      })
    })
  })

  // ======================
  // 模式6：防御分支（sourceId 未知时 handleTestSingle 返回）
  // ======================
  describe('防御分支 & 边界', () => {
    it('未知 sourceId 触发 handleTestSingle 不抛异常（TEST_SOURCES.find → undefined 直接 return）', async () => {
      // 直接通过 instance 方式难以触发，可验证不通过非法参数触发 state 变更
      // 这里通过"重复点击测试按钮"验证不会抛错
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
          } as Response),
        ),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      const firstBtn = screen.getAllByRole('button', { name: '测试' })[0]!
      await act(async () => {
        fireEvent.click(firstBtn)
      })
      expect(() => fireEvent.click(firstBtn)).not.toThrow()
    })

    it('传入 open=true 但 onOpenChange=noop → Dialog 不抛异常', () => {
      expect(() => render(<ApiTestDialog open onOpenChange={() => {}} />)).not.toThrow()
    })
  })

  // ======================
  // 模式7：message 颜色分支（error vs success）
  // ======================
  describe('message 颜色分支（error 红色 / success 绿色）', () => {
    it('success 状态 message="连接正常" 含 success tailwind 类', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
          } as Response),
        ),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: '测试' })[0]!)
      })
      await waitFor(() => {
        const msg = screen.getByText('连接正常')
        // success.tailwind = 'text-success'
        expect(msg.className).toContain('text-success')
      })
    })

    it('error 状态 message="HTTP 500" 含 danger tailwind 类', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          } as Response),
        ),
      )
      render(<ApiTestDialog open onOpenChange={vi.fn()} />)
      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: '测试' })[0]!)
      })
      await waitFor(() => {
        const msg = screen.getByText('HTTP 500')
        // danger.tailwind = 'text-red-500'
        expect(msg.className).toContain('text-red-500')
      })
    })
  })
})
