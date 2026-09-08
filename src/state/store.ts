import { createDemoState, createEmptyState } from '../data/demoData'
import { assign, unassign } from '../domain/assignment'
import { assignAll, type GlobalAssignmentEntry } from '../domain/globalAssignment'
import { plural } from '../domain/plural'
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
  | { type: 'accept_recommendation'; ghostId: string; locationId: string }
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
        const waiting = result.entries.filter(
          (entry) => entry.unplacedReason === 'awaiting_capacity',
        ).length
        const impossible = result.entries.filter(
          (entry) => entry.unplacedReason === 'unassignable',
        ).length
        const manual = result.entries.filter((entry) => entry.skippedManual).length

        const parts = [`размещено ${placed}`]
        if (waiting > 0) parts.push(`ждут свободного места ${waiting}`)
        if (impossible > 0) parts.push(`переселение невозможно ${impossible}`)
        if (manual > 0) parts.push(`сохранено решений оператора ${manual}`)

        return {
          ...state,
          bureau: result.state,
          lastRun: result.entries,
          notice: {
            kind: waiting + impossible > 0 ? 'warning' : 'success',
            message: `Распределение выполнено: ${parts.join(', ')}.`,
          },
        }
      } catch (error) {
        return { ...state, notice: describeUnexpected(error, 'Сбой при автоматическом распределении') }
      }
    }

    case 'accept_recommendation': {
      try {
        // Место выбрала система — оператор лишь согласился, поэтому источник не `manual`.
        const outcome = assign(state.bureau, action.ghostId, action.locationId, state.now, {
          source: 'accepted',
          confirmed: true,
        })

        if (!outcome.ok) {
          return { ...state, notice: { kind: 'error', message: outcome.reason } }
        }

        const ghost = outcome.state.ghosts.find((item) => item.id === action.ghostId)
        const location = outcome.state.locations.find((item) => item.id === action.locationId)

        const warnings = outcome.validation.warnings.length

        return {
          ...state,
          bureau: outcome.state,
          notice: {
            kind: warnings > 0 ? 'warning' : 'success',
            message:
              warnings > 0
                ? `Рекомендация принята: заявка «${ghost?.name}» размещена в «${location?.name}» (балл ${outcome.validation.score}), ${plural(warnings, 'замечание', 'замечания', 'замечаний')} системы сохранено в карточке.`
                : `Рекомендация принята: заявка «${ghost?.name}» размещена в «${location?.name}» (балл ${outcome.validation.score}).`,
          },
        }
      } catch (error) {
        return { ...state, notice: describeUnexpected(error, 'Сбой при принятии рекомендации') }
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
              ? `Заявка «${ghost?.name}» размещена в «${location?.name}» с замечаниями (балл ${outcome.validation.score}).`
              : `Заявка «${ghost?.name}» размещена в «${location?.name}» (балл ${outcome.validation.score}).`,
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
