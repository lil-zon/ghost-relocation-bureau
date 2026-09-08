import { useState } from 'react'
import { clearBackup, readBackup } from '../../state/persistence'
import { Button } from './primitives'

/**
 * Панель резервной копии.
 *
 * Если сохранённое состояние не удалось прочитать, его содержимое откладывается
 * в отдельный ключ. Без способа его достать такая копия бесполезна, поэтому
 * оператор может скачать её файлом или удалить осознанно.
 */
export function BackupNotice() {
  const [backup, setBackup] = useState<string | null>(() => readBackup())
  const [failure, setFailure] = useState<string | null>(null)

  if (backup === null) return null

  function download(content: string) {
    try {
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'ghost-relocation-bureau-backup.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setFailure(null)
    } catch {
      setFailure(
        'Браузер не разрешил сохранить файл. Скопируйте содержимое из блока ниже вручную.',
      )
    }
  }

  return (
    <div className="rounded-lg border border-warn/50 bg-warn/5 px-4 py-3 text-[13px]">
      <div className="text-ink">
        Сохранена резервная копия нечитаемых данных бюро ({backup.length.toLocaleString('ru-RU')}{' '}
        символов). Скачайте её, если содержимое важно, или удалите, если данные не нужны.
      </div>

      {failure && <div className="mt-2 text-danger">{failure}</div>}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={() => download(backup)}>Скачать резервную копию</Button>
        <Button
          variant="ghost"
          onClick={() => {
            clearBackup()
            setBackup(null)
          }}
        >
          Удалить копию
        </Button>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-muted">Показать содержимое</summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-surface p-2 text-[11px] break-all whitespace-pre-wrap text-muted">
          {backup}
        </pre>
      </details>
    </div>
  )
}
