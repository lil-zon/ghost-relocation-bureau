import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { StoreProvider } from './state/StoreProvider'
import { ErrorBoundary } from './ui/ErrorBoundary'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Не найден корневой элемент #root — проверьте index.html.')
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
)
