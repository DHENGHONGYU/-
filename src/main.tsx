import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setLogLevel } from '@/lib/logger'
import App from './App'
import './index.css'

const LOG_LEVEL = (import.meta.env.VITE_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'

setLogLevel(LOG_LEVEL)

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
