import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../../App'
import { createDemoState, createEmptyState } from '../../data/demoData'
import type { BureauState } from '../../domain/types'
import { StoreProvider } from '../../state/StoreProvider'
import { makeGhost, makeLocation, NOW } from '../../domain/__tests__/fixtures'

function renderApp(bureau: BureauState) {
  return render(
    <StoreProvider now={NOW} initialBureau={bureau} persist={false}>
      <App />
    </StoreProvider>,
  )
}

async function openTab(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('tab', { name: label }))
}

describe('пустой реестр', () => {
  it('объясняет ситуацию и позволяет загрузить демо-данные', async () => {
    const user = userEvent.setup()
    renderApp(createEmptyState())

    expect(screen.getByText('В реестре нет заявок')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Загрузить демо-данные' }))

    expect(screen.getByRole('button', { name: /Агата Пепельная/ })).toBeInTheDocument()
    expect(screen.getByText(/Загружен демонстрационный набор/)).toBeInTheDocument()
  })
})

describe('основной сценарий оператора', () => {
  it('автоматическое распределение размещает заявки и отчитывается о результате', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: 'Распределить автоматически' }))

    expect(
      screen.getByText(/Распределение выполнено: размещено 6, переселение невозможно 2/),
    ).toBeInTheDocument()

    await openTab(user, 'Сводка')
    expect(screen.getByText('Размещения')).toBeInTheDocument()
    expect(screen.getByText('Порядок последнего автоматического распределения')).toBeInTheDocument()
  })

  it('показывает объяснение рекомендации, а не только балл', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: /Агата Пепельная/ }))

    expect(screen.getByText('Рекомендация системы')).toBeInTheDocument()
    expect(screen.getByText('Почему это место')).toBeInTheDocument()
    expect(screen.getByText('Из чего сложился балл')).toBeInTheDocument()
    expect(screen.getByText(/есть свободное место/)).toBeInTheDocument()
  })
})

describe('переселение невозможно', () => {
  it('объясняет причины и показывает ближайшие варианты', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: /Инженер Кальцифер/ }))

    expect(screen.getAllByText('переселение невозможно').length).toBeGreaterThan(0)
    expect(screen.getByText(/Ни одно из 6 мест реестра не проходит/)).toBeInTheDocument()
    expect(screen.getByText('Ближайшие варианты и что их блокирует')).toBeInTheDocument()
    expect(screen.getAllByText(/ниже обязательного минимума 85%/).length).toBeGreaterThan(0)
  })

  it('просроченная заявка объясняется отдельной причиной', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: /Прачка Марфа/ }))

    const rootCause = screen.getByText(/Корневая причина — она блокирует все места сразу/)
    expect(rootCause).toBeInTheDocument()

    // Общая причина названа один раз, а не повторена в карточке каждого места.
    const panel = rootCause.closest('section')!
    const repeats = panel.textContent!.match(/Срок переселения истёк/g) ?? []
    expect(repeats).toHaveLength(1)
    expect(panel.textContent).toContain('Других препятствий нет')
  })
})

describe('ручное назначение', () => {
  it('запрещает выбор заполненного места и называет причину', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: /Агата Пепельная/ }))
    await user.selectOptions(screen.getByRole('combobox'), 'loc-manor')

    expect(
      screen.getByText('Назначение запрещено — обязательные условия не выполнены'),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/занято 2 из 2/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Назначить' })).toBeDisabled()
  })

  it('допускает неидеальное место только после явного подтверждения', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: /Агата Пепельная/ }))
    await user.selectOptions(screen.getByRole('combobox'), 'loc-theatre')

    expect(screen.getByText('Место допустимо, но есть замечания')).toBeInTheDocument()
    expect(screen.getByText(/Система рекомендует/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Назначить с замечаниями' }))
    expect(screen.getByText(/Подтвердите решение/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Подтвердить назначение' }))
    expect(screen.getByText(/с предупреждениями \(балл \d+\)/)).toBeInTheDocument()
    expect(screen.getByText('Текущее размещение')).toBeInTheDocument()
  })

  it('решение оператора помечено как ручное и может быть отменено', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: /Тимофей Гулкий/ }))
    await user.selectOptions(screen.getByRole('combobox'), 'loc-mill')
    await user.click(screen.getByRole('button', { name: /Назначить/ }))
    await user.click(screen.getByRole('button', { name: 'Подтвердить назначение' }))

    expect(screen.getAllByText(/выбрано оператором/).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Освободить место' }))
    expect(screen.getByText(/Место освобождено/)).toBeInTheDocument()
  })
})

describe('экран мест', () => {
  it('показывает вместимость, заполненность и ограничения', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await openTab(user, 'Места')

    const table = screen.getByRole('table')
    const manorRow = within(table).getByText('Особняк Тумановых').closest('tr')!
    expect(within(manorRow).getByText('заполнено')).toBeInTheDocument()
    expect(within(manorRow).getByText('2 / 2')).toBeInTheDocument()

    const lighthouseRow = within(table).getByText('Маяк на Косе').closest('tr')!
    expect(within(lighthouseRow).getByText('закрыто для заселения')).toBeInTheDocument()
    expect(within(lighthouseRow).getByText(/идёт ремонт перекрытий/)).toBeInTheDocument()
  })
})

describe('AI Worklog', () => {
  it('доступен из основной навигации и содержит фактические разделы', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await openTab(user, 'AI Worklog')

    expect(screen.getByText('AI-инструменты')).toBeInTheDocument()
    expect(screen.getByText('Ход работы')).toBeInTheDocument()
    expect(screen.getByText('Ошибки AI, замеченные в работе')).toBeInTheDocument()
    expect(screen.getByText('Выполненные проверки')).toBeInTheDocument()
  })
})

describe('исправления по итогам ревью', () => {
  it('принятая рекомендация не выдаётся за решение оператора', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: /Агата Пепельная/ }))
    await user.click(screen.getByRole('button', { name: 'Принять рекомендацию' }))

    expect(screen.getByText(/Рекомендация принята/)).toBeInTheDocument()
    expect(screen.getAllByText(/рекомендация принята оператором/i).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: 'Сводка' }))
    const row = screen.getByText('Агата Пепельная').closest('tr')!
    expect(within(row).getByText('принято')).toBeInTheDocument()
    expect(within(row).queryByText('оператор')).toBeNull()
    expect(screen.getByText(/система 0 · принято 1 · оператор 0/)).toBeInTheDocument()
  })

  it('нехватка мест объясняется как ожидание, а не как невозможность', async () => {
    const user = userEvent.setup()
    renderApp({
      ghosts: [
        makeGhost({ id: 'g-1', name: 'Первый дух' }),
        makeGhost({ id: 'g-2', name: 'Второй дух' }),
      ],
      locations: [makeLocation({ id: 'loc-one', name: 'Единственный склеп', capacity: 1 })],
    })

    await user.click(screen.getByRole('button', { name: 'Распределить автоматически' }))
    expect(screen.getByText(/ждут свободного места 1/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Второй дух/ }))
    expect(screen.getByText(/Подходящее место для заявки .* существует, но все такие места/)).toBeInTheDocument()
    expect(screen.getByText('Подошло бы, если бы освободилось')).toBeInTheDocument()
    expect(screen.getByText(/Освободите место у одной из этих заявок/)).toBeInTheDocument()
    expect(screen.queryByText(/Ни одно из .* мест реестра не проходит/)).toBeNull()
  })

  it('размещение с истёкшим сроком помечается и в списке, и в сводке', async () => {
    const user = userEvent.setup()
    renderApp({
      ghosts: [
        makeGhost({
          id: 'g-late',
          name: 'Опоздавший дух',
          deadline: '2020-01-01',
          assignedLocationId: 'loc-a',
          assignmentSource: 'auto',
          status: 'assigned',
        }),
      ],
      locations: [makeLocation({ id: 'loc-a', name: 'Тихий чердак', capacity: 2, currentOccupancy: 1 })],
    })

    expect(screen.getAllByText(/требует пересмотра/).length).toBeGreaterThan(0)
    expect(screen.getByText('Размещение требует пересмотра')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Сводка' }))
    const row = screen.getByText('Опоздавший дух').closest('tr')!
    // Балл в сводке тот же, что в карточке: расхождения между экранами быть не может.
    expect(within(row).getByText('0')).toBeInTheDocument()
  })

  it('очистка реестра требует подтверждения', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: 'Очистить' }))
    expect(screen.getByRole('button', { name: 'Удалить все заявки' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Агата Пепельная/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('button', { name: 'Удалить все заявки' })).toBeNull()
    expect(screen.getByRole('button', { name: /Агата Пепельная/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Очистить' }))
    await user.click(screen.getByRole('button', { name: 'Удалить все заявки' }))
    expect(screen.getByText('В реестре нет заявок')).toBeInTheDocument()
  })

  it('после ручного выбора видно, что система советовала другое', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    await user.click(screen.getByRole('button', { name: /Агата Пепельная/ }))
    await user.selectOptions(screen.getByRole('combobox'), 'loc-theatre')
    await user.click(screen.getByRole('button', { name: 'Назначить с замечаниями' }))
    await user.click(screen.getByRole('button', { name: 'Подтвердить назначение' }))

    expect(screen.getByText('Как принято решение')).toBeInTheDocument()
    expect(screen.getByText(/В момент назначения система рекомендовала/)).toBeInTheDocument()
    expect(screen.getAllByText(/разница \d+/).length).toBeGreaterThan(0)
  })

  it('вкладки объявлены как вкладки для скринридера', async () => {
    const user = userEvent.setup()
    renderApp(createDemoState(NOW))

    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByRole('tab', { name: 'Заявки' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: 'Места' }))
    expect(screen.getByRole('tab', { name: 'Места' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
  })
})
