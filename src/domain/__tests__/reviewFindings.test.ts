import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { assign, findGhost, findLocation, unassign } from '../assignment'
import { isoDateOffset } from '../dates'
import { assignAll } from '../globalAssignment'
import { blockedOnlyByCapacity, classifyUnplaced, explainExistingAssignment, explainNoMatch } from '../matching'
import { buildReport } from '../report'
import type { BureauState } from '../types'
import { makeGhost, makeLocation, NOW } from './fixtures'

/**
 * Проверки, закрывающие замечания внешнего ревью первой версии.
 * Каждый блок соответствует конкретной находке — ни одну из них
 * прежний набор тестов не ловил.
 */

describe('источник решения: принятая рекомендация не является решением оператора', () => {
  function stateWithTwoLocations(): BureauState {
    return {
      ghosts: [makeGhost({ id: 'g-1', preferredTemperature: 12 })],
      locations: [
        makeLocation({ id: 'loc-best', capacity: 1, temperature: 12 }),
        makeLocation({ id: 'loc-other', capacity: 1, temperature: 16 }),
      ],
    }
  }

  it('принятие рекомендации помечается как accepted, а не manual', () => {
    const outcome = assign(stateWithTwoLocations(), 'g-1', 'loc-best', NOW, {
      source: 'accepted',
      confirmed: true,
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    expect(findGhost(outcome.state, 'g-1')!.assignmentSource).toBe('accepted')

    const report = buildReport(outcome.state, NOW)
    expect(report.assignedAccepted).toBe(1)
    expect(report.assignedManual).toBe(0)
  })

  it('автоматическое распределение пересчитывает принятую рекомендацию', () => {
    // Оператор принял рекомендацию в неоптимальное место; система вправе его пересмотреть.
    const accepted = assign(stateWithTwoLocations(), 'g-1', 'loc-other', NOW, {
      source: 'accepted',
      confirmed: true,
    })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return

    const { state, entries } = assignAll(accepted.state, NOW)

    expect(findGhost(state, 'g-1')!.assignedLocationId).toBe('loc-best')
    expect(entries.find((entry) => entry.ghostId === 'g-1')?.skippedManual).toBe(false)
  })

  it('собственное решение оператора по-прежнему неприкосновенно', () => {
    const manual = assign(stateWithTwoLocations(), 'g-1', 'loc-other', NOW, {
      source: 'manual',
      confirmed: true,
    })
    expect(manual.ok).toBe(true)
    if (!manual.ok) return

    const { state, entries } = assignAll(manual.state, NOW)
    expect(findGhost(state, 'g-1')!.assignedLocationId).toBe('loc-other')
    expect(entries.find((entry) => entry.ghostId === 'g-1')?.skippedManual).toBe(true)
  })
})

describe('дефицит мест отличается от невозможности переселения', () => {
  it('занятое, но подходящее место даёт статус «ждёт свободного места»', () => {
    const ghost = makeGhost({ id: 'g-1' })
    const locations = [makeLocation({ id: 'loc-full', capacity: 1, currentOccupancy: 1 })]

    expect(classifyUnplaced(ghost, locations, NOW)).toBe('awaiting_capacity')
    expect(blockedOnlyByCapacity(ghost, locations, NOW)).toHaveLength(1)
  })

  it('непреодолимое условие даёт статус «переселение невозможно»', () => {
    const ghost = makeGhost({ id: 'g-1', specialConditions: [{ kind: 'requires_attic' }] })
    const locations = [
      makeLocation({ id: 'loc-full', capacity: 1, currentOccupancy: 1, hasAttic: false }),
      makeLocation({ id: 'loc-free', hasAttic: false }),
    ]

    expect(classifyUnplaced(ghost, locations, NOW)).toBe('unassignable')
    expect(blockedOnlyByCapacity(ghost, locations, NOW)).toHaveLength(0)
  })

  it('распределение расставляет оба статуса по одному прогону', () => {
    const state: BureauState = {
      ghosts: [
        makeGhost({ id: 'g-easy-1' }),
        makeGhost({ id: 'g-easy-2' }),
        makeGhost({ id: 'g-impossible', specialConditions: [{ kind: 'min_humidity', value: 99 }] }),
      ],
      locations: [makeLocation({ id: 'loc-one', capacity: 1, humidity: 65 })],
    }

    const { state: next, entries } = assignAll(state, NOW)

    const waiting = next.ghosts.filter((ghost) => ghost.status === 'awaiting_capacity')
    const impossible = next.ghosts.filter((ghost) => ghost.status === 'unassignable')

    expect(waiting).toHaveLength(1)
    expect(impossible.map((ghost) => ghost.id)).toEqual(['g-impossible'])
    expect(entries.find((entry) => entry.ghostId === 'g-impossible')?.unplacedReason).toBe(
      'unassignable',
    )
  })
})

describe('сводка и карточка показывают одно и то же', () => {
  function stateWithExpiredAssignment(): BureauState {
    return {
      ghosts: [
        makeGhost({
          id: 'g-expired',
          deadline: isoDateOffset(NOW, -5),
          assignedLocationId: 'loc-a',
          assignmentSource: 'auto',
          status: 'assigned',
        }),
        makeGhost({ id: 'g-ok', assignedLocationId: 'loc-b', assignmentSource: 'auto', status: 'assigned' }),
      ],
      locations: [
        makeLocation({ id: 'loc-a', capacity: 2, currentOccupancy: 1 }),
        makeLocation({ id: 'loc-b', capacity: 2, currentOccupancy: 1 }),
      ],
    }
  }

  it('размещение с истёкшим сроком помечается и получает тот же балл, что в карточке', () => {
    const state = stateWithExpiredAssignment()
    const report = buildReport(state, NOW)

    const row = report.assignedRows.find((item) => item.ghostId === 'g-expired')!
    const card = explainExistingAssignment(
      findGhost(state, 'g-expired')!,
      findLocation(state, 'loc-a')!,
      NOW,
    )

    expect(row.needsReview).toBe(true)
    expect(row.score).toBe(card.score)
    expect(row.score).toBe(0)
    expect(row.blocking[0].code).toBe('deadline_expired')
    expect(report.needsReview).toBe(1)
  })

  it('средний балл считается по размещениям без нарушений', () => {
    const report = buildReport(stateWithExpiredAssignment(), NOW)
    // Нарушенное размещение не тянет средний балл вниз до нуля.
    expect(report.averageScore).toBe(100)
  })
})

describe('счётчик просроченных относится к заявкам без места', () => {
  it('просроченная, но размещённая заявка не попадает в подпись «без места»', () => {
    const state: BureauState = {
      ghosts: [
        makeGhost({
          id: 'g-placed-expired',
          deadline: isoDateOffset(NOW, -5),
          assignedLocationId: 'loc-a',
          assignmentSource: 'auto',
          status: 'assigned',
        }),
        makeGhost({ id: 'g-unplaced-expired', deadline: isoDateOffset(NOW, -2) }),
        makeGhost({ id: 'g-unplaced-fresh' }),
      ],
      locations: [makeLocation({ id: 'loc-a', capacity: 2, currentOccupancy: 1 })],
    }

    const report = buildReport(state, NOW)

    expect(report.overdueTotal).toBe(2)
    expect(report.overdueUnplaced).toBe(1)
  })
})

describe('след решения сохраняется вместе с назначением', () => {
  it('ручной выбор запоминает, что рекомендовала система', () => {
    const state: BureauState = {
      ghosts: [makeGhost({ id: 'g-1', preferredTemperature: 12 })],
      locations: [
        makeLocation({ id: 'loc-good', temperature: 12 }),
        makeLocation({ id: 'loc-poor', temperature: 24 }),
      ],
    }

    const outcome = assign(state, 'g-1', 'loc-poor', NOW, { source: 'manual', confirmed: true })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const record = findGhost(outcome.state, 'g-1')!.assignmentRecord!
    expect(record.source).toBe('manual')
    expect(record.recommendedLocationId).toBe('loc-good')
    expect(record.recommendedScore).toBe(100)
    expect(record.score).toBeLessThan(record.recommendedScore)
    expect(record.warnings.some((warning) => warning.code === 'worse_than_recommended')).toBe(true)
  })

  it('освобождение места стирает след решения', () => {
    const state: BureauState = {
      ghosts: [makeGhost({ id: 'g-1' })],
      locations: [makeLocation({ id: 'loc-a' })],
    }
    const assigned = assign(state, 'g-1', 'loc-a', NOW, { source: 'auto', confirmed: true })
    expect(assigned.ok).toBe(true)
    if (!assigned.ok) return
    expect(findGhost(assigned.state, 'g-1')!.assignmentRecord).not.toBeNull()

    const released = unassign(assigned.state, 'g-1')
    expect(findGhost(released, 'g-1')!.assignmentRecord).toBeNull()
    expect(findGhost(released, 'g-1')!.assignmentSource).toBeNull()
  })

  it('переназначение заменяет след решения новым', () => {
    const state: BureauState = {
      ghosts: [makeGhost({ id: 'g-1', preferredTemperature: 12 })],
      locations: [
        makeLocation({ id: 'loc-a', temperature: 12 }),
        makeLocation({ id: 'loc-b', temperature: 24 }),
      ],
    }
    const first = assign(state, 'g-1', 'loc-a', NOW, { source: 'auto', confirmed: true })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = assign(first.state, 'g-1', 'loc-b', NOW, { source: 'manual', confirmed: true })
    expect(second.ok).toBe(true)
    if (!second.ok) return

    const record = findGhost(second.state, 'g-1')!.assignmentRecord!
    expect(record.source).toBe('manual')
    expect(record.recommendedLocationId).toBe('loc-a')
  })
})

describe('разбор «места нет» не повторяет общую причину', () => {
  it('причина, блокирующая все места, выносится в корень и убирается из вариантов', () => {
    const ghost = makeGhost({ id: 'g-1', deadline: isoDateOffset(NOW, -3) })
    const locations = [
      makeLocation({ id: 'loc-clean' }),
      makeLocation({ id: 'loc-mirrors', hasMirrors: true }),
      makeLocation({ id: 'loc-full', capacity: 1, currentOccupancy: 1 }),
    ]

    const { sharedBlockers, alternatives } = explainNoMatch(ghost, locations, NOW)

    expect(sharedBlockers.map((conflict) => conflict.code)).toEqual(['deadline_expired'])
    for (const alternative of alternatives) {
      expect(alternative.conflicts.some((conflict) => conflict.code === 'deadline_expired')).toBe(
        false,
      )
    }
    // Первым идёт вариант, которому мешает только общая причина.
    expect(alternatives[0].locationId).toBe('loc-clean')
    expect(alternatives[0].conflicts.filter((c) => c.severity === 'blocking')).toHaveLength(0)
  })

  it('когда общей причины нет, варианты сохраняют свои конфликты', () => {
    const ghost = makeGhost({ id: 'g-1', specialConditions: [{ kind: 'requires_attic' }] })
    const locations = [
      makeLocation({ id: 'loc-a', hasAttic: false }),
      makeLocation({ id: 'loc-b', hasAttic: true, capacity: 1, currentOccupancy: 1 }),
    ]

    const { sharedBlockers, alternatives } = explainNoMatch(ghost, locations, NOW)
    expect(sharedBlockers).toEqual([])
    expect(alternatives.every((alt) => alt.conflicts.length > 0)).toBe(true)
  })
})

describe('демонстрационный набор после исправлений', () => {
  it('распределение различает причины отказа', () => {
    const { state, entries } = assignAll(createDemoState(NOW), NOW)
    const report = buildReport(state, NOW)

    expect(report.total).toBe(11)
    expect(report.assigned).toBe(8)
    expect(report.assignedAuto).toBe(7)
    expect(report.assignedManual).toBe(1)
    expect(report.averageScore).toBe(92)

    expect(report.unassignable).toBe(2)
    expect(
      entries.filter((entry) => entry.unplacedReason === 'unassignable').map((e) => e.ghostId).sort(),
    ).toEqual(['g-kalcifer', 'g-marfa'])
  })

  /**
   * Замечание третьего ревью: набор показывал только «размещена» и «переселение
   * невозможно», а два состояния были видны лишь при ручной подмене сохранённого
   * состояния. Тесты ниже фиксируют, что теперь они достижимы штатным прогоном.
   */
  it('состояние «ждёт свободного места» видно на демо-наборе', () => {
    const { state, entries } = assignAll(createDemoState(NOW), NOW)
    const report = buildReport(state, NOW)

    expect(report.awaitingCapacity).toBe(1)

    // Прохору подходит только склеп, и его заняла Тина — с более близким сроком.
    const prokhor = findGhost(state, 'g-prokhor')!
    expect(prokhor.status).toBe('awaiting_capacity')
    expect(findGhost(state, 'g-tina')!.assignedLocationId).toBe('loc-crypt')

    const entry = entries.find((item) => item.ghostId === 'g-prokhor')!
    expect(entry.unplacedReason).toBe('awaiting_capacity')
    expect(entry.explanation!.blockedByCapacity.map((match) => match.locationId)).toEqual([
      'loc-crypt',
    ])
  })

  it('состояние «размещение требует пересмотра» видно на демо-наборе', () => {
    const { state } = assignAll(createDemoState(NOW), NOW)
    const report = buildReport(state, NOW)

    expect(report.needsReview).toBe(1)

    // Решение оператора автопрогон не трогает, но срок у него уже истёк.
    const arkady = findGhost(state, 'g-arkady')!
    expect(arkady.assignedLocationId).toBe('loc-theatre')
    expect(arkady.assignmentSource).toBe('manual')

    const row = report.assignedRows.find((item) => item.ghostId === 'g-arkady')!
    expect(row.needsReview).toBe(true)
    expect(row.score).toBe(0)
    expect(row.blocking[0].code).toBe('deadline_expired')

    // Карточка показывает ровно то же значение, что и сводка.
    const card = explainExistingAssignment(arkady, findLocation(state, 'loc-theatre')!, NOW)
    expect(card.score).toBe(row.score)
  })

  it('счётчики просроченных различаются на демо-наборе, а не совпадают случайно', () => {
    const { state } = assignAll(createDemoState(NOW), NOW)
    const report = buildReport(state, NOW)

    // Марфа без места и Аркадий с местом — оба просрочены, но подпись к плитке
    // «без места» должна считать только первую.
    expect(report.overdueTotal).toBe(2)
    expect(report.overdueUnplaced).toBe(1)
  })
})

/**
 * Замечания второго внешнего ревью — они касались кода, написанного
 * для исправления первого.
 */
describe('общая причина не подставляет числа одного места', () => {
  it('при разной занятости корневая причина формулируется без чисел', () => {
    const ghost = makeGhost({ id: 'g-1' })
    const locations = [
      makeLocation({ id: 'loc-small', capacity: 1, currentOccupancy: 1 }),
      makeLocation({ id: 'loc-big', capacity: 4, currentOccupancy: 4 }),
    ]

    const { sharedBlockers, alternatives } = explainNoMatch(ghost, locations, NOW)

    expect(sharedBlockers).toHaveLength(1)
    expect(sharedBlockers[0].code).toBe('location_full')
    // Ни одно число конкретного места не попадает в общую формулировку.
    expect(sharedBlockers[0].message).not.toMatch(/\d/)
    expect(sharedBlockers[0].message).toContain('Свободных мест нет')

    // Конкретика остаётся там, где она верна, — в карточках вариантов.
    const small = alternatives.find((item) => item.locationId === 'loc-small')!
    const big = alternatives.find((item) => item.locationId === 'loc-big')!
    expect(small.conflicts.some((c) => c.message.includes('занято 1 из 1'))).toBe(true)
    expect(big.conflicts.some((c) => c.message.includes('занято 4 из 4'))).toBe(true)
  })

  it('при одинаковых данных причина выносится дословно и не повторяется в вариантах', () => {
    const ghost = makeGhost({ id: 'g-1' })
    const locations = [
      makeLocation({ id: 'loc-a', capacity: 1, currentOccupancy: 1 }),
      makeLocation({ id: 'loc-b', capacity: 1, currentOccupancy: 1 }),
    ]

    const { sharedBlockers, alternatives } = explainNoMatch(ghost, locations, NOW)

    expect(sharedBlockers).toHaveLength(1)
    expect(sharedBlockers[0].message).toContain('занято 1 из 1')
    for (const alternative of alternatives) {
      expect(alternative.conflicts.filter((c) => c.severity === 'blocking')).toHaveLength(0)
    }
  })

  it('разная требуемая влажность не подставляется как общая', () => {
    const ghost = makeGhost({
      id: 'g-1',
      specialConditions: [{ kind: 'min_humidity', value: 90 }],
    })
    const locations = [
      makeLocation({ id: 'loc-dry', humidity: 30 }),
      makeLocation({ id: 'loc-almost', humidity: 85 }),
    ]

    const { sharedBlockers, alternatives } = explainNoMatch(ghost, locations, NOW)

    expect(sharedBlockers[0].message).not.toContain('30%')
    expect(sharedBlockers[0].message).not.toContain('85%')
    expect(
      alternatives.find((item) => item.locationId === 'loc-almost')!.conflicts.some((c) =>
        c.message.includes('85%'),
      ),
    ).toBe(true)
  })

  it('причина без данных места по-прежнему выносится дословно', () => {
    const ghost = makeGhost({ id: 'g-1', deadline: isoDateOffset(NOW, -3) })
    const locations = [makeLocation({ id: 'loc-a' }), makeLocation({ id: 'loc-b', temperature: 20 })]

    const { sharedBlockers, alternatives } = explainNoMatch(ghost, locations, NOW)

    expect(sharedBlockers).toHaveLength(1)
    expect(sharedBlockers[0].message).toContain('Срок переселения истёк')
    // Общая причина убрана из вариантов; собственные предупреждения мест остаются.
    expect(
      alternatives.every(
        (item) => item.conflicts.filter((c) => c.severity === 'blocking').length === 0,
      ),
    ).toBe(true)
  })
})
