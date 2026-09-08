import { isoDateOffset } from '../domain/dates'
import type { BureauState, GhostRequest, RelocationLocation } from '../domain/types'

/**
 * Демонстрационный набор данных.
 *
 * Он спроектирован, а не сгенерирован: каждая заявка и каждое место закрывают
 * конкретный сценарий проверки — обычный подбор, высокая тревожность,
 * требование влажности, набор особых условий, просроченный срок, отсутствие
 * подходящего места, переполнение, конкуренцию за одно место, соседство с
 * людьми, шум, избыточный свет и закрытое на ремонт место.
 *
 * Дедлайны задаются смещением в днях относительно `now`, поэтому набор
 * остаётся осмысленным в любой день запуска.
 */

function createLocations(): RelocationLocation[] {
  return [
    {
      id: 'loc-castle',
      name: 'Замок Вороний Утёс',
      type: 'castle',
      capacity: 3,
      currentOccupancy: 0,
      temperature: 12,
      lighting: 'dim',
      noise: 'quiet',
      humidity: 65,
      humansPresent: false,
      hasAttic: true,
      hasMirrors: false,
      restrictions: [],
    },
    {
      id: 'loc-manor',
      name: 'Особняк Тумановых',
      type: 'manor',
      capacity: 2,
      currentOccupancy: 2,
      temperature: 17,
      lighting: 'dim',
      noise: 'quiet',
      humidity: 55,
      humansPresent: false,
      hasAttic: true,
      hasMirrors: true,
      restrictions: [],
    },
    {
      id: 'loc-mill',
      name: 'Старая мельница',
      type: 'mill',
      capacity: 2,
      currentOccupancy: 0,
      temperature: 9,
      lighting: 'dark',
      noise: 'moderate',
      humidity: 80,
      humansPresent: false,
      hasAttic: false,
      hasMirrors: false,
      restrictions: [],
    },
    {
      id: 'loc-theatre',
      name: 'Городской театр',
      type: 'theatre',
      capacity: 4,
      currentOccupancy: 1,
      temperature: 21,
      lighting: 'bright',
      noise: 'loud',
      humidity: 40,
      humansPresent: true,
      hasAttic: false,
      hasMirrors: true,
      restrictions: [],
    },
    {
      id: 'loc-crypt',
      name: 'Склеп у часовни',
      type: 'crypt',
      capacity: 1,
      currentOccupancy: 0,
      temperature: 6,
      lighting: 'dark',
      noise: 'silent',
      humidity: 90,
      humansPresent: false,
      hasAttic: false,
      hasMirrors: false,
      restrictions: [
        {
          kind: 'max_anxiety',
          value: 6,
        },
      ],
    },
    {
      id: 'loc-lighthouse',
      name: 'Маяк на Косе',
      type: 'lighthouse',
      capacity: 2,
      currentOccupancy: 0,
      temperature: 14,
      lighting: 'bright',
      noise: 'quiet',
      humidity: 70,
      humansPresent: false,
      hasAttic: false,
      hasMirrors: false,
      restrictions: [
        {
          kind: 'no_new_residents',
          reason: 'идёт ремонт перекрытий до конца сезона',
        },
      ],
    },
  ]
}

function createGhosts(now: Date): GhostRequest[] {
  const pending = {
    status: 'pending',
    assignedLocationId: null,
    assignmentSource: null,
    assignmentRecord: null,
  } as const

  return [
    {
      id: 'g-agatha',
      name: 'Агата Пепельная',
      anxietyLevel: 3,
      preferredTemperature: 12,
      deadline: isoDateOffset(now, 14),
      specialConditions: [],
      summary: 'Спокойная заявка без особых условий: подходит почти любое место.',
      ...pending,
    },
    {
      id: 'g-baron',
      name: 'Барон фон Хладен',
      anxietyLevel: 9,
      preferredTemperature: 10,
      deadline: isoDateOffset(now, 5),
      specialConditions: [{ kind: 'needs_quiet' }, { kind: 'needs_low_light' }],
      summary: 'Очень тревожен: шум и яркий свет резко снижают пригодность места.',
      ...pending,
    },
    {
      id: 'g-ilona',
      name: 'Мокрица Илона',
      anxietyLevel: 5,
      preferredTemperature: 8,
      deadline: isoDateOffset(now, 10),
      specialConditions: [{ kind: 'min_humidity', value: 75 }],
      summary: 'Обязательная влажность от 75%: сухие места отсекаются жёстко.',
      ...pending,
    },
    {
      id: 'g-vivian',
      name: 'Сестра Вивиан',
      anxietyLevel: 7,
      preferredTemperature: 15,
      deadline: isoDateOffset(now, 2),
      specialConditions: [
        { kind: 'requires_attic' },
        { kind: 'avoids_mirrors' },
        { kind: 'no_humans_nearby' },
      ],
      summary: 'Три особых условия и близкий срок: подходит единственное место.',
      ...pending,
    },
    {
      id: 'g-timofey',
      name: 'Тимофей Гулкий',
      anxietyLevel: 2,
      preferredTemperature: 20,
      deadline: isoDateOffset(now, 21),
      specialConditions: [],
      summary: 'Любит тепло и не боится шума: живой пример терпимости к людям рядом.',
      ...pending,
    },
    {
      id: 'g-marfa',
      name: 'Прачка Марфа',
      anxietyLevel: 6,
      preferredTemperature: 11,
      deadline: isoDateOffset(now, -3),
      specialConditions: [],
      summary: 'Срок переселения истёк: заявку нельзя закрыть без продления.',
      ...pending,
    },
    {
      id: 'g-kalcifer',
      name: 'Инженер Кальцифер',
      anxietyLevel: 8,
      preferredTemperature: 25,
      deadline: isoDateOffset(now, 7),
      specialConditions: [
        { kind: 'requires_attic' },
        { kind: 'no_humans_nearby' },
        { kind: 'min_humidity', value: 85 },
      ],
      summary: 'Комбинация условий, которой не удовлетворяет ни одно место реестра.',
      ...pending,
    },
    {
      id: 'g-twins',
      name: 'Двойняшки Лидия и Лада',
      anxietyLevel: 4,
      preferredTemperature: 13,
      deadline: isoDateOffset(now, 9),
      specialConditions: [{ kind: 'avoids_mirrors' }],
      summary: 'Конкурируют за замок с более ограниченными заявками.',
      ...pending,
    },
  ]
}

export function createDemoState(now: Date): BureauState {
  return { ghosts: createGhosts(now), locations: createLocations() }
}

/** Пустой реестр: используется для проверки empty state. */
export function createEmptyState(): BureauState {
  return { ghosts: [], locations: createLocations() }
}
