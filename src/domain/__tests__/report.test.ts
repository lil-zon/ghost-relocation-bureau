import { describe, expect, it } from 'vitest'
import { createDemoState, createEmptyState } from '../../data/demoData'
import { assign } from '../assignment'
import { assignAll } from '../globalAssignment'
import { buildReport } from '../report'
import { makeGhost, makeLocation, NOW } from './fixtures'
import type { BureauState } from '../types'

describe('итоговая сводка', () => {
  it('пустой реестр не ломает расчёты', () => {
    const report = buildReport(createEmptyState(), NOW)
    expect(report.total).toBe(0)
    expect(report.assigned).toBe(0)
    expect(report.averageScore).toBeNull()
    expect(report.blockingReasons).toEqual([])
  })

  it('считает размещение, источники и загрузку мест', () => {
    const state: BureauState = {
      ghosts: [makeGhost({ id: 'g-1' }), makeGhost({ id: 'g-2' }), makeGhost({ id: 'g-3' })],
      locations: [
        makeLocation({ id: 'loc-a', capacity: 2, temperature: 12 }),
        makeLocation({ id: 'loc-b', capacity: 1, temperature: 12 }),
      ],
    }

    const auto = assign(state, 'g-1', 'loc-a', NOW, { source: 'auto', confirmed: true })
    expect(auto.ok).toBe(true)
    if (!auto.ok) return
    const manual = assign(auto.state, 'g-2', 'loc-b', NOW, { source: 'manual', confirmed: true })
    expect(manual.ok).toBe(true)
    if (!manual.ok) return

    const report = buildReport(manual.state, NOW)

    expect(report.total).toBe(3)
    expect(report.assigned).toBe(2)
    expect(report.assignedAuto).toBe(1)
    expect(report.assignedManual).toBe(1)
    expect(report.pending).toBe(1)
    expect(report.averageScore).toBe(100)
    expect(report.totalCapacity).toBe(3)
    expect(report.totalOccupancy).toBe(2)
    expect(report.totalFree).toBe(1)
    expect(report.locations.find((item) => item.locationId === 'loc-b')?.full).toBe(true)
    expect(report.assignedRows).toHaveLength(2)
  })

  it('после распределения демо-набора сводка совпадает с состоянием', () => {
    const { state } = assignAll(createDemoState(NOW), NOW)
    const report = buildReport(state, NOW)

    expect(report.total).toBe(8)
    expect(report.assigned).toBe(6)
    expect(report.assignedAuto).toBe(6)
    expect(report.unassignable).toBe(2)
    expect(report.overdueTotal).toBe(1)
    expect(report.overdueUnplaced).toBe(1)
    expect(report.averageScore).not.toBeNull()
    expect(report.averageScore!).toBeGreaterThan(50)

    // Занятость в сводке сходится с занятостью мест.
    expect(report.totalOccupancy).toBe(
      state.locations.reduce((sum, location) => sum + location.currentOccupancy, 0),
    )
    // Изначально в особняке уже жили двое, поэтому занятость больше числа назначений.
    expect(report.totalOccupancy).toBe(report.assigned + 3)
  })

  it('объясняет, какие причины чаще всего мешают разместить оставшиеся заявки', () => {
    const { state } = assignAll(createDemoState(NOW), NOW)
    const report = buildReport(state, NOW)

    expect(report.blockingReasons.length).toBeGreaterThan(0)
    const labels = report.blockingReasons.map((reason) => reason.code)
    expect(labels).toContain('deadline_expired')
    expect(labels).toContain('attic_required')
    // Причины отсортированы по частоте.
    const counts = report.blockingReasons.map((reason) => reason.count)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
  })
})
