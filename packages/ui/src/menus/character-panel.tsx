import { useEffect, useState } from "react";
import { CYBERWARE_CATALOG, FACTIONS, type FactionId, MEMORY_CATALOG, type MemoryId, reputationTier } from "@seki/core";
import { useUi } from "../use-ui";

const TIER: Record<string, string> = { hostile: "wrogość", wary: "nieufność", neutral: "neutralnie", friendly: "sympatia", trusted: "zaufanie" };
const SLOTS = [
  ["optics", "Optyka"],
  ["nervous", "Układ nerwowy"],
  ["skeleton", "Szkielet"],
  ["arms", "Ramiona"],
] as const;

/** Character sheet on Tab: implants, recovered memories, standing with factions. */
export const CharacterPanel = () => {
  const [open, setOpen] = useState(false);
  const alias = useUi((s) => s.alias);
  const loadout = useUi((s) => s.cyberware);
  const memories = useUi((s) => s.memories);
  const reputation = useUi((s) => s.reputation);
  const contractsDone = useUi((s) => s.contractsDone);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Tab") return;
      e.preventDefault();
      if (!e.repeat) setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return (
    <div className="sheet" data-testid="character-panel">
      <h2 className="sheet__name">{alias ?? "Nieznana"}</h2>
      <div className="sheet__sub">Kontrakty dla Kaito: {contractsDone}</div>
      <section>
        <h3 className="sheet__h">Cyberware</h3>
        <dl className="sheet__list">
          {SLOTS.map(([slot, label]) => {
            const id = loadout[slot];
            return (
              <div key={slot} className="sheet__row">
                <dt>{label}</dt>
                <dd>{id ? CYBERWARE_CATALOG[id].name : "pusty slot"}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      <section>
        <h3 className="sheet__h">Wspomnienia</h3>
        {memories.length === 0 ? (
          <p className="sheet__empty">Pustka. Na razie.</p>
        ) : (
          <ul className="sheet__memories">
            {memories.map((id) => (
              <li key={id}>{MEMORY_CATALOG[id as MemoryId]?.title ?? id}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="sheet__h">Reputacja</h3>
        <dl className="sheet__list">
          {(Object.keys(FACTIONS) as FactionId[]).map((f) => (
            <div key={f} className="sheet__row">
              <dt>{FACTIONS[f]}</dt>
              <dd>
                {reputation[f] > 0 ? "+" : ""}
                {reputation[f]} · {TIER[reputationTier(reputation[f])]}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="sheet__hint">
        <kbd>Tab</kbd> zamknij
      </div>
    </div>
  );
};
