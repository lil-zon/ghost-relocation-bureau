import { describe, expect, it } from 'vitest'
import { isoDateOffset } from '../dates'
import {
  closestAlternatives,
  evaluateMatch,
  findBestMatch,
  rankCandidates,
} from '../matching'
import { scoreLocation } from '../scoring'
import { codes, makeGhost, makeLocation, NOW } from './fixtures'

describe('scoring', () => {
  it('идеальное совпадение даёт ровно 100 баллов', () => {
    const breakdown = scoreLocation(makeGhost(), makeLocation())
    expect(breakdown.total).toBe(100)
    expect(breakdown.components.every((component) => component.fit === 1)).toBe(true)
  })

  it('сумма максимумов компонентов всегда равна 100', () => {
    const ghosts = [
      makeGhost(),
      makeGhost({ anxietyLevel: 9 }),
      makeGhost({ anxietyLevel: 9, specialConditions: [{ kind: 'needs_low_light' }] }),
    ]
    for (const ghost of ghosts) {
      const breakdown = scoreLocation(ghost, makeLocation({ temperature: 30 }))
      const max = breakdown.components.reduce((sum, component) => sum + component.maxPoints, 0)
      expect(max).toBe(100)
      // Итоговый балл — в точности сумма показанных компонентов.
      expect(breakdown.components.reduce((sum, component) => sum + component.points, 0)).toBe(
        breakdown.total,
      )
    }
  })

  it('балл снижается по мере роста разницы температур', () => {
    const ghost = makeGhost({ preferredTemperature: 12 })
    const exact = scoreLocation(ghost, makeLocation({ temperature: 12 })).total
    const near = scoreLocation(ghost, makeLocation({ temperature: 15 })).total
    const far = scoreLocation(ghost, makeLocation({ temperature: 26 })).total
    expect(exact).toBeGreaterThan(near)
    expect(near).toBeGreaterThan(far)
  })

  it('при высокой тревожности шум весит сильнее', () => {
    const noisy = makeLocation({ noise: 'loud' })
    const calmGhost = makeGhost({ anxietyLevel: 2 })
    const anxiousGhost = makeGhost({ anxietyLevel: 9 })

    const calmNoise = scoreLocation(calmGhost, noisy).components.find((c) => c.key === 'noise')!
    const anxiousNoise = scoreLocation(anxiousGhost, noisy).components.find(
      (c) => c.key === 'noise',
    )!

    expect(anxiousNoise.weight).toBeGreaterThan(calmNoise.weight)
    expect(anxiousNoise.boosted).toBe(true)
    expect(anxiousNoise.fit).toBeLessThan(calmNoise.fit)
    expect(scoreLocation(anxiousGhost, noisy).total).toBeLessThan(
      scoreLocation(calmGhost, noisy).total,
    )
  })

  it('тревожному привидению люди рядом обнуляют компонент, спокойному — только половина', () => {
    const withHumans = makeLocation({ humansPresent: true })
    const anxious = scoreLocation(makeGhost({ anxietyLevel: 8 }), withHumans).components.find(
      (c) => c.key === 'humans',
    )!
    const calm = scoreLocation(makeGhost({ anxietyLevel: 2 }), withHumans).components.find(
      (c) => c.key === 'humans',
    )!
    expect(anxious.fit).toBe(0)
    expect(calm.fit).toBe(0.5)
  })

  it('низкая освещённость не штрафуется, избыточная — штрафуется', () => {
    const ghost = makeGhost({ specialConditions: [{ kind: 'needs_low_light' }] })
    const dark = scoreLocation(ghost, makeLocation({ lighting: 'dark' })).components.find(
      (c) => c.key === 'lighting',
    )!
    const bright = scoreLocation(ghost, makeLocation({ lighting: 'bright' })).components.find(
      (c) => c.key === 'lighting',
    )!
    expect(dark.fit).toBe(1)
    expect(bright.fit).toBeLessThan(1)
  })
})

describe('подбор места', () => {
  it('блокирующий конфликт нельзя компенсировать высоким баллом', () => {
    const perfectButFull = makeLocation({ capacity: 1, currentOccupancy: 1 })
    const match = evaluateMatch(makeGhost(), perfectButFull, NOW)

    expect(match.compatible).toBe(false)
    expect(match.score).toBe(0)
    // Потенциальный балл остаётся доступным — он нужен для показа «ближайших» вариантов.
    expect(match.breakdown.total).toBe(100)
    expect(codes(match.conflicts)).toContain('location_full')
  })

  it('объяснение строится из фактических данных матчинга', () => {
    const match = evaluateMatch(makeGhost(), makeLocation(), NOW)
    expect(match.reasons.length).toBeGreaterThanOrEqual(4)
    expect(match.reasons.some((reason) => reason.includes('12°C'))).toBe(true)
    expect(match.reasons.some((reason) => reason.includes('людей рядом нет'))).toBe(true)
    expect(match.reasons.some((reason) => reason.includes('есть свободное место'))).toBe(true)
  })

  it('выбирает лучшее совместимое место и игнорирует несовместимые', () => {
    const ghost = makeGhost({ preferredTemperature: 12 })
    const locations = [
      makeLocation({ id: 'perfect-but-closed', temperature: 12, restrictions: [{ kind: 'no_new_residents', reason: 'ремонт' }] }),
      makeLocation({ id: 'good', temperature: 14 }),
      makeLocation({ id: 'poor', temperature: 24 }),
    ]

    const best = findBestMatch(ghost, locations, NOW)
    expect(best?.locationId).toBe('good')
    expect(rankCandidates(ghost, locations, NOW).map((match) => match.locationId)).toEqual([
      'good',
      'poor',
    ])
  })

  it('при равном балле выбирает место с большим запасом мест', () => {
    const ghost = makeGhost()
    const locations = [
      makeLocation({ id: 'loc-tight', capacity: 2, currentOccupancy: 1 }),
      makeLocation({ id: 'loc-roomy', capacity: 4, currentOccupancy: 0 }),
    ]
    const best = findBestMatch(ghost, locations, NOW)
    expect(best?.score).toBe(100)
    expect(best?.locationId).toBe('loc-roomy')
  })

  it('когда подходящего места нет, возвращает null и объясняет ближайшие варианты', () => {
    const ghost = makeGhost({
      specialConditions: [{ kind: 'requires_attic' }, { kind: 'min_humidity', value: 85 }],
    })
    const locations = [
      makeLocation({ id: 'loc-dry-attic', hasAttic: true, humidity: 60 }),
      makeLocation({ id: 'loc-wet-no-attic', hasAttic: false, humidity: 90 }),
      makeLocation({ id: 'loc-nothing', hasAttic: false, humidity: 30, humansPresent: true }),
    ]

    expect(findBestMatch(ghost, locations, NOW)).toBeNull()

    const alternatives = closestAlternatives(ghost, locations, NOW)
    expect(alternatives).toHaveLength(3)
    // Сначала варианты с наименьшим числом блокирующих причин.
    expect(alternatives[0].conflicts.filter((c) => c.severity === 'blocking')).toHaveLength(1)
    expect(alternatives[0].conflicts[0].message).toMatch(/влажность|чердак/i)
  })

  it('просроченная заявка не подбирается ни к одному месту', () => {
    const ghost = makeGhost({ deadline: isoDateOffset(NOW, -1) })
    const locations = [makeLocation({ id: 'a' }), makeLocation({ id: 'b' })]
    expect(findBestMatch(ghost, locations, NOW)).toBeNull()
    expect(closestAlternatives(ghost, locations, NOW)[0].conflicts[0].code).toBe('deadline_expired')
  })
})
