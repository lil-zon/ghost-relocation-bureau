import { isoDateOffset } from '../dates'
import type { GhostRequest, RelocationLocation } from '../types'

/** Фиксированная «текущая дата» — доменные функции детерминированы относительно неё. */
export const NOW = new Date(2026, 8, 8)

export function makeGhost(overrides: Partial<GhostRequest> = {}): GhostRequest {
  return {
    id: 'g-test',
    name: 'Тестовое привидение',
    anxietyLevel: 4,
    preferredTemperature: 12,
    deadline: isoDateOffset(NOW, 10),
    specialConditions: [],
    status: 'pending',
    assignedLocationId: null,
    assignmentSource: null,
    assignmentRecord: null,
    summary: 'Фикстура',
    ...overrides,
  }
}

export function makeLocation(overrides: Partial<RelocationLocation> = {}): RelocationLocation {
  return {
    id: 'loc-test',
    name: 'Тестовое место',
    type: 'castle',
    capacity: 2,
    currentOccupancy: 0,
    temperature: 12,
    lighting: 'dim',
    noise: 'quiet',
    humidity: 65,
    humansPresent: false,
    hasAttic: true,
    hasMirrors: false,
    restrictions: [],
    ...overrides,
  }
}

export function codes(conflicts: Array<{ code: string }>): string[] {
  return conflicts.map((conflict) => conflict.code)
}
