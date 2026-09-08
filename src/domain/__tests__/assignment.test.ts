import { describe, expect, it } from 'vitest'
import {
  assertCapacityInvariant,
  assign,
  findGhost,
  findLocation,
  unassign,
  validateAssignment,
} from '../assignment'
import { isoDateOffset } from '../dates'
import type { BureauState } from '../types'
import { codes, makeGhost, makeLocation, NOW } from './fixtures'

function makeState(): BureauState {
  return {
    ghosts: [makeGhost({ id: 'g-1' })],
    locations: [
      makeLocation({ id: 'loc-good', temperature: 12 }),
      makeLocation({ id: 'loc-poor', temperature: 24 }),
      makeLocation({ id: 'loc-full', capacity: 1, currentOccupancy: 1 }),
      makeLocation({ id: 'loc-mirrors', hasMirrors: true }),
    ],
  }
}

function validate(state: BureauState, ghostId: string, locationId: string) {
  return validateAssignment(
    state,
    findGhost(state, ghostId)!,
    findLocation(state, locationId)!,
    NOW,
  )
}

describe('валидация ручного назначения', () => {
  it('допустимое место без замечаний не требует подтверждения', () => {
    const validation = validate(makeState(), 'g-1', 'loc-good')
    expect(validation.valid).toBe(true)
    expect(validation.requiresConfirmation).toBe(false)
    expect(validation.score).toBe(100)
    expect(validation.warnings).toEqual([])
  })

  it('блокирующий конфликт делает назначение недопустимым и обнуляет балл', () => {
    const validation = validate(makeState(), 'g-1', 'loc-full')
    expect(validation.valid).toBe(false)
    expect(validation.score).toBe(0)
    expect(codes(validation.blocking)).toContain('location_full')
    // Домен и UI видят один и тот же вердикт: расхождения быть не может.
    expect(validation.requiresConfirmation).toBe(false)
  })

  it('заметно худшее место, чем рекомендация, даёт предупреждение с объяснением', () => {
    const validation = validate(makeState(), 'g-1', 'loc-poor')
    expect(validation.valid).toBe(true)
    expect(validation.requiresConfirmation).toBe(true)
    expect(codes(validation.warnings)).toContain('worse_than_recommended')
    expect(validation.recommended?.locationId).toBe('loc-good')
    expect(validation.warnings.find((w) => w.code === 'worse_than_recommended')?.message).toContain(
      'Тестовое место',
    )
  })

  it('привидение не блокирует само себя при повторной проверке своего места', () => {
    const base = makeState()
    const tight = makeLocation({ id: 'loc-tight', capacity: 1, currentOccupancy: 1 })
    const state: BureauState = {
      ghosts: [
        makeGhost({ id: 'g-1', assignedLocationId: 'loc-tight', status: 'assigned', assignmentSource: 'manual' }),
      ],
      locations: [...base.locations, tight],
    }
    const validation = validate(state, 'g-1', 'loc-tight')
    expect(codes(validation.blocking)).not.toContain('location_full')
    expect(validation.valid).toBe(true)
  })
})

describe('применение назначения', () => {
  it('успешное назначение занимает место и не мутирует прежнее состояние', () => {
    const state = makeState()
    const outcome = assign(state, 'g-1', 'loc-good', NOW, { source: 'manual' })

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    expect(findLocation(outcome.state, 'loc-good')!.currentOccupancy).toBe(1)
    expect(findGhost(outcome.state, 'g-1')!.status).toBe('assigned')
    expect(findGhost(outcome.state, 'g-1')!.assignmentSource).toBe('manual')
    // Исходное состояние осталось нетронутым.
    expect(findLocation(state, 'loc-good')!.currentOccupancy).toBe(0)
  })

  it('доменный слой отклоняет назначение в заполненное место, а не только UI', () => {
    const state = makeState()
    const outcome = assign(state, 'g-1', 'loc-full', NOW, { source: 'manual', confirmed: true })

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toContain('занято 1 из 1')
    expect(findLocation(state, 'loc-full')!.currentOccupancy).toBe(1)
  })

  it('просроченная заявка не может быть назначена даже принудительно', () => {
    const state: BureauState = {
      ...makeState(),
      ghosts: [makeGhost({ id: 'g-1', deadline: isoDateOffset(NOW, -1) })],
    }
    const outcome = assign(state, 'g-1', 'loc-good', NOW, { source: 'manual', confirmed: true })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toContain('Срок переселения истёк')
  })

  it('назначение с предупреждением требует явного подтверждения', () => {
    const state = makeState()
    const rejected = assign(state, 'g-1', 'loc-poor', NOW, { source: 'manual' })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.reason).toContain('подтверждения')

    const confirmed = assign(state, 'g-1', 'loc-poor', NOW, { source: 'manual', confirmed: true })
    expect(confirmed.ok).toBe(true)
  })

  it('переназначение освобождает прежнее место', () => {
    const state = makeState()
    const first = assign(state, 'g-1', 'loc-good', NOW, { source: 'manual' })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = assign(first.state, 'g-1', 'loc-mirrors', NOW, { source: 'manual', confirmed: true })
    expect(second.ok).toBe(true)
    if (!second.ok) return

    expect(findLocation(second.state, 'loc-good')!.currentOccupancy).toBe(0)
    expect(findLocation(second.state, 'loc-mirrors')!.currentOccupancy).toBe(1)
  })

  it('снятие назначения освобождает место', () => {
    const state = makeState()
    const assigned = assign(state, 'g-1', 'loc-good', NOW, { source: 'manual' })
    expect(assigned.ok).toBe(true)
    if (!assigned.ok) return

    const released = unassign(assigned.state, 'g-1')
    expect(findLocation(released, 'loc-good')!.currentOccupancy).toBe(0)
    expect(findGhost(released, 'g-1')!.status).toBe('pending')
    expect(findGhost(released, 'g-1')!.assignedLocationId).toBeNull()
  })

  it('несуществующие идентификаторы дают понятную ошибку вместо падения', () => {
    const state = makeState()
    const noGhost = assign(state, 'g-missing', 'loc-good', NOW, { source: 'manual' })
    expect(noGhost.ok).toBe(false)
    if (!noGhost.ok) expect(noGhost.reason).toContain('g-missing')

    const noLocation = assign(state, 'g-1', 'loc-missing', NOW, { source: 'manual' })
    expect(noLocation.ok).toBe(false)
    if (!noLocation.ok) expect(noLocation.reason).toContain('loc-missing')
  })

  it('инвариант вместимости нарушить нельзя: последовательные назначения уважают лимит', () => {
    let state: BureauState = {
      ghosts: [makeGhost({ id: 'g-1' }), makeGhost({ id: 'g-2' }), makeGhost({ id: 'g-3' })],
      locations: [makeLocation({ id: 'loc-two', capacity: 2, currentOccupancy: 0 })],
    }

    for (const ghostId of ['g-1', 'g-2']) {
      const outcome = assign(state, ghostId, 'loc-two', NOW, { source: 'manual', confirmed: true })
      expect(outcome.ok).toBe(true)
      if (outcome.ok) state = outcome.state
    }

    expect(findLocation(state, 'loc-two')!.currentOccupancy).toBe(2)
    const third = assign(state, 'g-3', 'loc-two', NOW, { source: 'manual', confirmed: true })
    expect(third.ok).toBe(false)
    expect(() => assertCapacityInvariant(state)).not.toThrow()
  })

  it('нарушенный инвариант вместимости обнаруживается с конкретным сообщением', () => {
    const broken: BureauState = {
      ghosts: [],
      locations: [makeLocation({ id: 'loc-x', name: 'Склеп', capacity: 1, currentOccupancy: 2 })],
    }
    expect(() => assertCapacityInvariant(broken)).toThrow(/Склеп/)
  })
})
