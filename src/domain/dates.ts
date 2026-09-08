import { plural } from './plural'

/** Работа с дедлайнами. Все функции принимают `now` явно — ради детерминизма и тестируемости. */

/** Заявка считается срочной, если до дедлайна осталось столько дней или меньше. */
export const DEADLINE_SOON_DAYS = 3

/** Разбирает ISO-дату (YYYY-MM-DD) как локальную полночь, без сдвига часового пояса. */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Сколько целых дней осталось до дедлайна. Отрицательное значение — просрочено. */
export function daysUntilDeadline(deadline: string, now: Date): number {
  const diff = parseIsoDate(deadline).getTime() - startOfDay(now).getTime()
  return Math.round(diff / 86_400_000)
}

export function isOverdue(deadline: string, now: Date): boolean {
  return daysUntilDeadline(deadline, now) < 0
}

export function isDeadlineSoon(deadline: string, now: Date): boolean {
  const days = daysUntilDeadline(deadline, now)
  return days >= 0 && days <= DEADLINE_SOON_DAYS
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** ISO-дата, сдвинутая на указанное число дней относительно `now`. */
export function isoDateOffset(now: Date, offsetDays: number): string {
  const date = startOfDay(now)
  date.setDate(date.getDate() + offsetDays)
  return toIsoDate(date)
}

export function formatDeadline(deadline: string, now: Date): string {
  const days = daysUntilDeadline(deadline, now)
  if (days < 0) return `просрочен на ${plural(-days, 'день', 'дня', 'дней')}`
  if (days === 0) return 'истекает сегодня'
  return `осталось ${plural(days, 'день', 'дня', 'дней')}`
}
