import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  componentStack: string | null
}

/**
 * Последний рубеж на случай непредвиденной ошибки рендеринга.
 * Показывает, что именно произошло, вместо безличного «что-то пошло не так».
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null })
    console.error('Сбой интерфейса бюро:', error, info.componentStack)
  }

  render() {
    const { error, componentStack } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-danger/50 bg-danger/5 p-5">
          <h1 className="text-base font-semibold text-danger">Интерфейс бюро остановился</h1>
          <p className="mt-2 text-[13px] text-ink">
            Ошибка при отрисовке экрана: <span className="font-mono">{error.message}</span>
          </p>
          <p className="mt-2 text-[13px] text-muted">
            Данные реестра сохранены в браузере. Перезагрузите страницу — если ошибка повторится,
            очистите сохранённое состояние кнопкой ниже.
          </p>
          {componentStack && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] text-muted">
                Технические подробности
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-surface p-2 text-[11px] text-muted">
                {componentStack}
              </pre>
            </details>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded border border-line bg-raised px-3 py-1.5 text-[13px] text-ink"
            >
              Перезагрузить
            </button>
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem('ghost-relocation-bureau')
                window.location.reload()
              }}
              className="rounded border border-danger/50 bg-danger/10 px-3 py-1.5 text-[13px] text-danger"
            >
              Очистить сохранённое состояние
            </button>
          </div>
        </div>
      </div>
    )
  }
}
