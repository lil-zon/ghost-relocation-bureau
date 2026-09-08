import {
  aiMistakes,
  aiTools,
  developmentTime,
  futureImprovements,
  humanDecisions,
  keyPrompts,
  manualCorrections,
  tokenUsage,
  verification,
  workflow,
} from '../data/worklog'
import { Panel } from './components/primitives'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="AI-инструменты">
          {aiTools.map((tool) => (
            <div key={tool.name}>
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
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
              <th className="w-40 py-2 pr-3 font-medium">Этап</th>
              <th className="py-2 pr-3 font-medium">Что делал AI</th>
              <th className="py-2 font-medium">Что решал и проверял разработчик</th>
            </tr>
          </thead>
          <tbody>
            {workflow.map((stage) => (
              <tr key={stage.stage} className="border-b border-line/60 align-top last:border-0">
                <td className="py-2.5 pr-3 font-semibold text-ink">{stage.stage}</td>
                <td className="py-2.5 pr-3 text-muted">{stage.ai}</td>
                <td className="py-2.5 text-ink">{stage.developer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Ключевые запросы">
          {keyPrompts.map((prompt) => (
            <div key={prompt.text} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
              <p className="text-[13px] text-ink">{prompt.text}</p>
              <p className="mt-1 text-[11px] text-muted">{prompt.note}</p>
            </div>
          ))}
        </Section>

        <Section title="Ключевые инженерные решения">
          {humanDecisions.map((item) => (
            <div key={item.decision} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
              <div className="text-[13px] font-semibold text-ink">{item.decision}</div>
              <p className="mt-1 text-[13px] text-muted">{item.rationale}</p>
            </div>
          ))}
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Ошибки AI, замеченные в работе">
          {aiMistakes.map((item) => (
            <div key={item.mistake} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
              <div className="text-[13px] font-semibold text-warn">{item.mistake}</div>
              <p className="mt-1 text-[13px] text-muted">{item.detail}</p>
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
