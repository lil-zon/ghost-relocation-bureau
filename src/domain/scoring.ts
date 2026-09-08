import { isHighAnxiety } from './constraints'
import type {
  GhostRequest,
  RelocationLocation,
  ScoreBreakdown,
  ScoreComponent,
  ScoreComponentKey,
} from './types'
import { lightingIndex, lightingLabel, noiseIndex, noiseLabel } from './vocabulary'

/**
 * Мягкая оценка совместимости. Вызывается только для мест, прошедших hard constraints.
 *
 * Модель намеренно простая и полностью объяснимая:
 *   1. каждый компонент даёт fit в диапазоне 0..1 на основе фактических данных;
 *   2. компонент имеет сырой вес; при высокой тревожности веса шума и людей растут;
 *   3. веса нормализуются так, чтобы сумма максимальных вкладов была ровно 100.
 * Поэтому идеальное совпадение всегда даёт ровно 100 баллов, а сумма
 * показанных в UI компонентов всегда совпадает с итоговым баллом.
 */

/** Разница температур, при которой соответствие падает до нуля. */
export const TEMPERATURE_TOLERANCE = 12
/** Комфортный диапазон влажности для привидений, %. */
export const COMFORT_HUMIDITY_MIN = 50
export const COMFORT_HUMIDITY_MAX = 85
/** Отклонение влажности от комфортного диапазона, обнуляющее соответствие. */
export const HUMIDITY_TOLERANCE = 30

const BASE_WEIGHTS: Record<ScoreComponentKey, number> = {
  temperature: 30,
  noise: 20,
  lighting: 15,
  humidity: 15,
  humans: 10,
}

const COMPONENT_LABELS: Record<ScoreComponentKey, string> = {
  temperature: 'Температура',
  noise: 'Шум',
  lighting: 'Освещение',
  humidity: 'Влажность',
  humans: 'Соседство с людьми',
}

/** Тревожность усиливает вес шума и присутствия людей. */
const HIGH_ANXIETY_WEIGHTS: Partial<Record<ScoreComponentKey, number>> = {
  noise: 35,
  humans: 20,
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

interface RawComponent {
  key: ScoreComponentKey
  weight: number
  fit: number
  detail: string
  boosted: boolean
}

function minHumidityRequirement(ghost: GhostRequest): number | null {
  for (const condition of ghost.specialConditions) {
    if (condition.kind === 'min_humidity') return condition.value
  }
  return null
}

function temperatureComponent(ghost: GhostRequest, location: RelocationLocation): RawComponent {
  const delta = Math.abs(location.temperature - ghost.preferredTemperature)
  const fit = clamp01(1 - delta / TEMPERATURE_TOLERANCE)
  const detail =
    delta === 0
      ? `ровно ${location.temperature}°C — как в заявке`
      : `${location.temperature}°C при желаемых ${ghost.preferredTemperature}°C (разница ${delta}°C)`
  return { key: 'temperature', weight: BASE_WEIGHTS.temperature, fit, detail, boosted: false }
}

function noiseComponent(ghost: GhostRequest, location: RelocationLocation): RawComponent {
  const needsQuiet = ghost.specialConditions.some((c) => c.kind === 'needs_quiet')
  const highAnxiety = isHighAnxiety(ghost)
  // Требование тишины или высокая тревожность поднимают планку до «тихо».
  const target = needsQuiet || highAnxiety ? noiseIndex('quiet') : noiseIndex('moderate')
  const excess = Math.max(0, noiseIndex(location.noise) - target)
  const fit = clamp01(1 - excess / 3)
  const boosted = highAnxiety
  const context = needsQuiet
    ? ' при требовании тишины'
    : highAnxiety
      ? ` при тревожности ${ghost.anxietyLevel}/10`
      : ''
  const detail = `${noiseLabel[location.noise]}${context}`
  return {
    key: 'noise',
    weight: boosted ? (HIGH_ANXIETY_WEIGHTS.noise ?? BASE_WEIGHTS.noise) : BASE_WEIGHTS.noise,
    fit,
    detail,
    boosted,
  }
}

function lightingComponent(ghost: GhostRequest, location: RelocationLocation): RawComponent {
  const needsLowLight = ghost.specialConditions.some((c) => c.kind === 'needs_low_light')
  const highAnxiety = isHighAnxiety(ghost)
  // Темнее целевого уровня не штрафуем: привидениям темнота не мешает.
  const target = needsLowLight || highAnxiety ? lightingIndex('dim') : lightingIndex('normal')
  const excess = Math.max(0, lightingIndex(location.lighting) - target)
  const fit = clamp01(1 - excess / 3)
  const context = needsLowLight
    ? ' при требовании приглушённого света'
    : highAnxiety
      ? ` при тревожности ${ghost.anxietyLevel}/10`
      : ''
  return {
    key: 'lighting',
    weight: BASE_WEIGHTS.lighting,
    fit,
    detail: `${lightingLabel[location.lighting]}${context}`,
    boosted: false,
  }
}

function humidityComponent(ghost: GhostRequest, location: RelocationLocation): RawComponent {
  const required = minHumidityRequirement(ghost)
  const low = required === null ? COMFORT_HUMIDITY_MIN : Math.max(COMFORT_HUMIDITY_MIN, required)
  const high = Math.max(low, COMFORT_HUMIDITY_MAX)
  const distance =
    location.humidity < low
      ? low - location.humidity
      : location.humidity > high
        ? location.humidity - high
        : 0
  const fit = clamp01(1 - distance / HUMIDITY_TOLERANCE)
  const detail =
    required === null
      ? `влажность ${location.humidity}% (комфортно ${low}–${high}%)`
      : `влажность ${location.humidity}% при требуемом минимуме ${required}%`
  return { key: 'humidity', weight: BASE_WEIGHTS.humidity, fit, detail, boosted: false }
}

function humansComponent(ghost: GhostRequest, location: RelocationLocation): RawComponent {
  const highAnxiety = isHighAnxiety(ghost)
  const fit = location.humansPresent ? (highAnxiety ? 0 : 0.5) : 1
  const detail = location.humansPresent
    ? highAnxiety
      ? `рядом живут люди, а тревожность ${ghost.anxietyLevel}/10`
      : 'рядом живут люди'
    : 'людей рядом нет'
  return {
    key: 'humans',
    weight: highAnxiety ? (HIGH_ANXIETY_WEIGHTS.humans ?? BASE_WEIGHTS.humans) : BASE_WEIGHTS.humans,
    fit,
    detail,
    boosted: highAnxiety,
  }
}

export function scoreLocation(
  ghost: GhostRequest,
  location: RelocationLocation,
): ScoreBreakdown {
  const raw: RawComponent[] = [
    temperatureComponent(ghost, location),
    noiseComponent(ghost, location),
    lightingComponent(ghost, location),
    humidityComponent(ghost, location),
    humansComponent(ghost, location),
  ]

  const weightSum = raw.reduce((sum, component) => sum + component.weight, 0)
  const maxPoints = raw.map((component) => Math.round((component.weight / weightSum) * 100))

  // Округление весов могло сдвинуть сумму: остаток отдаём самому тяжёлому компоненту,
  // чтобы максимум по всем компонентам был ровно 100.
  const remainder = 100 - maxPoints.reduce((sum, value) => sum + value, 0)
  if (remainder !== 0) {
    let heaviest = 0
    for (let i = 1; i < raw.length; i += 1) {
      if (raw[i].weight > raw[heaviest].weight) heaviest = i
    }
    maxPoints[heaviest] += remainder
  }

  const components: ScoreComponent[] = raw.map((component, index) => ({
    key: component.key,
    label: COMPONENT_LABELS[component.key],
    weight: component.weight,
    fit: component.fit,
    points: Math.round(component.fit * maxPoints[index]),
    maxPoints: maxPoints[index],
    detail: component.detail,
    boosted: component.boosted,
  }))

  const total = components.reduce((sum, component) => sum + component.points, 0)

  return { total, components }
}
