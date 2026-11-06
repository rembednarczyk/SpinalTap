import { keyLabel } from "../menus/key-label";
import { useT } from "../i18n/use-t";
import { XpMeter } from "../progress/xp-meter";
import { useUi } from "../use-ui";

/** Attribute and perk points not spent yet: the HUD's mark, the touch menu button's and the Progress tab's badge. */
export const useUnspentPoints = (): number => useUi((s) => s.attributePoints + s.perkPoints);

/**
 * The level and the XP bar under the health bar (ADR-0059, stage 7), and the points left to spend
 * with the key of the Progress tab. `up` flashes the bar after a level up.
 */
export const XpHud = ({ up }: { readonly up: boolean }) => {
  const t = useT();
  const level = useUi((s) => s.level);
  const points = useUnspentPoints();
  const unspent = t("progress.unspent", { count: points });
  return (
    <div className={`hud__progress${up ? " hud__progress--up" : ""}`} data-testid="hud-progress">
      <span className="hud__level" data-testid="hud-level">
        {t("hud.level", { level })}
      </span>
      <XpMeter className="hud__xp" testId="hud-xp" showValue={false} />
      {points > 0 && (
        <span className="hud__points" data-testid="hud-points" title={unspent} aria-label={unspent} role="status">
          ▲ {points} <kbd>{keyLabel("KeyK", t)}</kbd>
        </span>
      )}
    </div>
  );
};
