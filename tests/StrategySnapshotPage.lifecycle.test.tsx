import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { useStrategySnapshotStore } from '@/store/strategySnapshotStore'
import StrategySnapshotPage from '@/pages/trading/StrategySnapshotPage'

const originalStore = useStrategySnapshotStore.getState()

function renderPage() {
  return render(
    <MemoryRouter>
      <StrategySnapshotPage />
    </MemoryRouter>,
  )
}

describe('StrategySnapshotPage - lifecycle & tri-state validation', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    dataBridge.invalidateCache(STORE_NAME.rotationScores)
    dataBridge.invalidateCache(STORE_NAME.strategySnapshots)
    useStrategySnapshotStore.setState({
      activeTab: 'current',
      stocks: [],
      v6Scores: [],
      rotationScores: [],
      items: { core: [], hot: [], value: [] },
      snapshots: [],
      selectedSnapshot: null,
      loading: false,
      saving: false,
      error: null,
      loadCurrentStrategy: originalStore.loadCurrentStrategy,
      loadHistorySnapshots: originalStore.loadHistorySnapshots,
    })
  })

  it('renders current and history tabs', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: /当前策略/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /历史快照/i })).toBeInTheDocument()
  })

  it('shows loading text while loading on current tab', () => {
    useStrategySnapshotStore.setState({ activeTab: 'current', loading: true })
    renderPage()
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('shows loading text while loading on history tab', () => {
    useStrategySnapshotStore.setState({ activeTab: 'history', loading: true })
    renderPage()
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('shows error alert with error text', async () => {
    useStrategySnapshotStore.setState({
      activeTab: 'history',
      error: '网络请求超时',
      loading: false,
      loadCurrentStrategy: vi.fn().mockResolvedValue(undefined),
      loadHistorySnapshots: vi.fn().mockResolvedValue(undefined),
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('网络请求超时')).toBeInTheDocument()
    })
  })

  it('shows empty state on history tab when no snapshots exist', async () => {
    useStrategySnapshotStore.setState({
      activeTab: 'history',
      snapshots: [],
      loading: false,
      error: null,
      loadCurrentStrategy: vi.fn().mockResolvedValue(undefined),
      loadHistorySnapshots: vi.fn().mockResolvedValue(undefined),
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('暂无历史快照')).toBeInTheDocument()
    })
  })

  it('handles rapid tab switching without race conditions', async () => {
    const user = userEvent.setup()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let currentResolve: (() => void) | null = null
    let historyResolve: (() => void) | null = null

    const mockLoadCurrent = vi.fn(
      () => new Promise<void>((resolve: () => void) => { currentResolve = resolve }),
    )
    const mockLoadHistory = vi.fn(
      () => new Promise<void>((resolve: () => void) => { historyResolve = resolve }),
    )

    useStrategySnapshotStore.setState({
      loadCurrentStrategy: mockLoadCurrent as any,
      loadHistorySnapshots: mockLoadHistory as any,
      loading: false,
      error: null,
    })

    renderPage()

    // Initial mount triggers loadCurrentStrategy
    expect(mockLoadCurrent).toHaveBeenCalledTimes(1)

    // Switch to history tab
    await user.click(screen.getByRole('tab', { name: /历史快照/i }))
    expect(mockLoadHistory).toHaveBeenCalledTimes(1)

    // Rapidly switch back to current tab
    await user.click(screen.getByRole('tab', { name: /当前策略/i }))
    expect(mockLoadCurrent).toHaveBeenCalledTimes(2)

    // Resolve all pending promises
    ;(currentResolve as unknown as (() => void))()
    ;(historyResolve as unknown as (() => void))()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /当前策略/i })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('cleans up pending requests on unmount without state update warnings', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let resolveFn: (() => void) | null = null
    const mockLoadCurrent = vi.fn(
      () => new Promise<void>((resolve: () => void) => { resolveFn = resolve }),
    )

    useStrategySnapshotStore.setState({
      loadCurrentStrategy: mockLoadCurrent as any,
      loading: false,
      error: null,
    })

    const { unmount } = renderPage()

    expect(mockLoadCurrent).toHaveBeenCalledTimes(1)

    unmount()

    // Resolve the pending promise after unmount
    ;(resolveFn as unknown as (() => void))()

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
