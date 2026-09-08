import type { MatchResult, RelocationLocation } from '../../domain/types'
import { ConflictList } from './ConflictList'
import { Badge, Meter } from './primitives'
import { scoreTone } from './tone'

/** Классы перечислены статически: Tailwind не видит классы, собранные в шаблонной строке. */
const SCORE_TEXT_CLASS = {
  ok: 'text-ok',
  accent: 'text-accent',
  warn: 'text-warn',
  danger: 'text-danger',
  neutral: 'text-ink',
} as const

/**
 * Объяснение решения. Все тексты берутся из результата матчинга,
 * поэтому UI не может «объяснить» то, чего не считал доменный слой.
 */
export function MatchExplanation({
  match,
  location,
  headline,
  reasonsTitle = 'Почему это место',
}: {
  match: MatchResult
  location: RelocationLocation
  headline?: string
  /** Заголовок списка причин: у нарушенного размещения он не должен звучать как оправдание. */
  reasonsTitle?: string
}) {
  const tone = scoreTone(match.score)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {headline && <div className="text-[11px] tracking-wide text-muted uppercase">{headline}</div>}
          <div className="text-base font-semibold text-ink">{location.name}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">
            <span className={SCORE_TEXT_CLASS[tone]}>{match.score}</span>
            <span className="text-sm text-muted"> / 100</span>
          </div>
        </div>
      </div>

      <Meter value={match.score} tone={tone} />

      {match.reasons.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] tracking-wide text-muted uppercase">{reasonsTitle}</div>
          <ul className="space-y-1">
            {match.reasons.map((reason) => (
              <li key={reason} className="flex gap-2 text-[13px] text-ink">
                <span aria-hidden className="text-ok">
                  •
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-1 text-[11px] tracking-wide text-muted uppercase">Из чего сложился балл</div>
        <table className="w-full text-[13px]">
          <tbody>
            {match.breakdown.components.map((component) => (
              <tr key={component.key} className="border-b border-line/60 last:border-0">
                <td className="py-1.5 pr-3 align-top whitespace-nowrap text-muted">
                  {component.label}
                  {component.boosted && (
                    <span className="ml-1.5">
                      <Badge tone="warn" title="Вес компонента усилен из-за высокой тревожности">
                        вес ↑
                      </Badge>
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3 align-top text-ink">{component.detail}</td>
                <td className="w-24 py-1.5 text-right align-top tabular-nums">
                  <span className="text-ink">{component.points}</span>
                  <span className="text-muted"> / {component.maxPoints}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {match.conflicts.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] tracking-wide text-muted uppercase">Замечания</div>
          <ConflictList conflicts={match.conflicts} dense />
        </div>
      )}
    </div>
  )
}
