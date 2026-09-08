import { daysUntilDeadline, formatDeadline, isDeadlineSoon, isOverdue } from './dates'
import type { Conflict, GhostRequest, RelocationLocation } from './types'
import { lightingLabel, noiseLabel } from './vocabulary'

/** Разница температур (°C), при которой выдаётся предупреждение. */
export const TEMPERATURE_WARNING_DELTA = 6
/** Начиная с этого уровня тревожность считается высокой. */
export const HIGH_ANXIETY_THRESHOLD = 7

export function freeSlots(location: RelocationLocation): number {
  return Math.max(0, location.capacity - location.currentOccupancy)
}

export function isFull(location: RelocationLocation): boolean {
  return location.currentOccupancy >= location.capacity
}

export function isHighAnxiety(ghost: GhostRequest): boolean {
  return ghost.anxietyLevel >= HIGH_ANXIETY_THRESHOLD
}

/**
 * Жёсткие ограничения. Проверяются ДО scoring: наличие хотя бы одного
 * blocking-конфликта делает место непригодным независимо от балла.
 */
export function detectBlockingConflicts(
  ghost: GhostRequest,
  location: RelocationLocation,
  now: Date,
): Conflict[] {
  const conflicts: Conflict[] = []

  if (isOverdue(ghost.deadline, now)) {
    conflicts.push({
      code: 'deadline_expired',
      severity: 'blocking',
      message: `Срок переселения истёк (${formatDeadline(ghost.deadline, now)}). Заявку нужно продлить у координатора бюро.`,
    })
  }

  if (isFull(location)) {
    conflicts.push({
      code: 'location_full',
      severity: 'blocking',
      message: `Место заполнено: занято ${location.currentOccupancy} из ${location.capacity}.`,
    })
  }

  for (const restriction of location.restrictions) {
    if (restriction.kind === 'no_new_residents') {
      conflicts.push({
        code: 'location_closed',
        severity: 'blocking',
        message: `Место закрыто для новых жильцов: ${restriction.reason}.`,
      })
    }
    if (restriction.kind === 'max_anxiety' && ghost.anxietyLevel > restriction.value) {
      conflicts.push({
        code: 'anxiety_above_limit',
        severity: 'blocking',
        message: `Место принимает привидений с тревожностью не выше ${restriction.value}, у заявки ${ghost.anxietyLevel}.`,
      })
    }
  }

  for (const condition of ghost.specialConditions) {
    switch (condition.kind) {
      case 'requires_attic':
        if (!location.hasAttic) {
          conflicts.push({
            code: 'attic_required',
            severity: 'blocking',
            message: 'По заявке нужен чердак, но в этом месте его нет.',
          })
        }
        break
      case 'avoids_mirrors':
        if (location.hasMirrors) {
          conflicts.push({
            code: 'mirrors_present',
            severity: 'blocking',
            message: 'В месте есть зеркала, а привидение их не переносит.',
          })
        }
        break
      case 'no_humans_nearby':
        if (location.humansPresent) {
          conflicts.push({
            code: 'humans_present',
            severity: 'blocking',
            message: 'В месте живут люди, а по условию заявки их рядом быть не должно.',
          })
        }
        break
      case 'min_humidity':
        if (location.humidity < condition.value) {
          conflicts.push({
            code: 'humidity_below_minimum',
            severity: 'blocking',
            message: `Влажность ${location.humidity}% ниже обязательного минимума ${condition.value}%.`,
          })
        }
        break
      case 'needs_low_light':
      case 'needs_quiet':
        break
    }
  }

  return conflicts
}

/**
 * Мягкие проблемы. Не запрещают назначение, но при ручном выборе требуют
 * явного подтверждения оператора.
 */
export function detectWarnings(
  ghost: GhostRequest,
  location: RelocationLocation,
  now: Date,
): Conflict[] {
  const conflicts: Conflict[] = []

  for (const condition of ghost.specialConditions) {
    if (
      condition.kind === 'needs_quiet' &&
      (location.noise === 'moderate' || location.noise === 'loud')
    ) {
      conflicts.push({
        code: 'noise_too_high',
        severity: 'warning',
        message: `Привидению нужна тишина, а в месте ${noiseLabel[location.noise]}.`,
      })
    }
    if (
      condition.kind === 'needs_low_light' &&
      (location.lighting === 'normal' || location.lighting === 'bright')
    ) {
      conflicts.push({
        code: 'light_too_bright',
        severity: 'warning',
        message: `Привидению нужен приглушённый свет, а в месте ${lightingLabel[location.lighting]}.`,
      })
    }
  }

  const requiresNoHumans = ghost.specialConditions.some((c) => c.kind === 'no_humans_nearby')
  if (location.humansPresent && isHighAnxiety(ghost) && !requiresNoHumans) {
    conflicts.push({
      code: 'humans_nearby_soft',
      severity: 'warning',
      message: `Рядом живут люди — при тревожности ${ghost.anxietyLevel}/10 это осложнит адаптацию.`,
    })
  }

  const delta = Math.abs(location.temperature - ghost.preferredTemperature)
  if (delta > TEMPERATURE_WARNING_DELTA) {
    conflicts.push({
      code: 'temperature_far',
      severity: 'warning',
      message: `Температура ${location.temperature}°C отличается от желаемых ${ghost.preferredTemperature}°C на ${delta}°C.`,
    })
  }

  if (isDeadlineSoon(ghost.deadline, now)) {
    const days = daysUntilDeadline(ghost.deadline, now)
    conflicts.push({
      code: 'deadline_soon',
      severity: 'warning',
      message:
        days === 0
          ? 'Срок переселения истекает сегодня — решение нужно принять сейчас.'
          : `Срок переселения близко: ${formatDeadline(ghost.deadline, now)}.`,
    })
  }

  return conflicts
}

export function detectConflicts(
  ghost: GhostRequest,
  location: RelocationLocation,
  now: Date,
): Conflict[] {
  return [
    ...detectBlockingConflicts(ghost, location, now),
    ...detectWarnings(ghost, location, now),
  ]
}

export function hasBlocking(conflicts: Conflict[]): boolean {
  return conflicts.some((conflict) => conflict.severity === 'blocking')
}

export function blockingOnly(conflicts: Conflict[]): Conflict[] {
  return conflicts.filter((conflict) => conflict.severity === 'blocking')
}

export function warningsOnly(conflicts: Conflict[]): Conflict[] {
  return conflicts.filter((conflict) => conflict.severity === 'warning')
}
