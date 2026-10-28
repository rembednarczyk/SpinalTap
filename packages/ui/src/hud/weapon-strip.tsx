import type { WeaponSlot } from "@seki/core";
import type { WeaponStripVm } from "../store/ui-store";
import type { TouchPadSink } from "../touch/touch-pad-sink";
import { useUi } from "../use-ui";

const SLOT_LABEL: Readonly<Record<WeaponSlot, string>> = { primary: "Główna", secondary: "Boczna", melee: "Wręcz" };

const ammoText = (w: WeaponStripVm): string => {
  if (w.loaded === null) return w.slots.some((s) => s.slot === w.active && s.name) ? "wręcz" : "bez broni";
  return `${w.loaded} / ${w.reserve ?? 0}`;
};

const status = (w: WeaponStripVm): string | null => {
  if (w.holstered) return "schowana";
  if (w.reloading) return "przeładowanie";
  if (w.loaded === 0) return (w.reserve ?? 0) > 0 ? "pusty magazynek [R]" : "brak amunicji";
  return null;
};

/**
 * Weapon slots and ammo of the active weapon (ADR-0015). With a touch pad the slots are
 * buttons that pick the slot through the pad, so the choice goes through the input stream.
 */
export const WeaponStrip = ({ pad }: { pad?: TouchPadSink | undefined }) => {
  const w = useUi((s) => s.weapons);
  const shown = useUi((s) => s.combat || s.settings.hudAlwaysShow);
  if (!w) return null;
  const note = status(w);
  // Out of combat the rounds step aside, unless something about them needs saying.
  const calm = !shown && note === null;
  return (
    <div className="weapon-strip" data-testid="weapon-strip">
      <div className={`weapon-strip__ammo${w.loaded === 0 ? " weapon-strip__ammo--empty" : ""}${calm ? " weapon-strip__ammo--calm" : ""}`} data-testid="weapon-ammo">
        <span className="weapon-strip__count">{ammoText(w)}</span>
        {w.ammoName && <span className="weapon-strip__type">{w.ammoName}</span>}
        {note && <span className="weapon-strip__note">{note}</span>}
      </div>
      <div className="weapon-strip__slots">
        {w.slots.map((s) => {
          const cls = `weapon-strip__slot${s.slot === w.active ? " weapon-strip__slot--active" : ""}${s.name ? "" : " weapon-strip__slot--empty"}${
            s.rarity ? ` rarity--${s.rarity}` : ""
          }`;
          const body = (
            <>
              <span className="weapon-strip__key">{s.key}</span>
              <span className="weapon-strip__name">{s.name ?? SLOT_LABEL[s.slot]}</span>
            </>
          );
          return pad ? (
            <button
              key={s.slot}
              type="button"
              className={cls}
              aria-label={`${SLOT_LABEL[s.slot]}: ${s.name ?? "pusto"}`}
              aria-pressed={s.slot === w.active}
              onPointerDown={() => pad.selectWeaponSlot(s.key)}
              onContextMenu={(e) => e.preventDefault()}
              onTouchEnd={(e) => e.preventDefault()}
            >
              {body}
            </button>
          ) : (
            <div key={s.slot} className={cls} title={SLOT_LABEL[s.slot]}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
};
