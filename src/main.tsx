import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setLogLevel } from '@/lib/logger'
import App from './App'
import { installGlobalErrorHandler } from '@/components/installGlobalErrorHandler'
import './index.css'
import './generated/tokens.css'

const LOG_LEVEL = (import.meta.env.VITE_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'

setLogLevel(LOG_LEVEL)

// 全局未捕获错误 / 未处理 Promise 拒绝统一上报到错误总线（A-03）
installGlobalErrorHandler()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
