import { useT } from "../i18n/use-t";
import type { VehicleVm } from "../store/ui-store";

/** The tachometer's segments, and from which on they are the red band before the limiter. */
export const TACH_SEGMENTS = 12;
const RED_FROM = 10;

/**
 * The car's dashboard on the HUD (ADR-0097 §3): the speed, the gear, a bar tachometer whose last
 * segments are the red band (lit, they flash at the limiter), and the ABS and TC lamps that light
 * while the assists work. A segmented bar as in racing games' HUDs and real cars' shift lights.
 */
export const VehicleDash = ({ vehicle }: { vehicle: VehicleVm }) => {
  const t = useT();
  const lit = Math.round(vehicle.revs * TACH_SEGMENTS);
  return (
    <div className={`hud__vehicle${vehicle.revs >= 1 ? " hud__vehicle--limiter" : ""}`} data-testid="vehicle">
      <div className="hud__vehicle-tach" data-testid="vehicle-tach" data-lit={lit}>
        {Array.from({ length: TACH_SEGMENTS }, (_, i) => (
          <span key={i} className={`hud__tach-seg${i < lit ? " hud__tach-seg--on" : ""}${i >= RED_FROM ? " hud__tach-seg--red" : ""}`} />
        ))}
      </div>
      <div className="hud__vehicle-row">
        <span className="hud__vehicle-speed">{vehicle.kmh}</span>
        <span className="hud__vehicle-unit">{t("hud.kmh")}</span>
        <span className="hud__vehicle-gear">{vehicle.gear}</span>
        <span className={`hud__lamp${vehicle.abs ? " hud__lamp--on" : ""}`} data-testid="lamp-abs">
          {t("hud.abs")}
        </span>
        <span className={`hud__lamp${vehicle.tc ? " hud__lamp--on" : ""}`} data-testid="lamp-tc">
          {t("hud.tc")}
        </span>
      </div>
      {vehicle.damage > 0 && (
        // The body's damage (ADR-0097 §5): the bar fills red towards a wreck.
        <div className={`hud__vehicle-damage${vehicle.damage >= 1 ? " hud__vehicle-damage--wreck" : ""}`} data-testid="vehicle-damage">
          <span className="hud__vehicle-damage-label">{t(vehicle.damage >= 1 ? "hud.wreck" : "hud.damage")}</span>
          <span className="hud__vehicle-damage-bar">
            <span className="hud__vehicle-damage-fill" style={{ width: `${Math.round(vehicle.damage * 100)}%` }} />
          </span>
        </div>
      )}
    </div>
  );
};
