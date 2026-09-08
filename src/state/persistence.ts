import type { BureauState } from '../domain/types'

const STORAGE_KEY = 'ghost-relocation-bureau'
const SCHEMA_VERSION = 1

interface StoredPayload {
  version: number
  bureau: BureauState
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; bureau: BureauState }
  | { kind: 'error'; message: string }

function isBureauState(value: unknown): value is BureauState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BureauState>
  if (!Array.isArray(candidate.ghosts) || !Array.isArray(candidate.locations)) return false
  return (
    candidate.ghosts.every((ghost) => typeof ghost?.id === 'string' && typeof ghost?.name === 'string') &&
    candidate.locations.every(
      (location) =>
        typeof location?.id === 'string' && typeof location?.capacity === 'number',
    )
  )
}

/**
 * Чтение сохранённого состояния. Повреждённые данные не приводят к падению
 * приложения: возвращается конкретное сообщение, а оператор получает выбор.
 */
export function loadState(): LoadResult {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return {
      kind: 'error',
      message: 'Браузер запретил доступ к локальному хранилищу — работа продолжится без сохранения.',
    }
  }

  if (raw === null) return { kind: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      kind: 'error',
      message: 'Сохранённые данные бюро повреждены и не читаются как JSON. Загрузите демо-набор заново.',
    }
  }

  const payload = parsed as Partial<StoredPayload>
  if (payload?.version !== SCHEMA_VERSION) {
    return {
      kind: 'error',
      message: `Сохранённые данные относятся к другой версии схемы (${String(payload?.version)} вместо ${SCHEMA_VERSION}). Загрузите демо-набор заново.`,
    }
  }

  if (!isBureauState(payload.bureau)) {
    return {
      kind: 'error',
      message: 'В сохранённых данных отсутствуют заявки или места. Загрузите демо-набор заново.',
    }
  }

  return { kind: 'loaded', bureau: payload.bureau }
}

/** Возвращает сообщение об ошибке, если сохранить не удалось. */
export function saveState(bureau: BureauState): string | null {
  try {
    const payload: StoredPayload = { version: SCHEMA_VERSION, bureau }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return null
  } catch {
    return 'Не удалось сохранить состояние в браузере: изменения будут потеряны при перезагрузке.'
  }
}

export function clearStoredState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Очистка хранилища не критична для работы приложения.
  }
}
