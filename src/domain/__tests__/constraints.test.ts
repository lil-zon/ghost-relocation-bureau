import { describe, expect, it } from 'vitest'
import {
  detectBlockingConflicts,
  detectWarnings,
  hasBlocking,
  isFull,
} from '../constraints'
import { daysUntilDeadline, isOverdue, isoDateOffset } from '../dates'
import { codes, makeGhost, makeLocation, NOW } from './fixtures'

describe('жёсткие ограничения', () => {
  it('идеально подходящее место не даёт ни одного блокирующего конфликта', () => {
    const conflicts = detectBlockingConflicts(makeGhost(), makeLocation(), NOW)
    expect(conflicts).toEqual([])
  })

  it('заполненное место блокирует назначение', () => {
    const location = makeLocation({ capacity: 2, currentOccupancy: 2 })
    expect(isFull(location)).toBe(true)
    const conflicts = detectBlockingConflicts(makeGhost(), location, NOW)
    expect(codes(conflicts)).toContain('location_full')
    expect(conflicts[0].message).toContain('занято 2 из 2')
  })

  it('просроченный дедлайн блокирует любое место', () => {
    const ghost = makeGhost({ deadline: isoDateOffset(NOW, -1) })
    expect(isOverdue(ghost.deadline, NOW)).toBe(true)
    for (const location of [makeLocation(), makeLocation({ id: 'loc-2', temperature: 12 })]) {
      expect(codes(detectBlockingConflicts(ghost, location, NOW))).toContain('deadline_expired')
    }
  })

  it('дедлайн сегодня ещё не считается просроченным', () => {
    const ghost = makeGhost({ deadline: isoDateOffset(NOW, 0) })
    expect(daysUntilDeadline(ghost.deadline, NOW)).toBe(0)
    expect(codes(detectBlockingConflicts(ghost, makeLocation(), NOW))).not.toContain(
      'deadline_expired',
    )
    expect(codes(detectWarnings(ghost, makeLocation(), NOW))).toContain('deadline_soon')
  })

  it('требование чердака блокирует место без чердака', () => {
    const ghost = makeGhost({ specialConditions: [{ kind: 'requires_attic' }] })
    expect(codes(detectBlockingConflicts(ghost, makeLocation({ hasAttic: false }), NOW))).toEqual([
      'attic_required',
    ])
    expect(detectBlockingConflicts(ghost, makeLocation({ hasAttic: true }), NOW)).toEqual([])
  })

  it('зеркала блокируют место при условии avoids_mirrors', () => {
    const ghost = makeGhost({ specialConditions: [{ kind: 'avoids_mirrors' }] })
    expect(codes(detectBlockingConflicts(ghost, makeLocation({ hasMirrors: true }), NOW))).toEqual([
      'mirrors_present',
    ])
  })

  it('люди блокируют место при условии no_humans_nearby', () => {
    const ghost = makeGhost({ specialConditions: [{ kind: 'no_humans_nearby' }] })
    expect(
      codes(detectBlockingConflicts(ghost, makeLocation({ humansPresent: true }), NOW)),
    ).toEqual(['humans_present'])
  })

  it('влажность ниже минимума блокирует, равная минимуму — нет', () => {
    const ghost = makeGhost({ specialConditions: [{ kind: 'min_humidity', value: 75 }] })
    expect(codes(detectBlockingConflicts(ghost, makeLocation({ humidity: 74 }), NOW))).toEqual([
      'humidity_below_minimum',
    ])
    expect(detectBlockingConflicts(ghost, makeLocation({ humidity: 75 }), NOW)).toEqual([])
  })

  it('ограничения места блокируют: закрытое место и лимит тревожности', () => {
    const closed = makeLocation({
      restrictions: [{ kind: 'no_new_residents', reason: 'ремонт' }],
    })
    expect(codes(detectBlockingConflicts(makeGhost(), closed, NOW))).toEqual(['location_closed'])

    const calmOnly = makeLocation({ restrictions: [{ kind: 'max_anxiety', value: 6 }] })
    expect(codes(detectBlockingConflicts(makeGhost({ anxietyLevel: 7 }), calmOnly, NOW))).toEqual([
      'anxiety_above_limit',
    ])
    expect(detectBlockingConflicts(makeGhost({ anxietyLevel: 6 }), calmOnly, NOW)).toEqual([])
  })

  it('несколько нарушений собираются в один список', () => {
    const ghost = makeGhost({
      deadline: isoDateOffset(NOW, -5),
      specialConditions: [{ kind: 'requires_attic' }, { kind: 'avoids_mirrors' }],
    })
    const location = makeLocation({
      capacity: 1,
      currentOccupancy: 1,
      hasAttic: false,
      hasMirrors: true,
    })
    const conflicts = detectBlockingConflicts(ghost, location, NOW)
    expect(codes(conflicts).sort()).toEqual([
      'attic_required',
      'deadline_expired',
      'location_full',
      'mirrors_present',
    ])
    expect(hasBlocking(conflicts)).toBe(true)
  })
})

describe('мягкие предупреждения', () => {
  it('шум предупреждает при требовании тишины, но не блокирует', () => {
    const ghost = makeGhost({ specialConditions: [{ kind: 'needs_quiet' }] })
    const noisy = makeLocation({ noise: 'loud' })
    expect(detectBlockingConflicts(ghost, noisy, NOW)).toEqual([])
    expect(codes(detectWarnings(ghost, noisy, NOW))).toContain('noise_too_high')
  })

  it('яркий свет предупреждает при требовании полумрака', () => {
    const ghost = makeGhost({ specialConditions: [{ kind: 'needs_low_light' }] })
    expect(codes(detectWarnings(ghost, makeLocation({ lighting: 'bright' }), NOW))).toContain(
      'light_too_bright',
    )
    expect(detectWarnings(ghost, makeLocation({ lighting: 'dark' }), NOW)).toEqual([])
  })

  it('люди рядом дают мягкий штраф только высокотревожным без жёсткого условия', () => {
    const withHumans = makeLocation({ humansPresent: true })
    expect(codes(detectWarnings(makeGhost({ anxietyLevel: 9 }), withHumans, NOW))).toContain(
      'humans_nearby_soft',
    )
    expect(codes(detectWarnings(makeGhost({ anxietyLevel: 3 }), withHumans, NOW))).not.toContain(
      'humans_nearby_soft',
    )
  })

  it('большая разница температур даёт предупреждение', () => {
    const ghost = makeGhost({ preferredTemperature: 20 })
    expect(codes(detectWarnings(ghost, makeLocation({ temperature: 12 }), NOW))).toContain(
      'temperature_far',
    )
    expect(codes(detectWarnings(ghost, makeLocation({ temperature: 15 }), NOW))).not.toContain(
      'temperature_far',
    )
  })
})
