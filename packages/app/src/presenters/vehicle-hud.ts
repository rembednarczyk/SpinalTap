import type { EntityId } from "@seki/core";
import { carGear, carKmh } from "@seki/sim";
import type { HudPart, HudPartFrame, HudPatch } from "./hud-part";

/**
 * The car she drives (ADR-0097 §3): the speedometer and the gear, read from the car she sits in
 * (`seated` on the player, the car among the entities the frame looked up).
 */
export class VehicleHud implements HudPart {
  readonly offs: readonly (() => void)[] = [];
  private car: EntityId | null = null;

  wanted(): Iterable<EntityId> {
    return this.car === null ? [] : [this.car];
  }

  frame(f: HudPartFrame): HudPatch {
    this.car = f.player?.seated ?? null;
    const car = this.car === null ? undefined : f.found.get(this.car)?.car;
    return { vehicle: car ? { kmh: Math.round(Math.abs(carKmh(car))), gear: carGear(car) } : null };
  }

  reset(): HudPatch {
    this.car = null;
    return { vehicle: null };
  }
}
