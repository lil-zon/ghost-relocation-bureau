import { assign, markUnplaced, unassign } from './assignment'
import { classifyUnplaced, explainNoMatch, findBestMatch, type NoMatchExplanation } from './matching'
import { sortByPriority, type GhostPriority } from './priority'
import type { BureauState, MatchResult } from './types'

export interface GlobalAssignmentEntry {
  ghostId: string
  priority: GhostPriority
  /** Назначенное место или null, если места не нашлось. */
  match: MatchResult | null
  /** Почему места не нашлось; null, если заявка размещена. */
  unplacedReason: 'awaiting_capacity' | 'unassignable' | null
  /** Разбор ситуации «места нет»: корневые причины и ближайшие варианты. */
  explanation: NoMatchExplanation | null
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
 * Пересчитываются решения системы — как принятые ею самой (`auto`), так и
 * подтверждённые оператором (`accepted`): место в обоих случаях выбрала система.
 * Нетронутыми остаются только собственные решения оператора (`manual`).
 */
export function assignAll(state: BureauState, now: Date): GlobalAssignmentResult {
  // 1. Освобождаем места, занятые по решению системы на прошлом прогоне.
  let working: BureauState = state
  for (const ghost of state.ghosts) {
    if (ghost.assignmentSource === 'auto' || ghost.assignmentSource === 'accepted') {
      working = unassign(working, ghost.id)
    }
  }
  working = {
    ...working,
    ghosts: working.ghosts.map((ghost) =>
      ghost.status === 'unassignable' || ghost.status === 'awaiting_capacity'
        ? { ...ghost, status: 'pending' }
        : ghost,
    ),
  }

  const manual = working.ghosts.filter((ghost) => ghost.assignmentSource === 'manual')
  const queue = working.ghosts.filter((ghost) => ghost.assignmentSource !== 'manual')

  // 2. Приоритет считается один раз на исходном состоянии, чтобы порядок обработки
  //    не зависел от уже сделанных на этом же прогоне назначений.
  const ordered = sortByPriority(queue, working.locations, now)

  const entries: GlobalAssignmentEntry[] = []

  function recordFailure(ghostId: string, priority: GhostPriority): void {
    const current = working.ghosts.find((item) => item.id === ghostId)!
    const reason = classifyUnplaced(current, working.locations, now)
    working = markUnplaced(working, ghostId, reason)
    entries.push({
      ghostId,
      priority,
      match: null,
      unplacedReason: reason,
      explanation: explainNoMatch(current, working.locations, now),
      skippedManual: false,
    })
  }

  for (const { ghost, priority } of ordered) {
    // 3. Каждая следующая заявка видит актуальную занятость мест.
    const current = working.ghosts.find((item) => item.id === ghost.id)!
    const best = findBestMatch(current, working.locations, now)

    if (!best) {
      recordFailure(ghost.id, priority)
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
      recordFailure(ghost.id, priority)
      continue
    }

    working = outcome.state
    entries.push({
      ghostId: ghost.id,
      priority,
      match: best,
      unplacedReason: null,
      explanation: null,
      skippedManual: false,
    })
  }

  for (const ghost of manual) {
    entries.push({
      ghostId: ghost.id,
      priority: sortByPriority([ghost], working.locations, now)[0].priority,
      match: null,
      unplacedReason: null,
      explanation: null,
      skippedManual: true,
    })
  }

  return { state: working, entries }
}
