import type {
  ConflictCode,
  LightingLevel,
  LocationRestriction,
  LocationType,
  NoiseLevel,
  SpecialCondition,
} from './types'
import { LIGHTING_LEVELS, NOISE_LEVELS } from './types'

/**
 * Человекочитаемые описания доменных значений.
 * Вынесено отдельно, чтобы UI не собирал тексты из технических кодов.
 */

export const lightingLabel: Record<LightingLevel, string> = {
  dark: 'темно',
  dim: 'полумрак',
  normal: 'обычное освещение',
  bright: 'ярко',
}

export const noiseLabel: Record<NoiseLevel, string> = {
  silent: 'полная тишина',
  quiet: 'тихо',
  moderate: 'умеренный шум',
  loud: 'шумно',
}

export const locationTypeLabel: Record<LocationType, string> = {
  castle: 'замок',
  manor: 'особняк',
  mill: 'мельница',
  theatre: 'театр',
  crypt: 'склеп',
  lighthouse: 'маяк',
}

/** Числовой индекс уровня освещённости (0 — темнее всего). */
export function lightingIndex(level: LightingLevel): number {
  return LIGHTING_LEVELS.indexOf(level)
}

/** Числовой индекс уровня шума (0 — тише всего). */
export function noiseIndex(level: NoiseLevel): number {
  return NOISE_LEVELS.indexOf(level)
}

export function describeCondition(condition: SpecialCondition): string {
  switch (condition.kind) {
    case 'requires_attic':
      return 'нужен чердак'
    case 'avoids_mirrors':
      return 'не переносит зеркала'
    case 'no_humans_nearby':
      return 'рядом не должно быть людей'
    case 'min_humidity':
      return `влажность не ниже ${condition.value}%`
    case 'needs_low_light':
      return 'нужен приглушённый свет'
    case 'needs_quiet':
      return 'нужна тишина'
  }
}

export function describeRestriction(restriction: LocationRestriction): string {
  switch (restriction.kind) {
    case 'max_anxiety':
      return `принимает только привидений с тревожностью не выше ${restriction.value}`
    case 'no_new_residents':
      return `закрыто для новых жильцов: ${restriction.reason}`
  }
}

/** Является ли условие жёстким (проверяется до scoring). */
export function isHardCondition(condition: SpecialCondition): boolean {
  switch (condition.kind) {
    case 'requires_attic':
    case 'avoids_mirrors':
    case 'no_humans_nearby':
    case 'min_humidity':
      return true
    case 'needs_low_light':
    case 'needs_quiet':
      return false
  }
}

export const conflictCodeLabel: Record<ConflictCode, string> = {
  location_full: 'место заполнено',
  deadline_expired: 'срок переселения истёк',
  attic_required: 'нет чердака',
  mirrors_present: 'есть зеркала',
  humans_present: 'рядом люди',
  humidity_below_minimum: 'недостаточная влажность',
  location_closed: 'место закрыто',
  anxiety_above_limit: 'тревожность выше лимита места',
  noise_too_high: 'слишком шумно',
  light_too_bright: 'слишком светло',
  humans_nearby_soft: 'соседство с людьми',
  deadline_soon: 'срок близко',
  temperature_far: 'температура далека от желаемой',
  worse_than_recommended: 'хуже рекомендации',
}
