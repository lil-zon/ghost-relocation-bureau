import { daysUntilDeadline } from './dates'
import { rankCandidates } from './matching'
import type { GhostRequest, RelocationLocation } from './types'

/**
 * Приоритет заявки в глобальном распределении.
 *
 * Идея: заявка, у которой мало вариантов, должна выбирать раньше заявки,
 * которой подойдёт что угодно. Иначе простой случай займёт единственное
 * подходящее место более ограниченного случая.
 */

export const PRIORITY_WEIGHTS = { scarcity: 0.4, urgency: 0.35, anxiety: 0.25 } as const

/** Каждый день до дедлайна снижает срочность на столько пунктов. */
const URGENCY_DECAY_PER_DAY = 7
/** Каждый дополнительный подходящий вариант снижает дефицитность на столько пунктов. */
const SCARCITY_DECAY_PER_OPTION = 25

export interface GhostPriority {
  ghostId: string
  /** Итог 0..100. */
  total: number
  urgency: number
  anxiety: number
  scarcity: number
  /** Сколько мест сейчас проходят hard constraints. */
  compatibleCount: number
  explanation: string
}

function clamp100(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function computePriority(
  ghost: GhostRequest,
  locations: RelocationLocation[],
  now: Date,
): GhostPriority {
  const daysLeft = daysUntilDeadline(ghost.deadline, now)
  const urgency = daysLeft < 0 ? 100 : clamp100(100 - daysLeft * URGENCY_DECAY_PER_DAY)
  const anxiety = clamp100(ghost.anxietyLevel * 10)

  const compatibleCount = rankCandidates(ghost, locations, now).length
  const scarcity =
    compatibleCount === 0
      ? 100
      : clamp100(100 - (compatibleCount - 1) * SCARCITY_DECAY_PER_OPTION)

  const total = Math.round(
    PRIORITY_WEIGHTS.scarcity * scarcity +
      PRIORITY_WEIGHTS.urgency * urgency +
      PRIORITY_WEIGHTS.anxiety * anxiety,
  )

  const explanation = [
    `подходящих мест: ${compatibleCount}`,
    daysLeft < 0 ? 'срок просрочен' : `до срока ${daysLeft} дн.`,
    `тревожность ${ghost.anxietyLevel}/10`,
  ].join(', ')

  return { ghostId: ghost.id, total, urgency, anxiety, scarcity, compatibleCount, explanation }
}

/** Заявки в порядке обработки: сначала самые ограниченные и срочные. */
export function sortByPriority(
  ghosts: GhostRequest[],
  locations: RelocationLocation[],
  now: Date,
): Array<{ ghost: GhostRequest; priority: GhostPriority }> {
  return ghosts
    .map((ghost) => ({ ghost, priority: computePriority(ghost, locations, now) }))
    .sort((a, b) => {
      if (b.priority.total !== a.priority.total) return b.priority.total - a.priority.total
      return a.ghost.id.localeCompare(b.ghost.id)
    })
}
