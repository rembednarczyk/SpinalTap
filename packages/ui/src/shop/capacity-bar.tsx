import type { CyberwareId } from "@seki/core";
import { useUi } from "../use-ui";
import { type CapacityFit, capacityFit, overCapacityText } from "./capacity";

/** Cyberware capacity in use against the limit (ADR-0032), at the top of the ripperdoc's lists. */
export const CapacityBar = () => {
  const capacity = useUi((s) => s.capacity);
  if (!capacity) return null;
  const pct = capacity.max > 0 ? Math.min(100, Math.round((capacity.used / capacity.max) * 100)) : 100;
  return (
    <div className={`capacity${capacity.used >= capacity.max ? " capacity--full" : ""}`} data-testid="capacity">
      <span className="capacity__label">Pojemność cyberware</span>
      <div className="capacity__bar" role="meter" aria-valuemin={0} aria-valuemax={capacity.max} aria-valuenow={capacity.used} aria-label="Pojemność cyberware">
        <div className="capacity__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="capacity__value" data-testid="capacity-value">
        {capacity.used} / {capacity.max}
      </span>
    </div>
  );
};

/** The fit of an implant against the capacity left, for an offer or a bag line. */
export const useCapacityFit = (id: CyberwareId): CapacityFit => {
  const loadout = useUi((s) => s.cyberware);
  const capacity = useUi((s) => s.capacity);
  return capacityFit(id, loadout, capacity);
};

/** The implant's cost, and the refusal when it does not fit. */
export const CapacityCost = ({ fit }: { fit: CapacityFit }) => {
  const capacity = useUi((s) => s.capacity);
  return (
    <>
      <span className="shop__capacity" data-testid="implant-capacity">
        Pojemność {fit.cost}
      </span>
      {fit.over && capacity && (
        <p className="shop__warn" data-testid="capacity-over">
          {overCapacityText(fit, capacity)}
        </p>
      )}
    </>
  );
};
