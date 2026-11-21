import type { EntityId } from "@seki/core";
import { carAssists, carGear, carKmh, carRevs } from "@seki/sim";
import { type HudPart, type HudPartFrame, type HudPatch, snap } from "./hud-part";

/** How long a lamp stays lit after its assist last eased a wheel (ticks): a quarter of a second, so it does not flicker per substep. */
export const LAMP_HOLD = 15;

/**
 * The car she drives (ADR-0097 §3): the speedometer, the gear, the tachometer (0 idle .. 1 the
 * limiter, in steps of 0.05) and the ABS and traction control lamps, read from the car she sits in
 * (`seated` on the player, the car among the entities the frame looked up).
 */
export class VehicleHud implements HudPart {
  readonly offs: readonly (() => void)[] = [];
  private car: EntityId | null = null;
  private lit = { abs: -Infinity, tc: -Infinity };

  wanted(): Iterable<EntityId> {
    return this.car === null ? [] : [this.car];
  }

  frame(f: HudPartFrame): HudPatch {
    this.car = f.player?.seated ?? null;
    const car = this.car === null ? undefined : f.found.get(this.car)?.car;
    if (!car) return { vehicle: null };
    const eased = carAssists(car);
    if (eased.abs) this.lit.abs = f.tick;
    if (eased.tc) this.lit.tc = f.tick;
    return {
      vehicle: {
        kmh: Math.round(Math.abs(carKmh(car))),
        gear: carGear(car),
        revs: snap(carRevs(car), 0.05),
        abs: f.tick - this.lit.abs < LAMP_HOLD,
        tc: f.tick - this.lit.tc < LAMP_HOLD,
        damage: snap(car.damage, 0.05),
      },
    };
  }

  reset(): HudPatch {
    this.car = null;
    this.lit = { abs: -Infinity, tc: -Infinity };
    return { vehicle: null };
  }
}
