export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'

/** Цветовая интерпретация балла: одинаковая во всех экранах. */
export function scoreTone(score: number): Tone {
  if (score >= 80) return 'ok'
  if (score >= 55) return 'accent'
  if (score >= 35) return 'warn'
  return 'danger'
}
