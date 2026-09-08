import { formatDeadline, isOverdue } from '../domain/dates'
import type { BureauState, GhostRequest } from '../domain/types'
import { describeCondition } from '../domain/vocabulary'
import { Badge } from './components/primitives'

function statusBadge(ghost: GhostRequest, locationName: string | null, now: Date) {
  if (ghost.status === 'assigned' && locationName) {
    return (
      <Badge tone="ok">
        {locationName}
        {ghost.assignmentSource === 'manual' ? ' · вручную' : ''}
      </Badge>
    )
  }
  if (ghost.status === 'unassignable') return <Badge tone="danger">переселение невозможно</Badge>
  if (isOverdue(ghost.deadline, now)) return <Badge tone="danger">срок истёк</Badge>
  return <Badge>ожидает решения</Badge>
}

export function GhostList({
  bureau,
  now,
  selectedGhostId,
  onSelect,
}: {
  bureau: BureauState
  now: Date
  selectedGhostId: string | null
  onSelect: (ghostId: string) => void
}) {
  const locationName = (id: string | null) =>
    id === null ? null : (bureau.locations.find((location) => location.id === id)?.name ?? null)

  return (
    <ul className="space-y-1.5">
      {bureau.ghosts.map((ghost) => {
        const selected = ghost.id === selectedGhostId
        const overdue = isOverdue(ghost.deadline, now)
        return (
          <li key={ghost.id}>
            <button
              type="button"
              onClick={() => onSelect(ghost.id)}
              aria-current={selected}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                selected
                  ? 'border-accent/60 bg-accent/10'
                  : 'border-line bg-panel hover:border-accent/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">{ghost.name}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-muted">
                  тревожность {ghost.anxietyLevel}/10
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {statusBadge(ghost, locationName(ghost.assignedLocationId), now)}
                <Badge tone={overdue ? 'danger' : 'neutral'}>
                  {formatDeadline(ghost.deadline, now)}
                </Badge>
              </div>

              {ghost.specialConditions.length > 0 && (
                <div className="mt-1.5 text-[11px] text-muted">
                  {ghost.specialConditions.map(describeCondition).join(' · ')}
                </div>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
