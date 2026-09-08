import { blockingOnly, detectBlockingConflicts, freeSlots, isFull } from './constraints'
import { isOverdue } from './dates'
import { explainExistingAssignment } from './matching'
import type {
  AssignmentSource,
  BureauState,
  Conflict,
  ConflictCode,
  GhostRequest,
  RelocationLocation,
} from './types'
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
  source: AssignmentSource
  /** Размещение перестало соответствовать правилам — например, истёк срок. */
  needsReview: boolean
  blocking: Conflict[]
}

export interface BureauReport {
  total: number
  assigned: number
  assignedAuto: number
  assignedAccepted: number
  assignedManual: number
  /** Размещения, которые больше не проходят обязательные условия. */
  needsReview: number
  /** Подходящее место есть, но занято. */
  awaitingCapacity: number
  /** Подходящего места не существует. */
  unassignable: number
  pending: number
  /** Просроченные заявки во всём реестре. */
  overdueTotal: number
  /** Просроченные среди тех, у кого нет места, — именно это подписывает плитку «без места». */
  overdueUnplaced: number
  /** Средний балл размещений без блокирующих конфликтов; null, если таких нет. */
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

  // Тот же расчёт, что показывает карточка заявки: сводка и деталь не могут разойтись.
  const assignedRows: AssignedRow[] = assignedGhosts.flatMap((ghost) => {
    const location = byLocationId.get(ghost.assignedLocationId as string)
    if (!location) return []
    const match = explainExistingAssignment(ghost, location, now)
    const blocking = blockingOnly(match.conflicts)
    return [
      {
        ghostId: ghost.id,
        ghostName: ghost.name,
        locationId: location.id,
        locationName: location.name,
        score: match.score,
        source: ghost.assignmentSource ?? 'auto',
        needsReview: blocking.length > 0,
        blocking,
      },
    ]
  })

  const healthy = assignedRows.filter((row) => !row.needsReview)
  const averageScore =
    healthy.length === 0
      ? null
      : Math.round(healthy.reduce((sum, row) => sum + row.score, 0) / healthy.length)

  const locations = state.locations.map(locationUsage)
  const countSource = (source: AssignmentSource) =>
    assignedGhosts.filter((ghost) => ghost.assignmentSource === source).length

  return {
    total: state.ghosts.length,
    assigned: assignedGhosts.length,
    assignedAuto: countSource('auto'),
    assignedAccepted: countSource('accepted'),
    assignedManual: countSource('manual'),
    needsReview: assignedRows.filter((row) => row.needsReview).length,
    awaitingCapacity: state.ghosts.filter((ghost) => ghost.status === 'awaiting_capacity').length,
    unassignable: state.ghosts.filter((ghost) => ghost.status === 'unassignable').length,
    pending: state.ghosts.filter(
      (ghost) => ghost.status === 'pending' && ghost.assignedLocationId === null,
    ).length,
    overdueTotal: state.ghosts.filter((ghost) => isOverdue(ghost.deadline, now)).length,
    overdueUnplaced: unplaced.filter((ghost) => isOverdue(ghost.deadline, now)).length,
    averageScore,
    totalCapacity: locations.reduce((sum, item) => sum + item.capacity, 0),
    totalOccupancy: locations.reduce((sum, item) => sum + item.occupancy, 0),
    totalFree: locations.reduce((sum, item) => sum + item.free, 0),
    locations,
    assignedRows,
    blockingReasons: collectBlockingReasons(unplaced, state.locations, now),
  }
}
