/**
 * Доменная модель бюро переселения привидений.
 * Слой не зависит от React и от способа хранения данных.
 */

/** Уровень освещённости места. Порядок значим: используется как шкала 0..3. */
export const LIGHTING_LEVELS = ['dark', 'dim', 'normal', 'bright'] as const
export type LightingLevel = (typeof LIGHTING_LEVELS)[number]

/** Уровень шума. Порядок значим: используется как шкала 0..3. */
export const NOISE_LEVELS = ['silent', 'quiet', 'moderate', 'loud'] as const
export type NoiseLevel = (typeof NOISE_LEVELS)[number]

export const LOCATION_TYPES = [
  'castle',
  'manor',
  'mill',
  'theatre',
  'crypt',
  'lighthouse',
] as const
export type LocationType = (typeof LOCATION_TYPES)[number]

/**
 * Особые условия заявки — структурированные значения, а не свободный текст.
 * Часть из них проверяется как hard constraint, часть влияет только на score.
 */
export type SpecialCondition =
  | { kind: 'requires_attic' }
  | { kind: 'avoids_mirrors' }
  | { kind: 'no_humans_nearby' }
  | { kind: 'min_humidity'; value: number }
  | { kind: 'needs_low_light' }
  | { kind: 'needs_quiet' }

export type SpecialConditionKind = SpecialCondition['kind']

/** Ограничения самого места (правила приёма новых жильцов). */
export type LocationRestriction =
  | { kind: 'max_anxiety'; value: number }
  | { kind: 'no_new_residents'; reason: string }

/**
 * Кто выбрал место.
 * `auto`     — выбрала система в ходе распределения;
 * `accepted` — выбрала система, оператор согласился с рекомендацией;
 * `manual`   — место выбрал оператор вопреки рекомендации или вместо неё.
 *
 * `accepted` существует отдельно, потому что согласие с рекомендацией — это не
 * собственное решение оператора: статистика «сколько решил алгоритм» не должна
 * от него портиться, а повторное распределение вправе такое место пересчитать.
 */
export type AssignmentSource = 'auto' | 'accepted' | 'manual'

/**
 * Состояние заявки.
 * `awaiting_capacity` отделён от `unassignable` намеренно: «подходящее место есть,
 * но занято» и «подходящего места не существует» требуют разных действий оператора.
 */
export type GhostStatus = 'pending' | 'assigned' | 'awaiting_capacity' | 'unassignable'

/**
 * След принятого решения: что предлагала система в момент назначения и что
 * выбрали в итоге. Нужен для аудита ручных решений — после подтверждения
 * сравнение с рекомендацией иначе теряется.
 */
export interface AssignmentRecord {
  source: AssignmentSource
  score: number
  recommendedLocationId: string | null
  recommendedScore: number
  warnings: Conflict[]
}

export interface GhostRequest {
  id: string
  name: string
  /** Уровень тревожности, 1..10. */
  anxietyLevel: number
  /** Предпочитаемая температура, °C. */
  preferredTemperature: number
  /** Крайний срок переселения, ISO-дата (YYYY-MM-DD). */
  deadline: string
  specialConditions: SpecialCondition[]
  status: GhostStatus
  assignedLocationId: string | null
  /** Как именно возникло текущее назначение. */
  assignmentSource: AssignmentSource | null
  /** Что предлагала система в момент назначения; null, если места нет. */
  assignmentRecord: AssignmentRecord | null
  /** Короткая справка по заявке для оператора. */
  summary: string
}

export interface RelocationLocation {
  id: string
  name: string
  type: LocationType
  capacity: number
  currentOccupancy: number
  /** Температура, °C. */
  temperature: number
  lighting: LightingLevel
  noise: NoiseLevel
  /** Влажность, %. */
  humidity: number
  humansPresent: boolean
  hasAttic: boolean
  hasMirrors: boolean
  restrictions: LocationRestriction[]
}

export type ConflictSeverity = 'blocking' | 'warning'

export type ConflictCode =
  // blocking
  | 'location_full'
  | 'deadline_expired'
  | 'attic_required'
  | 'mirrors_present'
  | 'humans_present'
  | 'humidity_below_minimum'
  | 'location_closed'
  | 'anxiety_above_limit'
  // warning
  | 'noise_too_high'
  | 'light_too_bright'
  | 'humans_nearby_soft'
  | 'deadline_soon'
  | 'temperature_far'
  | 'worse_than_recommended'

export interface Conflict {
  code: ConflictCode
  severity: ConflictSeverity
  /** Человекочитаемое объяснение конфликта. */
  message: string
}

export type ScoreComponentKey =
  | 'temperature'
  | 'noise'
  | 'lighting'
  | 'humidity'
  | 'humans'

export interface ScoreComponent {
  key: ScoreComponentKey
  label: string
  /** Сырой вес компонента (нормализуется по сумме весов). */
  weight: number
  /** Соответствие 0..1. */
  fit: number
  /** Вклад компонента в итоговый балл. */
  points: number
  /** Максимально возможный вклад компонента. Сумма по всем компонентам равна 100. */
  maxPoints: number
  /** Объяснение на основе фактических данных. */
  detail: string
  /** true, если вес компонента усилен из-за высокой тревожности. */
  boosted: boolean
}

export interface ScoreBreakdown {
  /** Итоговый балл 0..100. */
  total: number
  components: ScoreComponent[]
}

export interface MatchResult {
  ghostId: string
  locationId: string
  /** Нет ни одного blocking-конфликта. */
  compatible: boolean
  /** 0..100. Для несовместимых мест равен 0. */
  score: number
  breakdown: ScoreBreakdown
  /** Положительные причины, собранные из breakdown. */
  reasons: string[]
  conflicts: Conflict[]
}

export interface BureauState {
  ghosts: GhostRequest[]
  locations: RelocationLocation[]
}
