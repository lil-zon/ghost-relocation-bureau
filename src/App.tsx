import { useState } from 'react'
import { useStore } from './state/storeContext'
import type { NoticeKind } from './state/store'
import { Button } from './ui/components/primitives'
import { LocationsView } from './ui/LocationsView'
import { ReportView } from './ui/ReportView'
import { RequestsView } from './ui/RequestsView'
import { WorklogView } from './ui/WorklogView'

const TABS = [
  { id: 'requests', label: 'Заявки' },
  { id: 'locations', label: 'Места' },
  { id: 'report', label: 'Сводка' },
  { id: 'worklog', label: 'AI Worklog' },
] as const

type TabId = (typeof TABS)[number]['id']

const noticeStyles: Record<NoticeKind, string> = {
  error: 'border-danger/50 bg-danger/10 text-ink',
  warning: 'border-warn/50 bg-warn/10 text-ink',
  success: 'border-ok/50 bg-ok/10 text-ink',
  info: 'border-line bg-raised text-ink',
}

export function App() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<TabId>('requests')
  const [confirmClear, setConfirmClear] = useState(false)

  const pending = state.bureau.ghosts.filter(
    (ghost) => ghost.assignedLocationId === null && ghost.status !== 'unassignable',
  ).length

  return (
    <div className="min-h-full">
      <header className="masthead sticky top-0 z-10 border-b border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-ink">
              Бюро переселения привидений
            </h1>
            <p className="text-[11px] text-muted">
              Рабочее место оператора · {state.bureau.ghosts.length} заявок ·{' '}
              {state.bureau.locations.length} мест · ждут решения: {pending}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => dispatch({ type: 'assign_all' })}
              title="Подобрать места для всех заявок с учётом приоритета и вместимости"
            >
              Распределить автоматически
            </Button>
            <Button onClick={() => dispatch({ type: 'load_demo' })}>Демо-данные</Button>
            {confirmClear ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => {
                    dispatch({ type: 'clear_requests' })
                    setConfirmClear(false)
                  }}
                  title="Все заявки и их размещения будут удалены"
                >
                  Удалить все заявки
                </Button>
                <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                  Отмена
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setConfirmClear(true)}
                title="Очистить реестр заявок"
              >
                Очистить
              </Button>
            )}
          </div>
        </div>

        <nav className="mx-auto flex max-w-[1400px] gap-1 px-5" role="tablist" aria-label="Разделы бюро">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-controls={`panel-${item.id}`}
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
                tab === item.id
                  ? 'border-accent text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-5 py-5">
        {state.notice && (
          <div
            role="status"
            className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-2.5 text-[13px] ${noticeStyles[state.notice.kind]}`}
          >
            <span>{state.notice.message}</span>
            <button
              type="button"
              onClick={() => dispatch({ type: 'dismiss_notice' })}
              aria-label="Скрыть сообщение"
              className="shrink-0 text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
        )}

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'requests' && <RequestsView state={state} dispatch={dispatch} />}
          {tab === 'locations' && <LocationsView state={state} />}
          {tab === 'report' && <ReportView state={state} />}
          {tab === 'worklog' && <WorklogView />}
        </div>
      </main>
    </div>
  )
}
