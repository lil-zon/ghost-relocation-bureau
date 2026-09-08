import { describe, expect, it } from 'vitest'
import { createDemoState, createEmptyState } from '../../data/demoData'
import { NOW } from '../../domain/__tests__/fixtures'
import { appReducer, createInitialState, type AppState } from '../store'

function demoState(): AppState {
  return createInitialState(NOW, createDemoState(NOW))
}

describe('reducer приложения', () => {
  it('автоматическое распределение обновляет реестр и сообщает итог', () => {
    const next = appReducer(demoState(), { type: 'assign_all' })

    expect(next.bureau.ghosts.filter((ghost) => ghost.assignedLocationId !== null)).toHaveLength(8)
    expect(next.lastRun).not.toBeNull()
    expect(next.notice?.kind).toBe('warning')
    expect(next.notice?.message).toContain('размещено 7')
    expect(next.notice?.message).toContain('ждут свободного места 1')
    expect(next.notice?.message).toContain('переселение невозможно 2')
    expect(next.notice?.message).toContain('сохранено решений оператора 1')
  })

  it('на пустом реестре сообщает, что распределять нечего', () => {
    const next = appReducer(createInitialState(NOW, createEmptyState()), { type: 'assign_all' })
    expect(next.notice?.message).toContain('нет заявок')
    expect(next.lastRun).toBeNull()
  })

  it('отклонённое ручное назначение не меняет реестр и объясняет причину', () => {
    const state = demoState()
    const next = appReducer(state, {
      type: 'manual_assign',
      ghostId: 'g-agatha',
      locationId: 'loc-manor',
    })

    expect(next.bureau).toBe(state.bureau)
    expect(next.notice?.kind).toBe('error')
    expect(next.notice?.message).toContain('занято 2 из 2')
  })

  it('подтверждённое ручное назначение проходит и помечается предупреждением', () => {
    const next = appReducer(demoState(), {
      type: 'manual_assign',
      ghostId: 'g-agatha',
      locationId: 'loc-theatre',
      confirmed: true,
    })

    const ghost = next.bureau.ghosts.find((item) => item.id === 'g-agatha')!
    expect(ghost.assignedLocationId).toBe('loc-theatre')
    expect(ghost.assignmentSource).toBe('manual')
    expect(next.notice?.kind).toBe('warning')
  })

  it('снятие назначения освобождает место, повторное — сообщает, что снимать нечего', () => {
    const assigned = appReducer(demoState(), {
      type: 'manual_assign',
      ghostId: 'g-agatha',
      locationId: 'loc-castle',
    })
    const released = appReducer(assigned, { type: 'unassign', ghostId: 'g-agatha' })

    expect(released.bureau.locations.find((item) => item.id === 'loc-castle')!.currentOccupancy).toBe(0)

    const again = appReducer(released, { type: 'unassign', ghostId: 'g-agatha' })
    expect(again.notice?.message).toContain('нет назначенного места')
  })

  it('очистка и загрузка демо-данных переключают реестр целиком', () => {
    const cleared = appReducer(demoState(), { type: 'clear_requests' })
    expect(cleared.bureau.ghosts).toHaveLength(0)
    expect(cleared.lastRun).toBeNull()

    const reloaded = appReducer(cleared, { type: 'load_demo' })
    expect(reloaded.bureau.ghosts).toHaveLength(11)
    expect(reloaded.bureau.locations).toHaveLength(6)
  })

  it('выбор заявки и скрытие сообщения не трогают доменные данные', () => {
    const state = demoState()
    const selected = appReducer(state, { type: 'select_ghost', ghostId: 'g-baron' })
    expect(selected.selectedGhostId).toBe('g-baron')
    expect(selected.bureau).toBe(state.bureau)

    const dismissed = appReducer(
      { ...selected, notice: { kind: 'info', message: 'тест' } },
      { type: 'dismiss_notice' },
    )
    expect(dismissed.notice).toBeNull()
  })
})
