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
import { useUnspentPoints } from "../hud/xp-hud";
import { XpMeter } from "../progress/xp-meter";
import { useUi } from "../use-ui";
import { OverPool } from "../shop/capacity-bar";

const SLOTS = ["optics", "nervous", "skeleton", "arms"] as const;

/**
 * The level, the XP bar and the points left, with a way to the Progress tab where they are spent
 * (ADR-0059, stage 7: the attributes and perks moved there from the sheet).
 */
const LevelSummary = () => {
  const t = useT();
  const level = useUi((s) => s.level);
  const points = useUnspentPoints();
  const show = useUi((s) => s.showCharacterTab);
  return (
    <section className="sheet__level" data-testid="sheet-level">
      <div className="sheet__sub">
        {t("attribute.level", { level })}
        {points > 0 && <> · {t("progress.unspent", { count: points })}</>}
      </div>
      <XpMeter className="progress__xp" testId="sheet-xp" />
      {points > 0 && (
        <button type="button" className="sheet__to-progress" onClick={() => show("progress")}>
          {t("progress.open")}
        </button>
      )}
    </section>
  );
};

/** Sheet tab of the character screen (Tab): level, implants, recovered memories, standing with factions. */
export const CharacterPanel = () => {
  const t = useT();
  const tx = useText();
  const alias = useUi((s) => s.alias);
  const loadout = useUi((s) => s.cyberware);
  const capacity = useUi((s) => s.capacity);
  const memories = useUi((s) => s.memories);
  const reputation = useUi((s) => s.reputation);
  const contractsDone = useUi((s) => s.contractsDone);
  // Implants over the pool are off (stage 3c): their row says so.
  const off = new Set(capacity?.inactive ?? []);

  return (
    <div className="sheet" data-testid="character-panel">
      <h2 className="sheet__name">{alias ?? t("character.unknown")}</h2>
      <div className="sheet__sub">{t("character.contracts", { count: contractsDone })}</div>
      <LevelSummary />
      <section>
        <h3 className="sheet__h">{t("character.cyberware")}</h3>
        <dl className="sheet__list">
          {SLOTS.map((slot) => {
            const id = loadout[slot];
            return (
              <div key={slot} className="sheet__row" data-testid={`sheet-implant-${slot}`}>
                <dt>{t(`character.slot.${slot}`)}</dt>
                <dd>
                  {id ? tx(CYBERWARE_CATALOG[id].name) : t("character.emptySlot")}
                  {id && off.has(id) && <div className="sheet__effect sheet__effect--hostile">⊘ {t("character.implantOff")}</div>}
                </dd>
              </div>
            );
          })}
          {capacity && (
            <div className="sheet__row" data-testid="sheet-capacity">
              <dt>{t("shop.capacity.label")}</dt>
              <dd>
                {capacity.used} / {capacity.max}
              </dd>
            </div>
          )}
        </dl>
        <OverPool />
      </section>
      <section>
        <h3 className="sheet__h">{t("character.memories")}</h3>
        {memories.length === 0 ? (
          <p className="sheet__empty">{t("character.noMemories")}</p>
        ) : (
          <ul className="sheet__memories">
            {memories.map((id) => (
              <li key={id}>{tx(MEMORY_CATALOG[id as MemoryId]?.title ?? id)}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="sheet__h">{t("character.reputation")}</h3>
        <dl className="sheet__list">
          {FACTION_IDS.map((f) => (
            <div key={f} className="sheet__row" data-testid={`rep-${f}`}>
              <dt>{t(FACTIONS[f])}</dt>
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
