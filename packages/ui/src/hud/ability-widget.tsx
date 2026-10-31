import { useT, useText } from "../i18n/use-t";
import { useUi } from "../use-ui";

/** Active ability state and medkit count, bottom-right above the camera badge. */
export const AbilityWidget = () => {
  const tx = useText();
  const t = useT();
  const ability = useUi((s) => s.ability);
  const medkits = useUi((s) => s.medkits);
  const ready = ability ? ability.cooldown <= 0 : false;
  const active = ability ? ability.activeTime > 0 : false;
  const pct = ability ? Math.round((1 - ability.cooldown / ability.cooldownTotal) * 100) : 0;
  return (
    <div className="gear" data-testid="gear">
      {ability && (
        <div className={`gear__ability${active ? " gear__ability--active" : ready ? " gear__ability--ready" : ""}`}>
          <kbd>Q</kbd>
          <div className="gear__body">
            <div className="gear__name">{tx(ability.name)}</div>
            <div className="gear__bar">
              <div className="gear__fill" style={{ width: `${active ? 100 : pct}%` }} />
            </div>
          </div>
          <span className="gear__state">{active ? `${ability.activeTime.toFixed(1)} s` : ready ? t("hud.ability.ready") : `${Math.ceil(ability.cooldown)} s`}</span>
        </div>
      )}
      <div className="gear__item">
        <kbd>H</kbd> {t("hud.medkits", { count: medkits })}
      </div>
    </div>
  );
};
