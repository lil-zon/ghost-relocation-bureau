import { assign, markUnassignable, unassign } from './assignment'
import { closestAlternatives, findBestMatch } from './matching'
import { sortByPriority, type GhostPriority } from './priority'
import type { BureauState, MatchResult } from './types'

export interface GlobalAssignmentEntry {
  ghostId: string
  priority: GhostPriority
  /** Назначенное место или null, если подходящего места не нашлось. */
  match: MatchResult | null
  /** Ближайшие непригодные варианты — показываются, когда переселение невозможно. */
  alternatives: MatchResult[]
  /** Заявка не участвовала в распределении: место закреплено оператором вручную. */
  skippedManual: boolean
}

export interface GlobalAssignmentResult {
  state: BureauState
  entries: GlobalAssignmentEntry[]
}

/**
 * Глобальное распределение мест.
 *
 * Нельзя посчитать лучший вариант для каждой заявки независимо, а потом
 * обнаружить переполнение. Поэтому места занимаются последовательно, и после
 * каждого назначения следующая заявка видит уже изменившуюся вместимость.
 *
 * Ручные назначения оператора считаются решением человека и сохраняются:
 * пересчитываются только автоматические.
 */
export function assignAll(state: BureauState, now: Date): GlobalAssignmentResult {
  // 1. Освобождаем места, занятые предыдущим автоматическим прогоном.
  let working: BureauState = state
  for (const ghost of state.ghosts) {
    if (ghost.assignmentSource === 'auto') {
      working = unassign(working, ghost.id)
    }
  }
  working = {
    ...working,
    ghosts: working.ghosts.map((ghost) =>
      ghost.status === 'unassignable' ? { ...ghost, status: 'pending' } : ghost,
    ),
  }

  const manual = working.ghosts.filter((ghost) => ghost.assignmentSource === 'manual')
  const queue = working.ghosts.filter((ghost) => ghost.assignmentSource !== 'manual')

  // 2. Приоритет считается один раз на исходном состоянии, чтобы порядок обработки
  //    не зависел от уже сделанных на этом же прогоне назначений.
  const ordered = sortByPriority(queue, working.locations, now)

  const entries: GlobalAssignmentEntry[] = []

  for (const { ghost, priority } of ordered) {
    // 3. Каждая следующая заявка видит актуальную занятость мест.
    const current = working.ghosts.find((item) => item.id === ghost.id)!
    const best = findBestMatch(current, working.locations, now)

    if (!best) {
      working = markUnassignable(working, ghost.id)
      entries.push({
        ghostId: ghost.id,
        priority,
        match: null,
        alternatives: closestAlternatives(current, working.locations, now),
        skippedManual: false,
      })
      continue
    }

    // Автоматическое распределение выбирает лучший из допустимых вариантов;
    // предупреждения не блокируют его, но сохраняются в результате для оператора.
    const outcome = assign(working, ghost.id, best.locationId, now, {
      source: 'auto',
      confirmed: true,
    })

    if (!outcome.ok) {
      // Доменный слой отклонил назначение — трактуем как «места нет».
      working = markUnassignable(working, ghost.id)
      entries.push({
        ghostId: ghost.id,
        priority,
        match: null,
        alternatives: closestAlternatives(current, working.locations, now),
        skippedManual: false,
      })
      continue
    }

    working = outcome.state
    entries.push({
      ghostId: ghost.id,
      priority,
      match: best,
      alternatives: [],
      skippedManual: false,
    })
  }

  for (const ghost of manual) {
    entries.push({
      ghostId: ghost.id,
      priority: sortByPriority([ghost], working.locations, now)[0].priority,
      match: null,
      alternatives: [],
      skippedManual: true,
    })
  }

  return { state: working, entries }
}
