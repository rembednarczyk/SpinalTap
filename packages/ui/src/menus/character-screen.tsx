import { AMMO_CATALOG, type AmmoId } from "@seki/core";
import { useEffect, useRef } from "react";
import { CityMapPanel } from "../citymap/city-map-panel";
import { InventoryTab } from "../inventory/inventory-tab";
import { JournalPanel } from "../journal/journal-panel";
import { formatNumber, useLocale } from "../i18n/number";
import { useT } from "../i18n/use-t";
import type { CharacterTab } from "../store/ui-store";
import { useCharacterIntents, useUi } from "../use-ui";
import { CharacterPanel } from "./character-panel";

const TABS: readonly (readonly [CharacterTab, string])[] = [
  ["inventory", "I"],
  ["sheet", "Tab"],
  ["journal", "J"],
  ["map", "M"],
];

const KEYS: Readonly<Record<string, CharacterTab>> = { KeyI: "inventory", Tab: "sheet", KeyJ: "journal", KeyM: "map" };

const AMMO_ORDER = Object.keys(AMMO_CATALOG) as AmmoId[];

/** Rounds in the pouch, for the top bar: the types she has, or 9 mm when she has none. */
const AmmoSummary = () => {
  const t = useT();
  const ammo = useUi((s) => s.ammo);
  const kinds = AMMO_ORDER.filter((id) => (ammo[id] ?? 0) > 0);
  return (
    <div className="cscreen__ammo" data-testid="ammo-pouch" aria-label={t("character.ammo")}>
      {(kinds.length > 0 ? kinds : (["9mm"] as AmmoId[])).map((id) => (
        <span key={id} className="cscreen__round">
          {AMMO_CATALOG[id].name} <b>{ammo[id] ?? 0}</b>
        </span>
      ))}
    </div>
  );
};

/**
 * The character screen (plan §7): Inventory, Sheet, Journal and Map (ADR-0045) as tabs of
 * one full-screen menu. I, Tab, J and M open it on their tab and close it from there; Esc or
 * the cross closes it. While it is open the game clock stands (the app stops the simulation).
 */
export const CharacterScreen = () => {
  const t = useT();
  const locale = useLocale();
  const tab = useUi((s) => s.characterTab);
  const toggle = useUi((s) => s.toggleCharacter);
  const show = useUi((s) => s.showCharacterTab);
  const close = useUi((s) => s.closeCharacter);
  const modal = useUi((s) => s.dialogue !== null || s.shopOpen || s.loot !== null);
  const eddies = useUi((s) => s.eddies);
  const intents = useCharacterIntents();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal) return;
      const target = KEYS[e.code];
      if (target) {
        e.preventDefault();
        if (!e.repeat) toggle(target);
      } else if (e.code === "Escape" && tab !== null) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, toggle, close, tab]);

  // The app hears about every open, tab change and close, whoever made it.
  const told = useRef<CharacterTab | null>(null);
  useEffect(() => {
    if (tab === told.current) return;
    told.current = tab;
    if (tab === null) intents.closeCharacterScreen();
    else intents.openCharacterScreen(tab);
  }, [tab, intents]);

  if (tab === null) return null;
  return (
    <div className={`cscreen cscreen--${tab}`} data-testid="character-screen" role="dialog" aria-label={t("character.label")}>
      <div className="cscreen__frame">
        <header className="cscreen__bar">
          <div className="cscreen__tabs" role="tablist" aria-label={t("character.tabs")}>
            {TABS.map(([id, key]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`cscreen__tab${tab === id ? " cscreen__tab--on" : ""}`}
                onClick={() => show(id)}
                // A touch switches on release: mobile Chrome does not always follow a tap with a click.
                onPointerUp={(e) => e.pointerType === "touch" && show(id)}
              >
                {t(`character.tab.${id}`)}
                <kbd className="cscreen__key">{key}</kbd>
              </button>
            ))}
          </div>
          <div className="cscreen__wallet" data-testid="menu-eddies">
            <span className="hud__currency">€$</span> {formatNumber(locale, eddies)}
          </div>
          <AmmoSummary />
          <button type="button" className="cscreen__close" aria-label={t("character.close")} onClick={close}>
            ✕
          </button>
        </header>
        <div className="cscreen__body">
          {tab === "inventory" && <InventoryTab />}
          {tab === "sheet" && <CharacterPanel />}
          {tab === "journal" && <JournalPanel />}
          {tab === "map" && <CityMapPanel />}
        </div>
      </div>
    </div>
  );
};
