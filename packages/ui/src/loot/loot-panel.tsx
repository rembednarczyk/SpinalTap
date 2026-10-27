import { RARITY } from "@seki/core";
import { useEffect } from "react";
import { useIntents, useUi } from "../use-ui";

/**
 * A searched bag (ADR-0015): the lines with quantities and rarity labels, one button per line
 * and "Weź wszystko". The world goes on meanwhile, as at the clinic counter; E takes all (so
 * a double E on a bag empties it), Esc leaves it.
 */
export const LootPanel = () => {
  const loot = useUi((s) => s.loot);
  const intents = useIntents();

  useEffect(() => {
    if (!loot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") intents.closeLoot();
      else if (e.key === "e" || e.key === "E") intents.takeLoot("all");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loot, intents]);

  if (!loot) return null;
  return (
    <div className="loot" data-testid="loot" role="dialog" aria-label="Zawartość torby">
      <header className="loot__head">
        <div className="loot__eyebrow">Torba</div>
        <h2 className="loot__title">{loot.title}</h2>
      </header>
      {loot.lines.length === 0 ? (
        <p className="loot__empty">Pusto.</p>
      ) : (
        <ul className="loot__lines">
          {loot.lines.map((l) => (
            <li key={l.index} className={`loot__line${l.rarity ? ` rarity--${l.rarity}` : ""}`} data-testid="loot-line">
              <span className="loot__name">{l.label}</span>
              {l.rarity && <span className="loot__rarity">{RARITY[l.rarity].label}</span>}
              <span className="loot__qty">{l.qty > 1 || l.kind !== "item" ? `× ${l.qty}` : ""}</span>
              <button type="button" className="loot__take" onClick={() => intents.takeLoot(l.index)}>
                Weź
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="loot__actions">
        <button type="button" className="loot__close" onClick={() => intents.closeLoot()}>
          Zostaw
        </button>
        <button type="button" className="loot__all" data-testid="loot-take-all" onClick={() => intents.takeLoot("all")}>
          <span className="dialogue__key">E</span> Weź wszystko
        </button>
      </div>
    </div>
  );
};
