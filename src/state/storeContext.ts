import { createContext, use, type Dispatch } from 'react'
import type { AppAction, AppState } from './store'

export interface StoreValue {
  state: AppState
  dispatch: Dispatch<AppAction>
}

export const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const value = use(StoreContext)
  if (!value) {
    throw new Error('useStore вызван вне StoreProvider — компонент должен быть внутри провайдера.')
  }
  return value
}
