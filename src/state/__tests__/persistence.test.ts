import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { NOW } from '../../domain/__tests__/fixtures'
import { BACKUP_KEY, loadState, saveState, STORAGE_KEY } from '../persistence'

describe('хранилище состояния', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('сохранённое состояние читается обратно', () => {
    const bureau = createDemoState(NOW)
    expect(saveState(bureau)).toBeNull()

    const result = loadState()
    expect(result.kind).toBe('loaded')
    if (result.kind !== 'loaded') return
    expect(result.bureau.ghosts).toHaveLength(8)
  })

  it('пустое хранилище — это не ошибка', () => {
    expect(loadState().kind).toBe('empty')
  })

  it('повреждённый JSON не теряется: он уходит в резервную копию', () => {
    window.localStorage.setItem(STORAGE_KEY, '{сломанный json')

    const result = loadState()
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.message).toContain('повреждены')
    expect(result.message).toContain('резервной копии')
    expect(window.localStorage.getItem(BACKUP_KEY)).toBe('{сломанный json')
  })

  it('чужая версия схемы отвергается с указанием версий', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, bureau: createDemoState(NOW) }),
    )
    const result = loadState()
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.message).toContain('другой версии схемы')
    expect(window.localStorage.getItem(BACKUP_KEY)).not.toBeNull()
  })

  it('частично испорченные данные не проходят проверку', () => {
    const bureau = createDemoState(NOW)
    // Раньше валидация смотрела только на id/name/capacity и пропускала такое.
    const broken = {
      version: 2,
      bureau: {
        ...bureau,
        ghosts: bureau.ghosts.map((ghost, index) =>
          index === 0 ? { ...ghost, deadline: undefined, anxietyLevel: 'высокая' } : ghost,
        ),
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(broken))

    const result = loadState()
    expect(result.kind).toBe('error')
    if (result.kind !== 'error') return
    expect(result.message).toContain('повреждены заявки или места')
  })

  it('реестр без единого места считается некорректным', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, bureau: { ghosts: [], locations: [] } }),
    )
    expect(loadState().kind).toBe('error')
  })
})
