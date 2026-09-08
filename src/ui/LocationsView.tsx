import { freeSlots, isFull } from '../domain/constraints'
import { plural } from '../domain/plural'
import type { AppState } from '../state/store'
import { describeRestriction, lightingLabel, locationTypeLabel, noiseLabel } from '../domain/vocabulary'
import { Badge, Meter, Panel } from './components/primitives'

export function LocationsView({ state }: { state: AppState }) {
  const { bureau } = state

  const residents = (locationId: string) =>
    bureau.ghosts.filter((ghost) => ghost.assignedLocationId === locationId)

  return (
    <Panel title={`Места переселения · ${bureau.locations.length}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
              <th className="py-2 pr-3 font-medium">Место</th>
              <th className="py-2 pr-3 font-medium">Занятость</th>
              <th className="py-2 pr-3 font-medium">Среда</th>
              <th className="py-2 pr-3 font-medium">Особенности</th>
              <th className="py-2 font-medium">Кто размещён</th>
            </tr>
          </thead>
          <tbody>
            {bureau.locations.map((location) => {
              const full = isFull(location)
              const placed = residents(location.id)
              return (
                <tr key={location.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-ink">{location.name}</div>
                    <div className="text-[11px] text-muted">{locationTypeLabel[location.type]}</div>
                  </td>

                  <td className="w-40 py-2.5 pr-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="tabular-nums text-ink">
                        {location.currentOccupancy} / {location.capacity}
                      </span>
                      {full ? (
                        <Badge tone="danger">заполнено</Badge>
                      ) : (
                        <Badge tone="ok">свободно {freeSlots(location)}</Badge>
                      )}
                    </div>
                    <Meter
                      value={location.currentOccupancy}
                      max={location.capacity}
                      tone={full ? 'danger' : 'ok'}
                    />
                  </td>

                  <td className="py-2.5 pr-3 text-muted">
                    <div className="text-ink">{location.temperature} °C</div>
                    <div>
                      {lightingLabel[location.lighting]} · {noiseLabel[location.noise]}
                    </div>
                    <div>влажность {location.humidity}%</div>
                  </td>

                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1.5">
                      {location.hasAttic && <Badge tone="accent">есть чердак</Badge>}
                      {location.hasMirrors && <Badge tone="warn">зеркала</Badge>}
                      {location.humansPresent && <Badge tone="warn">рядом люди</Badge>}
                      {location.restrictions.map((restriction) => (
                        <Badge key={restriction.kind} tone="danger" title={describeRestriction(restriction)}>
                          {restriction.kind === 'no_new_residents'
                            ? 'закрыто для заселения'
                            : `тревожность ≤ ${restriction.value}`}
                        </Badge>
                      ))}
                      {!location.hasAttic &&
                        !location.hasMirrors &&
                        !location.humansPresent &&
                        location.restrictions.length === 0 && (
                          <span className="text-[11px] text-muted">без особенностей</span>
                        )}
                    </div>
                    {location.restrictions.map((restriction) => (
                      <div key={`text-${restriction.kind}`} className="mt-1 text-[11px] text-muted">
                        {describeRestriction(restriction)}
                      </div>
                    ))}
                  </td>

                  <td className="py-2.5">
                    {placed.length === 0 ? (
                      <span className="text-[11px] text-muted">
                        {location.currentOccupancy > 0
                          ? `${plural(location.currentOccupancy, 'прежний жилец', 'прежних жильца', 'прежних жильцов')}, не из текущего реестра`
                          : 'никого'}
                      </span>
                    ) : (
                      <ul className="space-y-0.5">
                        {placed.map((ghost) => (
                          <li key={ghost.id} className="text-ink">
                            {ghost.name}
                            {ghost.assignmentSource === 'manual' && (
                              <span className="text-[11px] text-muted"> · вручную</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
