import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../../App'
import { createDemoState, createEmptyState } from '../../data/demoData'
import type { BureauState } from '../../domain/types'
import { StoreProvider } from '../../state/StoreProvider'
import { NOW } from '../../domain/__tests__/fixtures'

function renderApp(bureau: BureauState) {
  return render(
    <StoreProvider now={NOW} initialBureau={bureau} persist={false}>
      <App />
    </StoreProvider>,
  )
}

async function openTab(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: label }))
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
      screen.getByText(/Распределение выполнено: размещено 6, без места 2/),
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

    expect(screen.getByText(/Корневая причина: срок переселения истёк/)).toBeInTheDocument()
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

    expect(screen.getByText('выбрано оператором')).toBeInTheDocument()

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
