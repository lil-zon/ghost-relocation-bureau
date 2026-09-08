import { createDemoState, createEmptyState } from '../data/demoData'
import { assign, unassign } from '../domain/assignment'
import { assignAll, type GlobalAssignmentEntry } from '../domain/globalAssignment'
import type { BureauState } from '../domain/types'

export type NoticeKind = 'error' | 'warning' | 'success' | 'info'

export interface Notice {
  kind: NoticeKind
  message: string
}

export interface AppState {
  bureau: BureauState
  /** Результат последнего автоматического распределения — источник объяснений в UI. */
  lastRun: GlobalAssignmentEntry[] | null
  selectedGhostId: string | null
  notice: Notice | null
  /** Момент времени, относительно которого считаются сроки. */
  now: Date
}

export type AppAction =
  | { type: 'assign_all' }
  | { type: 'manual_assign'; ghostId: string; locationId: string; confirmed?: boolean }
  | { type: 'unassign'; ghostId: string }
  | { type: 'load_demo' }
  | { type: 'clear_requests' }
  | { type: 'select_ghost'; ghostId: string | null }
  | { type: 'dismiss_notice' }
  | { type: 'notice'; notice: Notice }

export function createInitialState(now: Date, bureau?: BureauState): AppState {
  return {
    bureau: bureau ?? createDemoState(now),
    lastRun: null,
    selectedGhostId: null,
    notice: null,
    now,
  }
}

function describeUnexpected(error: unknown, context: string): Notice {
  const detail = error instanceof Error ? error.message : String(error)
  return { kind: 'error', message: `${context}: ${detail}` }
}

/**
 * Чистый reducer: вся бизнес-логика делегируется доменному слою,
 * здесь остаются только переходы состояния приложения и тексты для оператора.
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'assign_all': {
      if (state.bureau.ghosts.length === 0) {
        return {
          ...state,
          notice: { kind: 'info', message: 'В реестре нет заявок — распределять нечего.' },
        }
      }
      try {
        const result = assignAll(state.bureau, state.now)
        const placed = result.entries.filter((entry) => entry.match !== null).length
        const failed = result.entries.filter(
          (entry) => entry.match === null && !entry.skippedManual,
        ).length
        const manual = result.entries.filter((entry) => entry.skippedManual).length

        const parts = [`размещено ${placed}`]
        if (failed > 0) parts.push(`без места ${failed}`)
        if (manual > 0) parts.push(`сохранено ручных ${manual}`)

        return {
          ...state,
          bureau: result.state,
          lastRun: result.entries,
          notice: {
            kind: failed > 0 ? 'warning' : 'success',
            message: `Распределение выполнено: ${parts.join(', ')}.`,
          },
        }
      } catch (error) {
        return { ...state, notice: describeUnexpected(error, 'Сбой при автоматическом распределении') }
      }
    }

    case 'manual_assign': {
      try {
        const outcome = assign(state.bureau, action.ghostId, action.locationId, state.now, {
          source: 'manual',
          confirmed: action.confirmed,
        })

        if (!outcome.ok) {
          return { ...state, notice: { kind: 'error', message: outcome.reason } }
        }

        const ghost = outcome.state.ghosts.find((item) => item.id === action.ghostId)
        const location = outcome.state.locations.find((item) => item.id === action.locationId)
        const withWarnings = outcome.validation.warnings.length > 0

        return {
          ...state,
          bureau: outcome.state,
          notice: {
            kind: withWarnings ? 'warning' : 'success',
            message: withWarnings
              ? `«${ghost?.name}» размещён(а) в «${location?.name}» с предупреждениями (балл ${outcome.validation.score}).`
              : `«${ghost?.name}» размещён(а) в «${location?.name}» (балл ${outcome.validation.score}).`,
          },
        }
      } catch (error) {
        return { ...state, notice: describeUnexpected(error, 'Сбой при ручном назначении') }
      }
    }

    case 'unassign': {
      const ghost = state.bureau.ghosts.find((item) => item.id === action.ghostId)
      if (!ghost || ghost.assignedLocationId === null) {
        return {
          ...state,
          notice: { kind: 'info', message: 'У этой заявки сейчас нет назначенного места.' },
        }
      }
      return {
        ...state,
        bureau: unassign(state.bureau, action.ghostId),
        notice: { kind: 'info', message: `Место освобождено: «${ghost.name}» снова ждёт решения.` },
      }
    }

    case 'load_demo':
      return {
        ...createInitialState(state.now, createDemoState(state.now)),
        notice: { kind: 'success', message: 'Загружен демонстрационный набор: 8 заявок и 6 мест.' },
      }

    case 'clear_requests':
      return {
        ...createInitialState(state.now, createEmptyState()),
        notice: { kind: 'info', message: 'Реестр заявок очищен.' },
      }

    case 'select_ghost':
      return { ...state, selectedGhostId: action.ghostId }

    case 'dismiss_notice':
      return { ...state, notice: null }

    case 'notice':
      return { ...state, notice: action.notice }
  }
}
