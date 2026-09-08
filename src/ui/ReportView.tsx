import { useMemo } from 'react'
import { buildReport } from '../domain/report'
import { assignmentSourceShortLabel, ghostStatusLabel } from '../domain/vocabulary'
import type { AppState } from '../state/store'
import { Badge, EmptyState, Meter, Panel, StatTile } from './components/primitives'
import { scoreTone } from './components/tone'

export function ReportView({ state }: { state: AppState }) {
  const report = useMemo(() => buildReport(state.bureau, state.now), [state.bureau, state.now])

  if (report.total === 0) {
    return (
      <EmptyState
        title="Сводка пуста"
        description="В реестре нет заявок, поэтому считать нечего. Загрузите демо-данные на вкладке «Заявки»."
      />
    )
  }

  const ghostName = (ghostId: string) =>
    state.bureau.ghosts.find((ghost) => ghost.id === ghostId)?.name ?? ghostId

  const unplaced = state.bureau.ghosts.filter((ghost) => ghost.assignedLocationId === null)
  const withoutPlace = report.total - report.assigned

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Заявок в работе" value={report.total} />
        <StatTile
          label="Размещено"
          value={report.assigned}
          tone="ok"
          hint={`система ${report.assignedAuto} · принято ${report.assignedAccepted} · оператор ${report.assignedManual}`}
        />
        <StatTile
          label="Без места"
          value={withoutPlace}
          tone={withoutPlace > 0 ? 'danger' : 'neutral'}
          hint={`ждут места ${report.awaitingCapacity} · невозможно ${report.unassignable} · из них просрочено ${report.overdueUnplaced}`}
        />
        <StatTile
          label="Средний балл"
          value={report.averageScore ?? '—'}
          tone={report.averageScore === null ? 'neutral' : scoreTone(report.averageScore)}
          hint="по размещениям без нарушений"
        />
        <StatTile
          label="Требуют пересмотра"
          value={report.needsReview}
          tone={report.needsReview > 0 ? 'danger' : 'neutral'}
          hint={
            report.needsReview > 0
              ? 'размещение перестало проходить условия'
              : `просрочено во всём реестре: ${report.overdueTotal}`
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Размещения">
          {report.assignedRows.length === 0 ? (
            <p className="text-[13px] text-muted">
              Ни одна заявка пока не размещена. Запустите автоматическое распределение или
              назначьте место вручную.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                  <th className="py-2 pr-3 font-medium">Заявка</th>
                  <th className="py-2 pr-3 font-medium">Место</th>
                  <th className="py-2 pr-3 font-medium">Решение</th>
                  <th className="py-2 text-right font-medium">Балл</th>
                </tr>
              </thead>
              <tbody>
                {report.assignedRows.map((row) => (
                  <tr key={row.ghostId} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pr-3 text-ink">
                      {row.ghostName}
                      {row.needsReview && (
                        <div className="text-[11px] text-danger">
                          {row.blocking[0]?.message ?? 'условия нарушены'}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted">{row.locationName}</td>
                    <td className="py-2 pr-3">
                      {row.needsReview ? (
                        <Badge tone="danger">требует пересмотра</Badge>
                      ) : (
                        <Badge tone={row.source === 'manual' ? 'warn' : 'ok'}>
                          {assignmentSourceShortLabel[row.source]}
                        </Badge>
                      )}
                    </td>
                    <td className="w-16 py-2 text-right tabular-nums text-ink">{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Загрузка мест">
          <div className="space-y-3">
            {report.locations.map((location) => (
              <div key={location.locationId}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                  <span className="text-ink">{location.name}</span>
                  <span className="tabular-nums text-muted">
                    {location.occupancy} / {location.capacity}
                    {location.full && <span className="ml-2 text-danger">заполнено</span>}
                  </span>
                </div>
                <Meter
                  value={location.occupancy}
                  max={location.capacity}
                  tone={location.full ? 'danger' : 'ok'}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {unplaced.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Заявки без места">
            <ul className="space-y-2">
              {unplaced.map((ghost) => (
                <li
                  key={ghost.id}
                  className="flex items-center justify-between gap-2 border-b border-line/60 pb-2 text-[13px] last:border-0 last:pb-0"
                >
                  <span className="text-ink">{ghost.name}</span>
                  <Badge
                    tone={
                      ghost.status === 'unassignable'
                        ? 'danger'
                        : ghost.status === 'awaiting_capacity'
                          ? 'warn'
                          : 'neutral'
                    }
                  >
                    {ghostStatusLabel[ghost.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Что мешает разместить оставшиеся заявки">
            <p className="mb-3 text-[11px] text-muted">
              Сколько раз каждая обязательная причина сработала по всем парам «заявка × место».
            </p>
            <div className="space-y-2">
              {report.blockingReasons.map((reason) => (
                <div key={reason.code}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-ink">{reason.label}</span>
                    <span className="tabular-nums text-muted">{reason.count}</span>
                  </div>
                  <Meter
                    value={reason.count}
                    max={report.blockingReasons[0]?.count ?? 1}
                    tone="danger"
                  />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {state.lastRun && (
        <Panel title="Порядок последнего автоматического распределения">
          <p className="mb-3 text-[11px] text-muted">
            Заявки обрабатывались сверху вниз: чем меньше подходящих мест и ближе срок, тем раньше
            заявка выбирает место.
          </p>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Заявка</th>
                <th className="py-2 pr-3 font-medium">Приоритет</th>
                <th className="py-2 pr-3 font-medium">Основание</th>
                <th className="py-2 font-medium">Результат</th>
              </tr>
            </thead>
            <tbody>
              {state.lastRun.map((entry, index) => (
                <tr key={entry.ghostId} className="border-b border-line/60 last:border-0">
                  <td className="w-8 py-2 pr-3 tabular-nums text-muted">{index + 1}</td>
                  <td className="py-2 pr-3 text-ink">{ghostName(entry.ghostId)}</td>
                  <td className="w-16 py-2 pr-3 tabular-nums text-ink">{entry.priority.total}</td>
                  <td className="py-2 pr-3 text-muted">{entry.priority.explanation}</td>
                  <td className="py-2">
                    {entry.skippedManual ? (
                      <Badge tone="warn">сохранено решение оператора</Badge>
                    ) : entry.match ? (
                      <Badge tone="ok">размещено, балл {entry.match.score}</Badge>
                    ) : entry.unplacedReason === 'awaiting_capacity' ? (
                      <Badge tone="warn">ждёт свободного места</Badge>
                    ) : (
                      <Badge tone="danger">переселение невозможно</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}
