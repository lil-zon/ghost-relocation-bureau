import type { BureauState, GhostRequest, RelocationLocation } from '../domain/types'

export const STORAGE_KEY = 'ghost-relocation-bureau'
/** Сюда переносится содержимое, которое не удалось прочитать, — чтобы не потерять его молча. */
export const BACKUP_KEY = 'ghost-relocation-bureau.corrupted-backup'
const SCHEMA_VERSION = 2

interface StoredPayload {
  version: number
  bureau: BureauState
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; bureau: BureauState }
  | { kind: 'error'; message: string }

function isGhost(value: unknown): value is GhostRequest {
  if (typeof value !== 'object' || value === null) return false
  const ghost = value as Partial<GhostRequest>
  return (
    typeof ghost.id === 'string' &&
    typeof ghost.name === 'string' &&
    typeof ghost.anxietyLevel === 'number' &&
    typeof ghost.preferredTemperature === 'number' &&
    typeof ghost.deadline === 'string' &&
    Array.isArray(ghost.specialConditions) &&
    ghost.specialConditions.every((condition) => typeof condition?.kind === 'string') &&
    typeof ghost.status === 'string' &&
    (ghost.assignedLocationId === null || typeof ghost.assignedLocationId === 'string')
  )
}

function isLocation(value: unknown): value is RelocationLocation {
  if (typeof value !== 'object' || value === null) return false
  const location = value as Partial<RelocationLocation>
  return (
    typeof location.id === 'string' &&
    typeof location.name === 'string' &&
    typeof location.capacity === 'number' &&
    typeof location.currentOccupancy === 'number' &&
    typeof location.temperature === 'number' &&
    typeof location.humidity === 'number' &&
    typeof location.lighting === 'string' &&
    typeof location.noise === 'string' &&
    typeof location.humansPresent === 'boolean' &&
    typeof location.hasAttic === 'boolean' &&
    typeof location.hasMirrors === 'boolean' &&
    Array.isArray(location.restrictions)
  )
}

/**
 * Проверка полная, а не выборочная: раньше валидировались только id, name и
 * capacity, поэтому частично испорченные данные проходили как корректные.
 */
function isBureauState(value: unknown): value is BureauState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BureauState>
  if (!Array.isArray(candidate.ghosts) || !Array.isArray(candidate.locations)) return false
  if (candidate.locations.length === 0) return false
  return candidate.ghosts.every(isGhost) && candidate.locations.every(isLocation)
}

/** Сохраняет нечитаемое содержимое в резервный ключ, чтобы его можно было восстановить вручную. */
function backupUnreadable(raw: string): boolean {
  try {
    window.localStorage.setItem(BACKUP_KEY, raw)
    return true
  } catch {
    return false
  }
}

function failure(raw: string, reason: string): LoadResult {
  const saved = backupUnreadable(raw)
  const tail = saved
    ? ' Прежнее содержимое не потеряно: оно отложено в резервную копию, её можно скачать или удалить в панели ниже.'
    : ' Сделать резервную копию не удалось: браузер отказал в записи, прежнее содержимое восстановить нельзя.'
  return { kind: 'error', message: `${reason}${tail}` }
}

/** Содержимое резервной копии, если она есть. */
export function readBackup(): string | null {
  try {
    return window.localStorage.getItem(BACKUP_KEY)
  } catch {
    return null
  }
}

export function clearBackup(): void {
  try {
    window.localStorage.removeItem(BACKUP_KEY)
  } catch {
    // Отсутствие доступа к хранилищу не мешает работе приложения.
  }
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
    return failure(raw, 'Сохранённые данные бюро повреждены и не читаются как JSON.')
  }

  const payload = parsed as Partial<StoredPayload>
  if (payload?.version !== SCHEMA_VERSION) {
    return failure(
      raw,
      `Сохранённые данные относятся к другой версии схемы (${String(payload?.version)} вместо ${SCHEMA_VERSION}).`,
    )
  }

  if (!isBureauState(payload.bureau)) {
    return failure(raw, 'В сохранённых данных повреждены заявки или места.')
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
