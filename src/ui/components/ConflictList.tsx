import type { Conflict } from '../../domain/types'
import { conflictCodeLabel } from '../../domain/vocabulary'
import { Badge } from './primitives'

/**
 * Показывает конфликты вместе с их серьёзностью: оператор должен видеть
 * не только «что не так», но и насколько это критично.
 */
export function ConflictList({ conflicts, dense = false }: { conflicts: Conflict[]; dense?: boolean }) {
  if (conflicts.length === 0) return null

  return (
    <ul className={dense ? 'space-y-1' : 'space-y-2'}>
      {conflicts.map((conflict, index) => (
        <li
          key={`${conflict.code}-${index}`}
          className={`flex items-start gap-2 rounded border px-2.5 py-1.5 ${
            conflict.severity === 'blocking'
              ? 'border-danger/30 bg-danger/5'
              : 'border-warn/30 bg-warn/5'
          }`}
        >
          <Badge tone={conflict.severity === 'blocking' ? 'danger' : 'warn'}>
            {conflict.severity === 'blocking' ? 'блокирует' : 'внимание'}
          </Badge>
          <div className="min-w-0">
            <div className="text-[13px] text-ink">{conflict.message}</div>
            <div className="text-[11px] text-muted">{conflictCodeLabel[conflict.code]}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}
