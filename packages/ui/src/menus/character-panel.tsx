import {
  CYBERWARE_CATALOG,
  FACTION_IDS,
  FACTIONS,
  type FactionId,
  type FactionStance,
  MEMORY_CATALOG,
  type MemoryId,
  reputationTier,
  stanceOf,
} from "@seki/core";
import { useUi } from "../use-ui";

const TIER: Record<string, string> = { hostile: "wrogość", wary: "nieufność", neutral: "neutralnie", friendly: "sympatia", trusted: "zaufanie" };
/** What each faction's stance means on the street, in one line. */
const CONSEQUENCE: Readonly<Record<FactionId, Readonly<Record<FactionStance, string>>>> = {
  fixers: { hostile: "Kaito płaci mniej", neutral: "Zwykłe stawki", friendly: "Kaito płaci więcej" },
  hebi: { hostile: "Polują na ciebie", neutral: "Strzelają bez ostrzeżenia", friendly: "Nie strzelają pierwsi" },
  civilians: { hostile: "Uciekają przed tobą", neutral: "Nie zwracają uwagi", friendly: "Witają cię na ulicy" },
  clinic: { hostile: "Mori cię nie obsłuży", neutral: "Ceny katalogowe", friendly: "Rabat u Mori" },
  kagami: { hostile: "Czyściciele Kagami cię szukają", neutral: "Numer w ich archiwum", friendly: "Kagami ma cię za swoją" },
};

const SLOTS = [
  ["optics", "Optyka"],
  ["nervous", "Układ nerwowy"],
  ["skeleton", "Szkielet"],
  ["arms", "Ramiona"],
] as const;

/** Karta tab of the character screen (Tab): implants, recovered memories, standing with factions. */
export const CharacterPanel = () => {
  const alias = useUi((s) => s.alias);
  const loadout = useUi((s) => s.cyberware);
  const memories = useUi((s) => s.memories);
  const reputation = useUi((s) => s.reputation);
  const contractsDone = useUi((s) => s.contractsDone);

  return (
    <div className="sheet" data-testid="character-panel">
      <h2 className="sheet__name">{alias ?? "Nieznana"}</h2>
      <div className="sheet__sub">Wykonane kontrakty: {contractsDone}</div>
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
          {FACTION_IDS.map((f) => (
            <div key={f} className="sheet__row" data-testid={`rep-${f}`}>
              <dt>{FACTIONS[f]}</dt>
              <dd>
                {reputation[f] > 0 ? "+" : ""}
                {reputation[f]} · {TIER[reputationTier(reputation[f])]}
                <div className={`sheet__effect sheet__effect--${stanceOf(reputation[f])}`}>{CONSEQUENCE[f][stanceOf(reputation[f])]}</div>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="sheet__hint">
        <kbd>Tab</kbd> zamknij · <kbd>I</kbd> ekwipunek · <kbd>J</kbd> dziennik
      </div>
    </div>
  );
};
