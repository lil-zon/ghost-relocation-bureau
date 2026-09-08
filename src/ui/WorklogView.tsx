import type { ReactNode } from 'react'
import {
  aiMistakes,
  aiTools,
  developmentTime,
  engineeringDecisions,
  futureImprovements,
  humanDecisions,
  humanRole,
  keyPrompts,
  manualCorrections,
  reviewCycles,
  tokenUsage,
  verification,
  workflow,
} from '../data/worklog'
import { Badge, Panel } from './components/primitives'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="space-y-3">{children}</div>
    </Panel>
  )
}

export function WorklogView() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-panel px-4 py-3 text-[13px] text-muted">
        Журнал описывает фактический процесс разработки. Данные, которых среда разработки не
        предоставляет, помечены явно — оценок и восстановленных задним числом деталей здесь нет.
      </div>

      <Panel title="Роль человека и роль AI">
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-ink">{humanRole.summary}</p>
          <p className="text-[13px] text-muted">{humanRole.detail}</p>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="AI-инструменты">
          {aiTools.map((tool) => (
            <div key={tool.name} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
              <div className="text-[13px] font-semibold text-ink">{tool.name}</div>
              <p className="text-[13px] text-muted">{tool.role}</p>
            </div>
          ))}
        </Section>

        <Section title="Время разработки">
          <div className="text-[13px] font-semibold text-ink">{developmentTime.value}</div>
          <p className="text-[13px] text-muted">{developmentTime.method}</p>
        </Section>

        <Section title="Расход токенов">
          <div className="text-[13px] font-semibold text-ink">{tokenUsage.value}</div>
          <p className="text-[13px] text-muted">{tokenUsage.method}</p>
        </Section>
      </div>

      <Panel title="Ход работы">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                <th className="w-44 py-2 pr-3 font-medium">Этап</th>
                <th className="py-2 pr-3 font-medium">Что делал AI</th>
                <th className="py-2 font-medium">Что делал человек</th>
              </tr>
            </thead>
            <tbody>
              {workflow.map((stage) => (
                <tr key={stage.stage} className="border-b border-line/60 align-top last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-ink">{stage.stage}</td>
                  <td className="py-2.5 pr-3 text-muted">{stage.ai}</td>
                  <td className="py-2.5 text-ink">{stage.human}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Три цикла независимого ревью">
        <p className="mb-3 text-[11px] text-muted">
          Проверку проводила отдельная сессия Claude Opus 5 без контекста разработки: ревьюер
          получал только код, запускал его сам и писал собственные проверки.
        </p>
        <div className="space-y-3">
          {reviewCycles.map((cycle) => (
            <div key={cycle.round} className="rounded-lg border border-line bg-raised/50 p-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">{cycle.round}</span>
                <Badge tone="accent">{cycle.score}</Badge>
              </div>
              <p className="text-[13px] text-ink">{cycle.found}</p>
              <p className="mt-1.5 text-[13px] text-muted">{cycle.lesson}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Ключевые запросы">
          {keyPrompts.map((prompt) => (
            <div key={prompt.text} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
              <div className="mb-1 text-[11px] tracking-wide text-muted uppercase">
                {prompt.stage}
              </div>
              <p className="text-[13px] text-ink">{prompt.text}</p>
              <p className="mt-1 text-[11px] text-muted">{prompt.note}</p>
            </div>
          ))}
        </Section>

        <Section title="Решения, принятые человеком">
          {humanDecisions.map((item) => (
            <div key={item.decision} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
              <div className="text-[13px] font-semibold text-ink">{item.decision}</div>
              <p className="mt-1 text-[13px] text-muted">{item.rationale}</p>
            </div>
          ))}
        </Section>
      </div>

      <Panel title="Ключевые инженерные решения">
        <p className="mb-3 text-[11px] text-muted">
          Приняты AI в рамках поставленной задачи — человек в них не вмешивался. Приведены здесь,
          потому что объясняют, почему приложение устроено именно так.
        </p>
        <div className="grid gap-3 xl:grid-cols-2">
          {engineeringDecisions.map((item) => (
            <div key={item.decision} className="rounded-lg border border-line bg-raised/50 p-3">
              <div className="text-[13px] font-semibold text-ink">{item.decision}</div>
              <p className="mt-1 text-[13px] text-muted">{item.rationale}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Ошибки AI, замеченные в работе">
          {aiMistakes.map((item) => (
            <div key={item.mistake} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
              <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                <span className="text-[13px] font-semibold text-warn">{item.mistake}</span>
                <Badge tone={item.found === 'самопроверка' ? 'neutral' : 'warn'}>
                  {item.found}
                </Badge>
              </div>
              <p className="text-[13px] text-muted">{item.detail}</p>
              <p className="mt-1 text-[13px] text-ink">Исправление: {item.fix}</p>
            </div>
          ))}
        </Section>

        <Section title="Правки после AI-решений">
          <ul className="space-y-2">
            {manualCorrections.map((correction) => (
              <li key={correction} className="flex gap-2 text-[13px] text-ink">
                <span aria-hidden className="text-accent">
                  •
                </span>
                <span>{correction}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Выполненные проверки">
          <table className="w-full text-[13px]">
            <tbody>
              {verification.map((item) => (
                <tr key={item.command} className="border-b border-line/60 align-top last:border-0">
                  <td className="w-52 py-2 pr-3 font-mono text-[12px] text-accent">{item.command}</td>
                  <td className="py-2 text-ink">{item.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Что стоит улучшить дальше">
          <ol className="space-y-2">
            {futureImprovements.map((item, index) => (
              <li key={item} className="flex gap-2 text-[13px] text-ink">
                <span className="tabular-nums text-muted">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </div>
  )
}
