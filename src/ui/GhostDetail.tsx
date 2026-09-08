import { useMemo, type Dispatch } from 'react'
import { freeSlots, isFull } from '../domain/constraints'
import { formatDeadline, isOverdue } from '../domain/dates'
import { closestAlternatives, explainExistingAssignment, findBestMatch } from '../domain/matching'
import type { BureauState, GhostRequest, MatchResult } from '../domain/types'
import { describeCondition, lightingLabel, noiseLabel } from '../domain/vocabulary'
import type { AppAction } from '../state/store'
import { ConflictList } from './components/ConflictList'
import { MatchExplanation } from './components/MatchExplanation'
import { Badge, Button, DataRow, Meter, Panel } from './components/primitives'
import { ManualAssign } from './ManualAssign'

function NoMatchPanel({
  ghost,
  bureau,
  alternatives,
  now,
}: {
  ghost: GhostRequest
  bureau: BureauState
  alternatives: MatchResult[]
  now: Date
}) {
  const locationName = (id: string) =>
    bureau.locations.find((location) => location.id === id)?.name ?? id

  return (
    <Panel
      title="Решение"
      actions={<Badge tone="danger">переселение невозможно</Badge>}
      className="border-danger/40"
    >
      <div className="space-y-4">
        <p className="text-[13px] text-ink">
          Ни одно из {bureau.locations.length} мест реестра не проходит обязательные условия заявки
          «{ghost.name}». Автоматическое назначение выполнить нельзя — ниже перечислено, что именно
          мешает.
        </p>

        {isOverdue(ghost.deadline, now) && (
          <div className="rounded border border-danger/40 bg-danger/5 px-3 py-2 text-[13px] text-ink">
            Корневая причина: срок переселения истёк ({formatDeadline(ghost.deadline, now)}).
            Пока срок не продлён, любое место будет отклонено доменной проверкой.
          </div>
        )}

        <div>
          <div className="mb-2 text-[11px] tracking-wide text-muted uppercase">
            Ближайшие варианты и что их блокирует
          </div>
          <div className="space-y-3">
            {alternatives.map((alternative) => (
              <div
                key={alternative.locationId}
                className="rounded-lg border border-line bg-raised/50 p-3"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">
                    {locationName(alternative.locationId)}
                  </span>
                  <span className="tabular-nums text-[11px] text-muted">
                    потенциальный балл {alternative.breakdown.total} / 100, если снять ограничения
                  </span>
                </div>
                <ConflictList
                  conflicts={alternative.conflicts.filter((c) => c.severity === 'blocking')}
                  dense
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

export function GhostDetail({
  bureau,
  ghost,
  now,
  dispatch,
}: {
  bureau: BureauState
  ghost: GhostRequest
  now: Date
  dispatch: Dispatch<AppAction>
}) {
  const assignedLocation =
    bureau.locations.find((location) => location.id === ghost.assignedLocationId) ?? null

  const currentMatch = useMemo(
    () => (assignedLocation ? explainExistingAssignment(ghost, assignedLocation, now) : null),
    [assignedLocation, ghost, now],
  )

  const recommendation = useMemo(
    () => (assignedLocation ? null : findBestMatch(ghost, bureau.locations, now)),
    [assignedLocation, bureau.locations, ghost, now],
  )

  const alternatives = useMemo(
    () =>
      assignedLocation || recommendation
        ? []
        : closestAlternatives(ghost, bureau.locations, now, 4),
    [assignedLocation, bureau.locations, ghost, now, recommendation],
  )

  const recommendedLocation =
    recommendation === null
      ? null
      : (bureau.locations.find((location) => location.id === recommendation.locationId) ?? null)

  return (
    <div className="space-y-4">
      <Panel
        title="Заявка"
        actions={
          isOverdue(ghost.deadline, now) ? (
            <Badge tone="danger">срок истёк</Badge>
          ) : (
            <Badge>{formatDeadline(ghost.deadline, now)}</Badge>
          )
        }
      >
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">{ghost.name}</h3>
            <p className="text-[13px] text-muted">{ghost.summary}</p>
          </div>

          <div className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
            <DataRow
              label="Тревожность"
              value={
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{ghost.anxietyLevel} / 10</span>
                  <span className="w-16">
                    <Meter
                      value={ghost.anxietyLevel}
                      max={10}
                      tone={ghost.anxietyLevel >= 7 ? 'warn' : 'neutral'}
                    />
                  </span>
                </span>
              }
            />
            <DataRow label="Предпочитаемая температура" value={`${ghost.preferredTemperature} °C`} />
            <DataRow label="Крайний срок" value={`${ghost.deadline} (${formatDeadline(ghost.deadline, now)})`} />
            <DataRow
              label="Источник решения"
              value={
                ghost.assignmentSource === 'manual'
                  ? 'оператор (вручную)'
                  : ghost.assignmentSource === 'auto'
                    ? 'автоматическое распределение'
                    : '—'
              }
            />
          </div>

          <div>
            <div className="mb-1 text-[11px] tracking-wide text-muted uppercase">Особые условия</div>
            {ghost.specialConditions.length === 0 ? (
              <span className="text-[13px] text-muted">особых условий нет</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ghost.specialConditions.map((condition) => (
                  <Badge key={condition.kind} tone="accent">
                    {describeCondition(condition)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {assignedLocation && currentMatch && (
        <Panel
          title="Текущее размещение"
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={ghost.assignmentSource === 'manual' ? 'warn' : 'ok'}>
                {ghost.assignmentSource === 'manual' ? 'выбрано оператором' : 'выбрано системой'}
              </Badge>
              <Button variant="ghost" onClick={() => dispatch({ type: 'unassign', ghostId: ghost.id })}>
                Освободить место
              </Button>
            </div>
          }
        >
          <MatchExplanation
            match={currentMatch}
            location={assignedLocation}
            headline="Заявка размещена"
          />
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <Badge tone={isFull(assignedLocation) ? 'warn' : 'neutral'}>
              занято {assignedLocation.currentOccupancy} из {assignedLocation.capacity}
            </Badge>
            <Badge>{lightingLabel[assignedLocation.lighting]}</Badge>
            <Badge>{noiseLabel[assignedLocation.noise]}</Badge>
            <Badge>влажность {assignedLocation.humidity}%</Badge>
          </div>
        </Panel>
      )}

      {!assignedLocation && recommendation && recommendedLocation && (
        <Panel
          title="Рекомендация системы"
          actions={<Badge tone="accent">свободно {freeSlots(recommendedLocation)}</Badge>}
        >
          <MatchExplanation
            match={recommendation}
            location={recommendedLocation}
            headline="Лучший подходящий вариант"
          />
          <div className="mt-3">
            <Button
              variant="primary"
              onClick={() =>
                dispatch({
                  type: 'manual_assign',
                  ghostId: ghost.id,
                  locationId: recommendation.locationId,
                  confirmed: true,
                })
              }
            >
              Принять рекомендацию
            </Button>
          </div>
        </Panel>
      )}

      {!assignedLocation && !recommendation && (
        <NoMatchPanel ghost={ghost} bureau={bureau} alternatives={alternatives} now={now} />
      )}

      <ManualAssign bureau={bureau} ghost={ghost} now={now} dispatch={dispatch} />
    </div>
  )
}
