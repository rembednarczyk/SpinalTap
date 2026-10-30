import { useState } from "react";
import type { MessageKey } from "../i18n/t";
import { useT } from "../i18n/use-t";
import type { JournalQuestVm } from "../store/ui-store";
import { useJournalIntents, useUi } from "../use-ui";

type Tab = "active" | "done" | "memories";

const KIND_LABEL: Record<JournalQuestVm["kind"], MessageKey> = { main: "journal.kind.main", side: "journal.kind.side", contract: "journal.kind.contract" };

/**
 * Follow an active entry on the HUD, or stop following the one the player chose (the game then
 * picks again). The entry the game picked on its own says so and can be pinned.
 */
const TrackButton = ({ quest }: { quest: JournalQuestVm }) => {
  const { trackQuest } = useJournalIntents();
  const t = useT();
  if (quest.status !== "active" || quest.id === "contracts-done") return null;
  if (quest.pinned)
    return (
      <button type="button" className="journal__track journal__track--on" onClick={() => trackQuest(null)} data-testid={`journal-untrack-${quest.id}`}>
        {t("journal.tracked")}
      </button>
    );
  return (
    <button
      type="button"
      className={`journal__track${quest.tracked ? " journal__track--auto" : ""}`}
      onClick={() => trackQuest(quest.id)}
      data-testid={`journal-track-${quest.id}`}
    >
      {quest.tracked ? t("journal.pin") : t("journal.track")}
    </button>
  );
};

const QuestEntry = ({ quest }: { quest: JournalQuestVm }) => {
  const t = useT();
  return (
    <li className={`journal__quest journal__quest--${quest.kind}${quest.tracked ? " journal__quest--tracked" : ""}`} data-testid={`journal-quest-${quest.id}`}>
      <div className="journal__kind">
        {t(KIND_LABEL[quest.kind])}
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
};

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
  const t = useT();

  const active = journal.quests.filter((q) => q.status === "active");
  const done = journal.quests.filter((q) => q.status === "completed");
  const tabs: readonly (readonly [Tab, string, number])[] = [
    ["active", t("journal.tab.active"), active.length],
    ["done", t("journal.tab.done"), done.length],
    ["memories", t("journal.tab.memories"), journal.memories.length],
  ];

  return (
    <div className="sheet journal" data-testid="journal">
      <h2 className="sheet__name">{t("journal.heading")}</h2>
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
      {tab === "active" && <QuestList quests={active} empty={t("journal.empty.active")} />}
      {tab === "done" && <QuestList quests={done} empty={t("journal.empty.done")} />}
      {tab === "memories" &&
        (journal.memories.length === 0 ? (
          <p className="sheet__empty">{t("journal.empty.memories")}</p>
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
        <kbd>J</kbd> {t("journal.hint.close")} · <kbd>I</kbd> {t("journal.hint.inventory")} · <kbd>Tab</kbd> {t("journal.hint.character")}
      </div>
    </div>
  );
};
