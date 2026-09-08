import { useMemo, type Dispatch } from 'react'
import { blockingOnly, freeSlots, isFull } from '../domain/constraints'
import { formatDeadline, isOverdue } from '../domain/dates'
import {
  classifyUnplaced,
  explainExistingAssignment,
  explainNoMatch,
  findBestMatch,
} from '../domain/matching'
import type { BureauState, GhostRequest } from '../domain/types'
import {
  assignmentSourceLabel,
  describeCondition,
  lightingLabel,
  noiseLabel,
} from '../domain/vocabulary'
import type { AppAction } from '../state/store'
import { ConflictList } from './components/ConflictList'
import { MatchExplanation } from './components/MatchExplanation'
import { Badge, Button, DataRow, Meter, Panel } from './components/primitives'
import { ManualAssign } from './ManualAssign'

/**
 * Заявка осталась без места. Различаем две принципиально разные ситуации:
 * подходящее место есть, но занято — и подходящего места не существует.
 */
function UnplacedPanel({
  ghost,
  bureau,
  now,
}: {
  ghost: GhostRequest
  bureau: BureauState
  now: Date
}) {
  const kind = classifyUnplaced(ghost, bureau.locations, now)
  const { sharedBlockers, alternatives, blockedByCapacity } = explainNoMatch(
    ghost,
    bureau.locations,
    now,
    4,
  )

  const locationById = (id: string) => bureau.locations.find((location) => location.id === id)
  const residentsOf = (locationId: string) =>
    bureau.ghosts.filter((item) => item.assignedLocationId === locationId)

  if (kind === 'awaiting_capacity') {
    return (
      <Panel
        title="Решение"
        actions={<Badge tone="warn">ждёт свободного места</Badge>}
        className="border-warn/40"
      >
        <div className="space-y-4">
          <p className="text-[13px] text-ink">
            Подходящее место для заявки «{ghost.name}» существует, но все такие места сейчас
            заняты. Это не отказ: как только освободится место, заявку можно разместить.
          </p>

          <div>
            <div className="mb-2 text-[11px] tracking-wide text-muted uppercase">
              Подошло бы, если бы освободилось
            </div>
            <div className="space-y-3">
              {blockedByCapacity.map((match) => {
                const location = locationById(match.locationId)
                if (!location) return null
                const residents = residentsOf(location.id)
                return (
                  <div key={match.locationId} className="rounded-lg border border-line bg-raised/50 p-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-ink">{location.name}</span>
                      <span className="tabular-nums text-[11px] text-muted">
                        балл {match.breakdown.total} / 100 · занято {location.currentOccupancy} из{' '}
                        {location.capacity}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted">
                      {residents.length > 0
                        ? `Сейчас здесь: ${residents.map((item) => item.name).join(', ')}. Освободите место у одной из этих заявок, чтобы разместить «${ghost.name}».`
                        : 'Место занято жильцами не из текущего реестра.'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel
      title="Решение"
      actions={<Badge tone="danger">переселение невозможно</Badge>}
      className="border-danger/40"
    >
      <div className="space-y-4">
        <p className="text-[13px] text-ink">
          Ни одно из {bureau.locations.length} мест реестра не проходит обязательные условия заявки
          «{ghost.name}». Освобождение мест здесь не поможет — нужно менять условия заявки или
          состав реестра.
        </p>

        {sharedBlockers.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] tracking-wide text-muted uppercase">
              Корневая причина — она блокирует все места сразу
            </div>
            <ConflictList conflicts={sharedBlockers} dense />
          </div>
        )}

        <div>
          <div className="mb-2 text-[11px] tracking-wide text-muted uppercase">
            {sharedBlockers.length > 0
              ? 'Что ещё мешает, помимо корневой причины'
              : 'Ближайшие варианты и что их блокирует'}
          </div>
          <div className="space-y-3">
            {alternatives.map((alternative) => {
              const remaining = blockingOnly(alternative.conflicts)
              return (
                <div
                  key={alternative.locationId}
                  className="rounded-lg border border-line bg-raised/50 p-3"
                >
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">
                      {locationById(alternative.locationId)?.name ?? alternative.locationId}
                    </span>
                    <span className="tabular-nums text-[11px] text-muted">
                      потенциальный балл {alternative.breakdown.total} / 100, если снять ограничения
                    </span>
                  </div>
                  {remaining.length > 0 ? (
                    <ConflictList conflicts={remaining} dense />
                  ) : (
                    <div className="text-[13px] text-muted">
                      Других препятствий нет — мешает только корневая причина выше.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Panel>
  )
}

/** След решения: что предлагала система в момент назначения и что выбрали в итоге. */
function DecisionTrace({ ghost, bureau }: { ghost: GhostRequest; bureau: BureauState }) {
  const record = ghost.assignmentRecord
  if (!record) return null

  const differs =
    record.recommendedLocationId !== null &&
    record.recommendedLocationId !== ghost.assignedLocationId
  const recommendedName = bureau.locations.find(
    (location) => location.id === record.recommendedLocationId,
  )?.name

  return (
    <div className="rounded-lg border border-line bg-raised/50 p-3">
      <div className="mb-1 text-[11px] tracking-wide text-muted uppercase">Как принято решение</div>
      <div className="text-[13px] text-ink">{assignmentSourceLabel[record.source]}.</div>
      {differs ? (
        <div className="mt-1 text-[13px] text-warn">
          В момент назначения система рекомендовала «{recommendedName ?? record.recommendedLocationId}»
          с баллом {record.recommendedScore}; выбрано место с баллом {record.score} — разница{' '}
          {record.recommendedScore - record.score}.
        </div>
      ) : (
        <div className="mt-1 text-[13px] text-muted">
          Это и был лучший вариант по расчёту на момент назначения (балл {record.score}).
        </div>
      )}
      {record.warnings.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[11px] text-muted">Замечания, принятые оператором:</div>
          <ConflictList conflicts={record.warnings} dense />
        </div>
      )}
    </div>
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

  const recommendedLocation =
    recommendation === null
      ? null
      : (bureau.locations.find((location) => location.id === recommendation.locationId) ?? null)

  const blocking = currentMatch ? blockingOnly(currentMatch.conflicts) : []
  const needsReview = blocking.length > 0

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
            <DataRow
              label="Крайний срок"
              value={`${ghost.deadline} (${formatDeadline(ghost.deadline, now)})`}
            />
            <DataRow
              label="Источник решения"
              value={
                ghost.assignmentSource ? assignmentSourceLabel[ghost.assignmentSource] : '—'
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
          title={needsReview ? 'Размещение требует пересмотра' : 'Текущее размещение'}
          className={needsReview ? 'border-danger/40' : ''}
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={needsReview ? 'danger' : ghost.assignmentSource === 'manual' ? 'warn' : 'ok'}>
                {needsReview
                  ? 'условия нарушены'
                  : ghost.assignmentSource
                    ? assignmentSourceLabel[ghost.assignmentSource]
                    : 'размещена'}
              </Badge>
              <Button variant="ghost" onClick={() => dispatch({ type: 'unassign', ghostId: ghost.id })}>
                Освободить место
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            {needsReview && (
              <div className="rounded border border-danger/40 bg-danger/5 px-3 py-2">
                <div className="mb-1.5 text-[13px] text-ink">
                  Заявка размещена в «{assignedLocation.name}», но размещение больше не проходит
                  обязательные условия. Балл обнулён: пока нарушение не снято, место считается
                  недопустимым.
                </div>
                <ConflictList conflicts={blocking} dense />
              </div>
            )}

            <MatchExplanation
              match={currentMatch}
              location={assignedLocation}
              headline={needsReview ? 'Что даёт место само по себе' : 'Заявка размещена'}
              reasonsTitle={needsReview ? 'Сильные стороны места' : 'Почему это место'}
            />

            <DecisionTrace ghost={ghost} bureau={bureau} />

            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <Badge tone={isFull(assignedLocation) ? 'warn' : 'neutral'}>
                занято {assignedLocation.currentOccupancy} из {assignedLocation.capacity}
              </Badge>
              <Badge>{lightingLabel[assignedLocation.lighting]}</Badge>
              <Badge>{noiseLabel[assignedLocation.noise]}</Badge>
              <Badge>влажность {assignedLocation.humidity}%</Badge>
            </div>
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
                  type: 'accept_recommendation',
                  ghostId: ghost.id,
                  locationId: recommendation.locationId,
                })
              }
            >
              Принять рекомендацию
            </Button>
          </div>
        </Panel>
      )}

      {!assignedLocation && !recommendation && (
        <UnplacedPanel ghost={ghost} bureau={bureau} now={now} />
      )}

      <ManualAssign bureau={bureau} ghost={ghost} now={now} dispatch={dispatch} />
    </div>
  )
}
