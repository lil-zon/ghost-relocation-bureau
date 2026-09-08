import { detectBlockingConflicts, freeSlots, isFull } from './constraints'
import { isOverdue } from './dates'
import { scoreLocation } from './scoring'
import type { BureauState, ConflictCode, GhostRequest, RelocationLocation } from './types'
import { conflictCodeLabel } from './vocabulary'

export interface LocationUsage {
  locationId: string
  name: string
  capacity: number
  occupancy: number
  free: number
  /** Заполненность 0..1. */
  utilization: number
  full: boolean
}

export interface BlockingReasonStat {
  code: ConflictCode
  label: string
  /** Сколько раз причина встретилась среди нераспределённых заявок. */
  count: number
}

export interface AssignedRow {
  ghostId: string
  ghostName: string
  locationId: string
  locationName: string
  score: number
  source: 'auto' | 'manual'
}

export interface BureauReport {
  total: number
  assigned: number
  assignedAuto: number
  assignedManual: number
  unassignable: number
  pending: number
  overdue: number
  /** Средний балл размещённых заявок; null, если размещённых нет. */
  averageScore: number | null
  totalCapacity: number
  totalOccupancy: number
  totalFree: number
  locations: LocationUsage[]
  assignedRows: AssignedRow[]
  blockingReasons: BlockingReasonStat[]
}

function locationUsage(location: RelocationLocation): LocationUsage {
  return {
    locationId: location.id,
    name: location.name,
    capacity: location.capacity,
    occupancy: location.currentOccupancy,
    free: freeSlots(location),
    utilization: location.capacity === 0 ? 1 : location.currentOccupancy / location.capacity,
    full: isFull(location),
  }
}

/**
 * Почему нераспределённые заявки не удалось разместить: считаем, как часто
 * встречается каждая блокирующая причина по всем парам «заявка × место».
 */
function collectBlockingReasons(
  unplaced: GhostRequest[],
  locations: RelocationLocation[],
  now: Date,
): BlockingReasonStat[] {
  const counts = new Map<ConflictCode, number>()

  for (const ghost of unplaced) {
    for (const location of locations) {
      for (const conflict of detectBlockingConflicts(ghost, location, now)) {
        counts.set(conflict.code, (counts.get(conflict.code) ?? 0) + 1)
      }
    }
  }

  return [...counts.entries()]
    .map(([code, count]) => ({ code, label: conflictCodeLabel[code], count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.code.localeCompare(b.code)))
}

export function buildReport(state: BureauState, now: Date): BureauReport {
  const byLocationId = new Map(state.locations.map((location) => [location.id, location]))

  const assignedGhosts = state.ghosts.filter((ghost) => ghost.assignedLocationId !== null)
  const unplaced = state.ghosts.filter((ghost) => ghost.assignedLocationId === null)

  const assignedRows: AssignedRow[] = assignedGhosts.flatMap((ghost) => {
    const location = byLocationId.get(ghost.assignedLocationId as string)
    if (!location) return []
    return [
      {
        ghostId: ghost.id,
        ghostName: ghost.name,
        locationId: location.id,
        locationName: location.name,
        score: scoreLocation(ghost, location).total,
        source: ghost.assignmentSource ?? 'auto',
      },
    ]
  })

  const averageScore =
    assignedRows.length === 0
      ? null
      : Math.round(
          assignedRows.reduce((sum, row) => sum + row.score, 0) / assignedRows.length,
        )

  const locations = state.locations.map(locationUsage)

  return {
    total: state.ghosts.length,
    assigned: assignedGhosts.length,
    assignedAuto: assignedGhosts.filter((ghost) => ghost.assignmentSource === 'auto').length,
    assignedManual: assignedGhosts.filter((ghost) => ghost.assignmentSource === 'manual').length,
    unassignable: state.ghosts.filter((ghost) => ghost.status === 'unassignable').length,
    pending: state.ghosts.filter(
      (ghost) => ghost.status === 'pending' && ghost.assignedLocationId === null,
    ).length,
    overdue: state.ghosts.filter((ghost) => isOverdue(ghost.deadline, now)).length,
    averageScore,
    totalCapacity: locations.reduce((sum, item) => sum + item.capacity, 0),
    totalOccupancy: locations.reduce((sum, item) => sum + item.occupancy, 0),
    totalFree: locations.reduce((sum, item) => sum + item.free, 0),
    locations,
    assignedRows,
    blockingReasons: collectBlockingReasons(unplaced, state.locations, now),
  }
}
