import type { ReactNode } from 'react'
import type { Tone } from './tone'

const toneClasses: Record<Tone, string> = {
  neutral: 'border-line bg-raised text-muted',
  accent: 'border-accent/40 bg-accent/10 text-accent',
  ok: 'border-ok/40 bg-ok/10 text-ok',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  danger: 'border-danger/40 bg-danger/10 text-danger',
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: Tone
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-tight whitespace-nowrap ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}

export function Panel({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-semibold tracking-wide text-ink uppercase">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  title,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
}) {
  const variants = {
    default: 'border-line bg-raised text-ink hover:border-accent/50',
    primary: 'border-accent/50 bg-accent/15 text-accent hover:bg-accent/25',
    danger: 'border-danger/50 bg-danger/10 text-danger hover:bg-danger/20',
    ghost: 'border-transparent bg-transparent text-muted hover:text-ink',
  }
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]}`}
    >
      {children}
    </button>
  )
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: Tone
}) {
  const valueTone: Record<Tone, string> = {
    neutral: 'text-ink',
    accent: 'text-accent',
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
  }
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <div className="text-[11px] tracking-wide text-muted uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueTone[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  )
}

/** Горизонтальная шкала заполнения: используется для баллов и загрузки мест. */
export function Meter({ value, max = 100, tone = 'accent' }: { value: number; max?: number; tone?: Tone }) {
  const ratio = max === 0 ? 0 : Math.min(1, Math.max(0, value / max))
  const fill: Record<Tone, string> = {
    neutral: 'bg-muted',
    accent: 'bg-accent',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
  }
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised" role="presentation">
      <div className={`h-full rounded-full ${fill[tone]}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-panel px-6 py-14 text-center">
      <div className="text-base font-semibold text-ink">{title}</div>
      <p className="max-w-md text-sm text-muted">{description}</p>
      {action}
    </div>
  )
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right text-[13px] text-ink">{value}</span>
    </div>
  )
}
