import { blockingOnly, detectConflicts, warningsOnly } from './constraints'
import { findBestMatch } from './matching'
import { scoreLocation } from './scoring'
import type {
  AssignmentRecord,
  AssignmentSource,
  BureauState,
  Conflict,
  GhostRequest,
  GhostStatus,
  MatchResult,
  RelocationLocation,
  ScoreBreakdown,
} from './types'

/** Насколько балл должен уступать рекомендации, чтобы оператор увидел предупреждение. */
export const WORSE_THAN_RECOMMENDED_GAP = 15

export interface AssignmentValidation {
  /** Нет блокирующих конфликтов. */
  valid: boolean
  conflicts: Conflict[]
  blocking: Conflict[]
  warnings: Conflict[]
  /** Назначение допустимо, но только после явного подтверждения оператора. */
  requiresConfirmation: boolean
  score: number
  breakdown: ScoreBreakdown
  /** Автоматическая рекомендация для этой же заявки — чтобы объяснить разницу. */
  recommended: MatchResult | null
}

export type AssignmentOutcome =
  | { ok: true; state: BureauState; validation: AssignmentValidation }
  | { ok: false; reason: string; validation: AssignmentValidation | null }

export function findGhost(state: BureauState, ghostId: string): GhostRequest | undefined {
  return state.ghosts.find((ghost) => ghost.id === ghostId)
}

export function findLocation(
  state: BureauState,
  locationId: string,
): RelocationLocation | undefined {
  return state.locations.find((location) => location.id === locationId)
}

/**
 * Место с исключённым текущим постояльцем: если привидение уже живёт здесь,
 * его собственное место не должно выглядеть как занятое кем-то другим.
 */
function locationWithoutGhost(
  location: RelocationLocation,
  ghost: GhostRequest,
): RelocationLocation {
  if (ghost.assignedLocationId !== location.id) return location
  return { ...location, currentOccupancy: Math.max(0, location.currentOccupancy - 1) }
}

/** Состояние, в котором текущее назначение заявки снято. */
function stateWithoutGhostAssignment(state: BureauState, ghost: GhostRequest): BureauState {
  return {
    ghosts: state.ghosts,
    locations: state.locations.map((location) => locationWithoutGhost(location, ghost)),
  }
}

/**
 * Единая проверка назначения. Через неё проходит и автоматическое,
 * и ручное назначение — UI не может обойти доменные правила.
 */
export function validateAssignment(
  state: BureauState,
  ghost: GhostRequest,
  location: RelocationLocation,
  now: Date,
): AssignmentValidation {
  const effectiveLocation = locationWithoutGhost(location, ghost)
  const conflicts = detectConflicts(ghost, effectiveLocation, now)
  const breakdown = scoreLocation(ghost, effectiveLocation)

  const released = stateWithoutGhostAssignment(state, ghost)
  const recommended = findBestMatch(ghost, released.locations, now)

  const blocking = blockingOnly(conflicts)
  const valid = blocking.length === 0
  const score = valid ? breakdown.total : 0

  const warnings = warningsOnly(conflicts)
  if (
    valid &&
    recommended &&
    recommended.locationId !== location.id &&
    recommended.score - score >= WORSE_THAN_RECOMMENDED_GAP
  ) {
    const recommendedLocation = findLocation(state, recommended.locationId)
    warnings.push({
      code: 'worse_than_recommended',
      severity: 'warning',
      message: `Система рекомендует «${recommendedLocation?.name ?? recommended.locationId}» с баллом ${recommended.score}; выбранное место набирает ${score}.`,
    })
  }

  return {
    valid,
    conflicts: [...blocking, ...warnings],
    blocking,
    warnings,
    requiresConfirmation: valid && warnings.length > 0,
    score,
    breakdown,
    recommended,
  }
}

/** Снимает назначение и освобождает место. Состояние обновляется immutable. */
export function unassign(state: BureauState, ghostId: string): BureauState {
  const ghost = findGhost(state, ghostId)
  if (!ghost || ghost.assignedLocationId === null) return state
  const releasedId = ghost.assignedLocationId

  return {
    ghosts: state.ghosts.map((item) =>
      item.id === ghostId
        ? {
            ...item,
            assignedLocationId: null,
            assignmentSource: null,
            assignmentRecord: null,
            status: 'pending',
          }
        : item,
    ),
    locations: state.locations.map((location) =>
      location.id === releasedId
        ? { ...location, currentOccupancy: Math.max(0, location.currentOccupancy - 1) }
        : location,
    ),
  }
}

interface AssignOptions {
  source: AssignmentSource
  /** Оператор явно подтвердил назначение с предупреждениями. */
  confirmed?: boolean
}

/**
 * Назначает место. Отклоняет назначение при блокирующем конфликте и при
 * неподтверждённых предупреждениях — независимо от того, что показывает UI.
 */
export function assign(
  state: BureauState,
  ghostId: string,
  locationId: string,
  now: Date,
  options: AssignOptions,
): AssignmentOutcome {
  const ghost = findGhost(state, ghostId)
  if (!ghost) {
    return { ok: false, reason: `Заявка ${ghostId} не найдена в текущем состоянии.`, validation: null }
  }
  const location = findLocation(state, locationId)
  if (!location) {
    return { ok: false, reason: `Место ${locationId} не найдено в текущем состоянии.`, validation: null }
  }

  const validation = validateAssignment(state, ghost, location, now)

  if (!validation.valid) {
    return {
      ok: false,
      reason: `Назначение отклонено: ${validation.blocking.map((conflict) => conflict.message).join(' ')}`,
      validation,
    }
  }

  if (validation.requiresConfirmation && options.confirmed !== true) {
    return {
      ok: false,
      reason: 'Назначение требует подтверждения оператора: есть предупреждения.',
      validation,
    }
  }

  // Что предлагала система в этот момент — сохраняем как след решения.
  const record: AssignmentRecord = {
    source: options.source,
    score: validation.score,
    recommendedLocationId: validation.recommended?.locationId ?? null,
    recommendedScore: validation.recommended?.score ?? 0,
    warnings: validation.warnings,
  }

  // Снимаем прежнее назначение, затем занимаем новое место.
  const released = unassign(state, ghostId)
  const next: BureauState = {
    ghosts: released.ghosts.map((item) =>
      item.id === ghostId
        ? {
            ...item,
            assignedLocationId: locationId,
            assignmentSource: options.source,
            assignmentRecord: record,
            status: 'assigned',
          }
        : item,
    ),
    locations: released.locations.map((item) =>
      item.id === locationId ? { ...item, currentOccupancy: item.currentOccupancy + 1 } : item,
    ),
  }

  assertCapacityInvariant(next)
  return { ok: true, state: next, validation }
}

/**
 * Помечает заявку как оставшуюся без места.
 * Статус различает «подходящее место занято» и «подходящего места не существует».
 */
export function markUnplaced(
  state: BureauState,
  ghostId: string,
  status: Extract<GhostStatus, 'awaiting_capacity' | 'unassignable'>,
): BureauState {
  const released = unassign(state, ghostId)
  return {
    ...released,
    ghosts: released.ghosts.map((ghost) =>
      ghost.id === ghostId
        ? {
            ...ghost,
            status,
            assignedLocationId: null,
            assignmentSource: null,
            assignmentRecord: null,
          }
        : ghost,
    ),
  }
}

/**
 * Главный инвариант вместимости. Нарушение означает ошибку в доменном слое,
 * поэтому падаем громко и с конкретным сообщением, а не молча портим данные.
 */
export function assertCapacityInvariant(state: BureauState): void {
  for (const location of state.locations) {
    if (location.currentOccupancy > location.capacity) {
      throw new Error(
        `Нарушена вместимость места «${location.name}»: занято ${location.currentOccupancy} при вместимости ${location.capacity}.`,
      )
    }
  }
}
