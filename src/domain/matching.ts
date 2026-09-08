import { blockingOnly, detectConflicts, freeSlots, hasBlocking } from './constraints'
import { scoreLocation } from './scoring'
import type { Conflict, GhostRequest, MatchResult, RelocationLocation } from './types'

/** Компонент считается сильной стороной места, начиная с этого соответствия. */
export const STRONG_FIT = 0.75

/**
 * Оценивает одно место для одной заявки.
 *
 * Порядок принципиален: сначала hard constraints, только потом score.
 * У несовместимого места `score` равен нулю — высокий балл не может
 * компенсировать блокирующий конфликт. Потенциальный балл при этом
 * остаётся в `breakdown.total`, чтобы показывать «ближайшие» альтернативы.
 */
export function evaluateMatch(
  ghost: GhostRequest,
  location: RelocationLocation,
  now: Date,
): MatchResult {
  const conflicts = detectConflicts(ghost, location, now)
  const compatible = !hasBlocking(conflicts)
  const breakdown = scoreLocation(ghost, location)

  return {
    ghostId: ghost.id,
    locationId: location.id,
    compatible,
    score: compatible ? breakdown.total : 0,
    breakdown,
    reasons: buildReasons(breakdown, location),
    conflicts,
  }
}

/**
 * Человекочитаемые причины строятся из того же breakdown, что и балл,
 * поэтому бизнес-правила не дублируются ради текста.
 */
function buildReasons(
  breakdown: ReturnType<typeof scoreLocation>,
  location: RelocationLocation,
): string[] {
  const reasons = breakdown.components
    .filter((component) => component.fit >= STRONG_FIT)
    .sort((a, b) => b.points - a.points)
    .map((component) => `${component.label.toLowerCase()}: ${component.detail}`)

  const free = freeSlots(location)
  if (free > 0) {
    reasons.push(`есть свободное место: занято ${location.currentOccupancy} из ${location.capacity}`)
  }

  return reasons
}

/**
 * Объяснение уже действующего назначения.
 *
 * Привидение само занимает одно место в своей локации, поэтому при повторной
 * проверке его нельзя считать «чужим» постояльцем — иначе заполненная под
 * завязку локация выглядела бы как конфликт для собственного жильца.
 */
export function explainExistingAssignment(
  ghost: GhostRequest,
  location: RelocationLocation,
  now: Date,
): MatchResult {
  const withoutSelf: RelocationLocation = {
    ...location,
    currentOccupancy: Math.max(0, location.currentOccupancy - 1),
  }
  const match = evaluateMatch(ghost, withoutSelf, now)
  // Причины показываем по фактической занятости места, а не по служебной копии.
  return { ...match, reasons: buildReasons(match.breakdown, location) }
}

export function evaluateAllLocations(
  ghost: GhostRequest,
  locations: RelocationLocation[],
  now: Date,
): MatchResult[] {
  return locations.map((location) => evaluateMatch(ghost, location, now))
}

/** Совместимые места, отсортированные от лучшего к худшему. */
export function rankCandidates(
  ghost: GhostRequest,
  locations: RelocationLocation[],
  now: Date,
): MatchResult[] {
  const byId = new Map(locations.map((location) => [location.id, location]))
  return evaluateAllLocations(ghost, locations, now)
    .filter((match) => match.compatible)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Детерминированный tie-break: сначала место с большим запасом, затем по id.
      const freeA = freeSlots(byId.get(a.locationId)!)
      const freeB = freeSlots(byId.get(b.locationId)!)
      if (freeB !== freeA) return freeB - freeA
      return a.locationId.localeCompare(b.locationId)
    })
}

/** Лучшее место или null, если ни одно место не проходит hard constraints. */
export function findBestMatch(
  ghost: GhostRequest,
  locations: RelocationLocation[],
  now: Date,
): MatchResult | null {
  return rankCandidates(ghost, locations, now)[0] ?? null
}

/**
 * Ближайшие непригодные варианты для случая «переселение невозможно»:
 * сначала те, где меньше блокирующих причин, затем с более высоким потенциальным баллом.
 */
export function closestAlternatives(
  ghost: GhostRequest,
  locations: RelocationLocation[],
  now: Date,
  limit = 3,
): MatchResult[] {
  return evaluateAllLocations(ghost, locations, now)
    .filter((match) => !match.compatible)
    .sort((a, b) => {
      const blockingA = blockingOnly(a.conflicts).length
      const blockingB = blockingOnly(b.conflicts).length
      if (blockingA !== blockingB) return blockingA - blockingB
      if (b.breakdown.total !== a.breakdown.total) return b.breakdown.total - a.breakdown.total
      return a.locationId.localeCompare(b.locationId)
    })
    .slice(0, limit)
}

/** Места, которые подошли бы заявке, если бы в них было свободное место. */
export function blockedOnlyByCapacity(
  ghost: GhostRequest,
  locations: RelocationLocation[],
  now: Date,
): MatchResult[] {
  return evaluateAllLocations(ghost, locations, now).filter((match) => {
    const blocking = blockingOnly(match.conflicts)
    return blocking.length === 1 && blocking[0].code === 'location_full'
  })
}

/**
 * Почему заявка осталась без места.
 *
 * `awaiting_capacity` — есть место, которому мешает только занятость: оператору
 * нужно дождаться или освободить его. `unassignable` — подходящего места не
 * существует в принципе: нужно менять условия заявки или реестр мест.
 */
export function classifyUnplaced(
  ghost: GhostRequest,
  locations: RelocationLocation[],
  now: Date,
): 'awaiting_capacity' | 'unassignable' {
  return blockedOnlyByCapacity(ghost, locations, now).length > 0
    ? 'awaiting_capacity'
    : 'unassignable'
}

export interface NoMatchExplanation {
  /** Причины, блокирующие все без исключения места, — корень проблемы. */
  sharedBlockers: Conflict[]
  /** Ближайшие варианты; общие причины из их списков убраны, чтобы не повторяться. */
  alternatives: MatchResult[]
  /** Места, которым мешает только занятость. */
  blockedByCapacity: MatchResult[]
}

/**
 * Разбор ситуации «места нет».
 *
 * Если одна и та же причина блокирует все места (например, истёкший срок), она
 * выносится в корень и убирается из карточек вариантов: иначе оператор видит
 * четыре копии одного текста, а порядок вариантов определяется этой же общей
 * причиной, а не тем, насколько вариант близок.
 */
export function explainNoMatch(
  ghost: GhostRequest,
  locations: RelocationLocation[],
  now: Date,
  limit = 4,
): NoMatchExplanation {
  const incompatible = evaluateAllLocations(ghost, locations, now).filter(
    (match) => !match.compatible,
  )

  if (incompatible.length === 0) {
    return { sharedBlockers: [], alternatives: [], blockedByCapacity: [] }
  }

  const blockingByMatch = incompatible.map((match) => blockingOnly(match.conflicts))
  const sharedCodes = blockingByMatch[0]
    .map((conflict) => conflict.code)
    .filter((code) => blockingByMatch.every((list) => list.some((item) => item.code === code)))

  const sharedBlockers = blockingByMatch[0].filter((conflict) =>
    sharedCodes.includes(conflict.code),
  )

  const alternatives = incompatible
    .map((match) => ({
      ...match,
      conflicts: match.conflicts.filter(
        (conflict) => conflict.severity !== 'blocking' || !sharedCodes.includes(conflict.code),
      ),
    }))
    .sort((a, b) => {
      const blockingA = blockingOnly(a.conflicts).length
      const blockingB = blockingOnly(b.conflicts).length
      if (blockingA !== blockingB) return blockingA - blockingB
      if (b.breakdown.total !== a.breakdown.total) return b.breakdown.total - a.breakdown.total
      return a.locationId.localeCompare(b.locationId)
    })
    .slice(0, limit)

  return {
    sharedBlockers,
    alternatives,
    blockedByCapacity: blockedOnlyByCapacity(ghost, locations, now),
  }
}
