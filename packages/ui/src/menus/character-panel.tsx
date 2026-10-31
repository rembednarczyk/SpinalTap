import {
  CYBERWARE_CATALOG,
  FACTION_IDS,
  FACTIONS,
  MEMORY_CATALOG,
  type MemoryId,
  reputationTier,
  stanceOf,
} from "@seki/core";
import { useT, useText } from "../i18n/use-t";
import { useUi } from "../use-ui";

const SLOTS = ["optics", "nervous", "skeleton", "arms"] as const;

/** Sheet tab of the character screen (Tab): implants, recovered memories, standing with factions. */
export const CharacterPanel = () => {
  const t = useT();
  const tx = useText();
  const alias = useUi((s) => s.alias);
  const loadout = useUi((s) => s.cyberware);
  const memories = useUi((s) => s.memories);
  const reputation = useUi((s) => s.reputation);
  const contractsDone = useUi((s) => s.contractsDone);

  return (
    <div className="sheet" data-testid="character-panel">
      <h2 className="sheet__name">{alias ?? t("character.unknown")}</h2>
      <div className="sheet__sub">{t("character.contracts", { count: contractsDone })}</div>
      <section>
        <h3 className="sheet__h">{t("character.cyberware")}</h3>
        <dl className="sheet__list">
          {SLOTS.map((slot) => {
            const id = loadout[slot];
            return (
              <div key={slot} className="sheet__row">
                <dt>{t(`character.slot.${slot}`)}</dt>
                <dd>{id ? tx(CYBERWARE_CATALOG[id].name) : t("character.emptySlot")}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      <section>
        <h3 className="sheet__h">{t("character.memories")}</h3>
        {memories.length === 0 ? (
          <p className="sheet__empty">{t("character.noMemories")}</p>
        ) : (
          <ul className="sheet__memories">
            {memories.map((id) => (
              <li key={id}>{MEMORY_CATALOG[id as MemoryId]?.title ?? id}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="sheet__h">{t("character.reputation")}</h3>
        <dl className="sheet__list">
          {FACTION_IDS.map((f) => (
            <div key={f} className="sheet__row" data-testid={`rep-${f}`}>
              <dt>{FACTIONS[f]}</dt>
              <dd>
                {reputation[f] > 0 ? "+" : ""}
                {reputation[f]} · {t(`character.tier.${reputationTier(reputation[f])}`)}
                <div className={`sheet__effect sheet__effect--${stanceOf(reputation[f])}`}>{t(`character.effect.${f}.${stanceOf(reputation[f])}`)}</div>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="sheet__hint">
        <kbd>Tab</kbd> {t("character.hint.close")} · <kbd>I</kbd> {t("character.hint.inventory")} · <kbd>J</kbd> {t("character.hint.journal")}
      </div>
    </div>
  );
};
