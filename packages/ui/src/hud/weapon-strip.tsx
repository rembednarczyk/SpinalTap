import { useT } from "../i18n/use-t";
import type { Translate } from "../i18n/t";
import type { WeaponStripVm } from "../store/ui-store";
import type { TouchPadSink } from "../touch/touch-pad-sink";
import { useUi } from "../use-ui";

const ammoText = (w: WeaponStripVm, t: Translate): string => {
  if (w.loaded === null)
    return w.slots.some((s) => s.slot === w.active && s.name)
      ? t("weapon.melee")
      : t("weapon.unarmed");
  return `${w.loaded} / ${w.reserve ?? 0}`;
};

const status = (w: WeaponStripVm, t: Translate): string | null => {
  if (w.holstered) return t("weapon.holstered");
  if (w.reloading) return t("weapon.reloading");
  if (w.loaded === 0)
    return (w.reserve ?? 0) > 0 ? t("weapon.emptyMag") : t("weapon.noAmmo");
  return null;
};

/**
 * Weapon slots and ammo of the active weapon (ADR-0015). With a touch pad the slots are
 * buttons that pick the slot through the pad, so the choice goes through the input stream.
 */
export const WeaponStrip = ({ pad }: { pad?: TouchPadSink | undefined }) => {
  const w = useUi((s) => s.weapons);
  const shown = useUi((s) => s.combat || s.settings.hudAlwaysShow);
  const t = useT();
  if (!w) return null;
  const note = status(w, t);
  // Out of combat the rounds step aside, unless something about them needs saying.
  const calm = !shown && note === null;
  return (
    <div className="weapon-strip" data-testid="weapon-strip">
      <div
        className={`weapon-strip__ammo${w.loaded === 0 ? " weapon-strip__ammo--empty" : ""}${calm ? " weapon-strip__ammo--calm" : ""}`}
        data-testid="weapon-ammo"
      >
        <span className="weapon-strip__count">{ammoText(w, t)}</span>
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
              <span className="weapon-strip__name">
                {s.name ?? t(`weapon.slot.${s.slot}`)}
              </span>
            </>
          );
          return pad ? (
            <button
              key={s.slot}
              type="button"
              className={cls}
              aria-label={t("weapon.slotLabel", {
                slot: t(`weapon.slot.${s.slot}`),
                name: s.name ?? t("weapon.empty"),
              })}
              aria-pressed={s.slot === w.active}
              onPointerDown={() => pad.selectWeaponSlot(s.key)}
              onContextMenu={(e) => e.preventDefault()}
              onTouchEnd={(e) => e.preventDefault()}
            >
              {body}
            </button>
          ) : (
            <div
              key={s.slot}
              className={cls}
              title={t(`weapon.slot.${s.slot}`)}
            >
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
};
