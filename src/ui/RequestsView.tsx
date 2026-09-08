import type { Dispatch } from 'react'
import type { AppAction, AppState } from '../state/store'
import { Button, EmptyState, Panel } from './components/primitives'
import { GhostDetail } from './GhostDetail'
import { GhostList } from './GhostList'

export function RequestsView({
  state,
  dispatch,
}: {
  state: AppState
  dispatch: Dispatch<AppAction>
}) {
  const { bureau, now, selectedGhostId } = state

  if (bureau.ghosts.length === 0) {
    return (
      <EmptyState
        title="В реестре нет заявок"
        description="Заявки от привидений ещё не поступали. Загрузите демонстрационный набор — на нём видны все режимы работы бюро: обычный подбор, конкуренция за единственное подходящее место, просроченный срок, размещение, которое перестало проходить условия, и случай, когда переселение невозможно."
        action={
          <Button variant="primary" onClick={() => dispatch({ type: 'load_demo' })}>
            Загрузить демо-данные
          </Button>
        }
      />
    )
  }

  const selected =
    bureau.ghosts.find((ghost) => ghost.id === selectedGhostId) ?? bureau.ghosts[0] ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
      <Panel title={`Заявки · ${bureau.ghosts.length}`} className="self-start">
        <GhostList
          bureau={bureau}
          now={now}
          selectedGhostId={selected?.id ?? null}
          onSelect={(ghostId) => dispatch({ type: 'select_ghost', ghostId })}
        />
      </Panel>

      {selected ? (
        <GhostDetail bureau={bureau} ghost={selected} now={now} dispatch={dispatch} />
      ) : (
        <EmptyState
          title="Заявка не выбрана"
          description="Выберите заявку в списке слева, чтобы увидеть рекомендацию, объяснение решения и возможность назначить место вручную."
        />
      )}
    </div>
  )
}
