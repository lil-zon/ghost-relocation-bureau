import { useMemo, useState, type Dispatch } from 'react'
import { validateAssignment } from '../domain/assignment'
import { freeSlots, isFull } from '../domain/constraints'
import { plural } from '../domain/plural'
import type { BureauState, GhostRequest } from '../domain/types'
import type { AppAction } from '../state/store'
import { ConflictList } from './components/ConflictList'
import { Badge, Button, Panel } from './components/primitives'

/** Короткая пометка для выпадающего списка — оператор видит статус места до выбора. */
function optionSuffix(state: BureauState, ghost: GhostRequest, locationId: string, now: Date): string {
  const location = state.locations.find((item) => item.id === locationId)!
  if (ghost.assignedLocationId === locationId) return ' — текущее место'

  const validation = validateAssignment(state, ghost, location, now)
  if (!validation.valid) return ' — недоступно'

  const score = plural(validation.score, 'балл', 'балла', 'баллов')
  return validation.warnings.length > 0 ? ` — ${score}, есть замечания` : ` — ${score}`
}

export function ManualAssign({
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
  const [locationId, setLocationId] = useState<string>('')
  const [confirming, setConfirming] = useState(false)

  const location = bureau.locations.find((item) => item.id === locationId) ?? null

  const validation = useMemo(
    () => (location ? validateAssignment(bureau, ghost, location, now) : null),
    [bureau, ghost, location, now],
  )

  const alreadyHere = ghost.assignedLocationId === locationId && locationId !== ''

  function reset() {
    setConfirming(false)
  }

  function handlePrimary() {
    if (!validation || !location) return
    if (validation.requiresConfirmation && !confirming) {
      setConfirming(true)
      return
    }
    dispatch({
      type: 'manual_assign',
      ghostId: ghost.id,
      locationId: location.id,
      confirmed: validation.requiresConfirmation,
    })
    reset()
  }

  return (
    <Panel title="Ручной выбор места">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] tracking-wide text-muted uppercase">
            Выберите место
          </span>
          <select
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value)
              setConfirming(false)
            }}
            className="w-full rounded border border-line bg-raised px-3 py-2 text-[13px] text-ink"
          >
            <option value="">— не выбрано —</option>
            {bureau.locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {optionSuffix(bureau, ghost, item.id, now)}
              </option>
            ))}
          </select>
        </label>

        {location && validation && (
          <div className="space-y-3 rounded-lg border border-line bg-raised/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink">{location.name}</span>
                {isFull(location) ? (
                  <Badge tone="danger">
                    занято {location.currentOccupancy} из {location.capacity}
                  </Badge>
                ) : (
                  <Badge tone="neutral">свободно {freeSlots(location)}</Badge>
                )}
              </div>
              <div className="tabular-nums text-[13px] text-muted">
                балл {validation.score} / 100
              </div>
            </div>

            {alreadyHere && (
              <div className="text-[13px] text-muted">
                Заявка уже размещена здесь. Чтобы сменить место, выберите другое или освободите
                текущее.
              </div>
            )}

            {!alreadyHere && !validation.valid && (
              <div>
                <div className="mb-1 text-[13px] font-semibold text-danger">
                  Назначение запрещено — обязательные условия не выполнены
                </div>
                <ConflictList conflicts={validation.blocking} dense />
              </div>
            )}

            {!alreadyHere && validation.valid && validation.warnings.length > 0 && (
              <div>
                <div className="mb-1 text-[13px] font-semibold text-warn">
                  Место допустимо, но есть замечания
                </div>
                <ConflictList conflicts={validation.warnings} dense />
              </div>
            )}

            {!alreadyHere && validation.valid && validation.warnings.length === 0 && (
              <div className="text-[13px] text-ok">
                Замечаний нет: место соответствует всем условиям заявки.
              </div>
            )}

            {confirming && (
              <div className="rounded border border-warn/40 bg-warn/5 px-3 py-2 text-[13px] text-ink">
                Подтвердите решение: место выбрано вручную, несмотря на перечисленные замечания.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant={confirming ? 'danger' : 'primary'}
                disabled={!validation.valid || alreadyHere}
                onClick={handlePrimary}
                title={
                  !validation.valid
                    ? 'Есть блокирующий конфликт'
                    : alreadyHere
                      ? 'Заявка уже размещена здесь'
                      : undefined
                }
              >
                {alreadyHere
                  ? 'Уже размещено здесь'
                  : confirming
                    ? 'Подтвердить назначение'
                    : validation.requiresConfirmation
                      ? 'Назначить с замечаниями'
                      : 'Назначить'}
              </Button>
              {confirming && (
                <Button variant="ghost" onClick={reset}>
                  Отмена
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
