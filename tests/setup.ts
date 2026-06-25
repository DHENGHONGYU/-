import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 为每个测试文件生成独立的 IndexedDB 名称，避免并行运行时的状态污染与事务竞争
process.env.TEST_DB_NAME = `V6ProDB-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// 每个测试后清理 React 渲染树，避免 DOM 残留与事件监听累积
afterEach(() => {
  cleanup()
})
