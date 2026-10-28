import { useState } from "react";
import type { JournalQuestVm } from "../store/ui-store";
import { useJournalIntents, useUi } from "../use-ui";

type Tab = "active" | "done" | "memories";

const KIND_LABEL: Record<JournalQuestVm["kind"], string> = { main: "Wątek główny", side: "Zadanie poboczne", contract: "Kontrakt" };

/**
 * Follow an active entry on the HUD, or stop following the one the player chose (the game then
 * picks again). The entry the game picked on its own says so and can be pinned.
 */
const TrackButton = ({ quest }: { quest: JournalQuestVm }) => {
  const { trackQuest } = useJournalIntents();
  if (quest.status !== "active" || quest.id === "contracts-done") return null;
  if (quest.pinned)
    return (
      <button type="button" className="journal__track journal__track--on" onClick={() => trackQuest(null)} data-testid={`journal-untrack-${quest.id}`}>
        Śledzone · przestań
      </button>
    );
  return (
    <button
      type="button"
      className={`journal__track${quest.tracked ? " journal__track--auto" : ""}`}
      onClick={() => trackQuest(quest.id)}
      data-testid={`journal-track-${quest.id}`}
    >
      {quest.tracked ? "Na HUD · przypnij" : "Śledź"}
    </button>
  );
};

const QuestEntry = ({ quest }: { quest: JournalQuestVm }) => (
  <li className={`journal__quest journal__quest--${quest.kind}${quest.tracked ? " journal__quest--tracked" : ""}`} data-testid={`journal-quest-${quest.id}`}>
    <div className="journal__kind">
      {KIND_LABEL[quest.kind]}
      <TrackButton quest={quest} />
    </div>
    <div className="journal__title">{quest.title}</div>
    <ol className="journal__steps">
      {quest.steps.map((step, i) => (
        <li key={i} className={step.done ? "journal__step journal__step--done" : "journal__step"}>
          {step.objective}
        </li>
      ))}
    </ol>
  </li>
);

const QuestList = ({ quests, empty }: { quests: readonly JournalQuestVm[]; empty: string }) =>
  quests.length === 0 ? (
    <p className="sheet__empty">{empty}</p>
  ) : (
    <ul className="journal__list">
      {quests.map((q) => (
        <QuestEntry key={q.id} quest={q} />
      ))}
    </ul>
  );

/** Dziennik tab of the character screen (J): active and finished jobs with their steps, and the memories Seki got back. */
export const JournalPanel = () => {
  const journal = useUi((s) => s.journal);
  const [tab, setTab] = useState<Tab>("active");

  const active = journal.quests.filter((q) => q.status === "active");
  const done = journal.quests.filter((q) => q.status === "completed");
  const tabs: readonly (readonly [Tab, string, number])[] = [
    ["active", "W toku", active.length],
    ["done", "Ukończone", done.length],
    ["memories", "Wspomnienia", journal.memories.length],
  ];

  return (
    <div className="sheet journal" data-testid="journal">
      <h2 className="sheet__name">Dziennik</h2>
      <div className="journal__tabs" role="tablist">
        {tabs.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`journal__tab${tab === id ? " journal__tab--on" : ""}`}
            onClick={() => setTab(id)}
          >
            {label} <span className="journal__count">{count}</span>
          </button>
        ))}
      </div>
      {tab === "active" && <QuestList quests={active} empty="Nic na teraz. Kaito pewnie coś znajdzie." />}
      {tab === "done" && <QuestList quests={done} empty="Jeszcze nic nie skończyłaś." />}
      {tab === "memories" &&
        (journal.memories.length === 0 ? (
          <p className="sheet__empty">Pustka. Na razie.</p>
        ) : (
          <ul className="journal__list">
            {journal.memories.map((m) => (
              <li key={m.id} className="journal__memory" data-testid={`journal-memory-${m.id}`}>
                <div className="journal__title">{m.title}</div>
                <p className="journal__desc">{m.description}</p>
              </li>
            ))}
          </ul>
        ))}
      <div className="sheet__hint">
        <kbd>J</kbd> zamknij · <kbd>I</kbd> ekwipunek · <kbd>Tab</kbd> karta postaci
      </div>
    </div>
  );
};
