import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { BureauState } from '../domain/types'
import { loadState, saveState } from './persistence'
import { StoreContext } from './storeContext'
import { appReducer, createInitialState, type AppState } from './store'

interface StoreProviderProps {
  children: ReactNode
  /** Подменяется в тестах для детерминированных сроков. */
  now?: Date
  /** Начальный реестр; по умолчанию читается из localStorage. */
  initialBureau?: BureauState
  /** Отключает чтение и запись localStorage (используется в тестах). */
  persist?: boolean
}

function buildInitialState(now: Date, initialBureau?: BureauState, persist = true): AppState {
  if (initialBureau) return createInitialState(now, initialBureau)
  if (!persist) return createInitialState(now)

  const result = loadState()
  if (result.kind === 'loaded') return createInitialState(now, result.bureau)
  if (result.kind === 'error') {
    return {
      ...createInitialState(now),
      notice: { kind: 'error', message: `${result.message} Показан демонстрационный набор.` },
    }
  }
  return createInitialState(now)
}

export function StoreProvider({ children, now, initialBureau, persist = true }: StoreProviderProps) {
  const fixedNow = useMemo(() => now ?? new Date(), [now])
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    () => buildInitialState(fixedNow, initialBureau, persist),
  )

  useEffect(() => {
    if (!persist) return
    const failure = saveState(state.bureau)
    if (failure) {
      dispatch({ type: 'notice', notice: { kind: 'warning', message: failure } })
    }
  }, [state.bureau, persist])

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <StoreContext value={value}>{children}</StoreContext>
}
