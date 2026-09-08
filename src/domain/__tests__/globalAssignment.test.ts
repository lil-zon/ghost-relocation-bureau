import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { assign, assertCapacityInvariant, findGhost, findLocation } from '../assignment'
import { assignAll } from '../globalAssignment'
import { computePriority, sortByPriority } from '../priority'
import type { BureauState } from '../types'
import { makeGhost, makeLocation, NOW } from './fixtures'
import { isoDateOffset } from '../dates'

describe('приоритет заявок', () => {
  it('заявка с единственным подходящим местом важнее нетребовательной', () => {
    const locations = [
      makeLocation({ id: 'loc-attic', hasAttic: true }),
      makeLocation({ id: 'loc-plain', hasAttic: false }),
    ]
    const picky = makeGhost({ id: 'g-picky', specialConditions: [{ kind: 'requires_attic' }] })
    const easy = makeGhost({ id: 'g-easy' })

    const pickyPriority = computePriority(picky, locations, NOW)
    const easyPriority = computePriority(easy, locations, NOW)

    expect(pickyPriority.compatibleCount).toBe(1)
    expect(easyPriority.compatibleCount).toBe(2)
    expect(pickyPriority.scarcity).toBeGreaterThan(easyPriority.scarcity)
    expect(pickyPriority.total).toBeGreaterThan(easyPriority.total)
  })

  it('срочность и тревожность повышают приоритет', () => {
    const locations = [makeLocation()]
    const urgent = computePriority(
      makeGhost({ id: 'a', deadline: isoDateOffset(NOW, 1) }),
      locations,
      NOW,
    )
    const relaxed = computePriority(
      makeGhost({ id: 'b', deadline: isoDateOffset(NOW, 20) }),
      locations,
      NOW,
    )
    expect(urgent.urgency).toBeGreaterThan(relaxed.urgency)
    expect(urgent.total).toBeGreaterThan(relaxed.total)

    const anxious = computePriority(makeGhost({ id: 'c', anxietyLevel: 9 }), locations, NOW)
    const calm = computePriority(makeGhost({ id: 'd', anxietyLevel: 2 }), locations, NOW)
    expect(anxious.total).toBeGreaterThan(calm.total)
  })

  it('порядок обработки детерминирован при равных приоритетах', () => {
    const locations = [makeLocation()]
    const ghosts = [makeGhost({ id: 'g-b' }), makeGhost({ id: 'g-a' })]
    expect(sortByPriority(ghosts, locations, NOW).map((item) => item.ghost.id)).toEqual([
      'g-a',
      'g-b',
    ])
  })
})

describe('глобальное распределение', () => {
  it('ограниченная заявка не теряет единственное место из-за нетребовательной', () => {
    // Место с чердаком лучше и для нетребовательной заявки, но подходит только оно
    // единственное для требовательной — приоритет обязан её защитить.
    const state: BureauState = {
      ghosts: [
        makeGhost({ id: 'g-easy', preferredTemperature: 12 }),
        makeGhost({
          id: 'g-picky',
          preferredTemperature: 12,
          specialConditions: [{ kind: 'requires_attic' }],
        }),
      ],
      locations: [
        makeLocation({ id: 'loc-attic', capacity: 1, hasAttic: true, temperature: 12 }),
        makeLocation({ id: 'loc-plain', capacity: 1, hasAttic: false, temperature: 18 }),
      ],
    }

    const { state: next } = assignAll(state, NOW)

    expect(findGhost(next, 'g-picky')!.assignedLocationId).toBe('loc-attic')
    expect(findGhost(next, 'g-easy')!.assignedLocationId).toBe('loc-plain')
  })

  it('вместимость не превышается: лишние заявки ждут освобождения места', () => {
    const state: BureauState = {
      ghosts: [
        makeGhost({ id: 'g-1' }),
        makeGhost({ id: 'g-2' }),
        makeGhost({ id: 'g-3' }),
      ],
      locations: [makeLocation({ id: 'loc-one', capacity: 1 })],
    }

    const { state: next } = assignAll(state, NOW)

    expect(findLocation(next, 'loc-one')!.currentOccupancy).toBe(1)
    expect(next.ghosts.filter((ghost) => ghost.assignedLocationId !== null)).toHaveLength(1)
    // Место подходит и мешает только занятость — это не «переселение невозможно».
    expect(next.ghosts.filter((ghost) => ghost.status === 'awaiting_capacity')).toHaveLength(2)
    expect(next.ghosts.filter((ghost) => ghost.status === 'unassignable')).toHaveLength(0)
    expect(() => assertCapacityInvariant(next)).not.toThrow()
  })

  it('ручное решение оператора не переписывается автоматическим прогоном', () => {
    const state: BureauState = {
      ghosts: [makeGhost({ id: 'g-1', preferredTemperature: 12 }), makeGhost({ id: 'g-2' })],
      locations: [
        makeLocation({ id: 'loc-best', capacity: 1, temperature: 12 }),
        makeLocation({ id: 'loc-other', capacity: 1, temperature: 16 }),
      ],
    }

    const manual = assign(state, 'g-1', 'loc-other', NOW, { source: 'manual', confirmed: true })
    expect(manual.ok).toBe(true)
    if (!manual.ok) return

    const { state: next, entries } = assignAll(manual.state, NOW)

    expect(findGhost(next, 'g-1')!.assignedLocationId).toBe('loc-other')
    expect(entries.find((entry) => entry.ghostId === 'g-1')?.skippedManual).toBe(true)
    expect(findGhost(next, 'g-2')!.assignedLocationId).toBe('loc-best')
  })

  it('повторный прогон даёт тот же результат', () => {
    const state = createDemoState(NOW)
    const first = assignAll(state, NOW).state
    const second = assignAll(first, NOW).state
    expect(second.ghosts.map((ghost) => ghost.assignedLocationId)).toEqual(
      first.ghosts.map((ghost) => ghost.assignedLocationId),
    )
    expect(second.locations.map((location) => location.currentOccupancy)).toEqual(
      first.locations.map((location) => location.currentOccupancy),
    )
  })
})

describe('распределение демонстрационного набора', () => {
  const { state: next, entries } = assignAll(createDemoState(NOW), NOW)

  it('заявка с единственным вариантом получает замок', () => {
    expect(findGhost(next, 'g-vivian')!.assignedLocationId).toBe('loc-castle')
  })

  it('невыполнимая комбинация условий остаётся без места и объясняется', () => {
    const ghost = findGhost(next, 'g-kalcifer')!
    expect(ghost.assignedLocationId).toBeNull()
    expect(ghost.status).toBe('unassignable')

    const entry = entries.find((item) => item.ghostId === 'g-kalcifer')!
    expect(entry.match).toBeNull()
    expect(entry.unplacedReason).toBe('unassignable')
    expect(entry.explanation!.alternatives.length).toBeGreaterThan(0)
  })

  it('просроченная заявка не занимает место', () => {
    const ghost = findGhost(next, 'g-marfa')!
    expect(ghost.assignedLocationId).toBeNull()
    expect(ghost.status).toBe('unassignable')
  })

  it('изначально заполненное место и закрытое место остаются незанятыми новыми жильцами', () => {
    expect(findLocation(next, 'loc-manor')!.currentOccupancy).toBe(2)
    expect(findLocation(next, 'loc-lighthouse')!.currentOccupancy).toBe(0)
  })

  it('вместимость соблюдена по всему реестру', () => {
    expect(() => assertCapacityInvariant(next)).not.toThrow()
    for (const location of next.locations) {
      expect(location.currentOccupancy).toBeLessThanOrEqual(location.capacity)
    }
  })

  it('восемь из одиннадцати заявок получают место, остальные различают причину', () => {
    expect(next.ghosts.filter((ghost) => ghost.assignedLocationId !== null)).toHaveLength(8)
    expect(next.ghosts.filter((ghost) => ghost.status === 'unassignable')).toHaveLength(2)
    expect(next.ghosts.filter((ghost) => ghost.status === 'awaiting_capacity')).toHaveLength(1)
  })
})
