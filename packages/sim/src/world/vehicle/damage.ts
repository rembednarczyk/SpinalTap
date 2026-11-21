import type { CarState } from "./state";

/*
 * A car's damage (ADR-0097 §5, "uszkodzenia"): one number, 0 whole .. 1 a wreck, that grows with the
 * energy each hit takes out of the car. Arcade driving games keep it this way (a health bar for the
 * body, the engine failing past a share of it), not the per-panel deformation of simulators: the
 * picture shows it by smoke from under the bonnet, the engine loses power past `WEAK_FROM`, and a
 * wreck's engine is dead.
 */

/** The energy (J) that wrecks a whole car: about three crashes into a wall at 50 km/h for a 1.35 t car (130 kJ each). */
export const DAMAGE_ENERGY = 400_000;
/** Past this the engine weakens, down to `WEAKEST` of its torque just short of a wreck. */
export const WEAK_FROM = 0.4;
export const WEAKEST = 0.35;

/** Damage the hit with `energy` (J) does to `car`; true when it wrecked it now. */
export const takeHit = (car: CarState, energy: number): boolean => {
  const before = car.damage;
  car.damage = Math.min(1, before + Math.max(0, energy) / DAMAGE_ENERGY);
  return before < 1 && car.damage >= 1;
};

/** True for a wreck: its engine is dead. */
export const wrecked = (car: CarState): boolean => car.damage >= 1;

/** The share of the engine's torque the damage leaves (1 whole, `WEAKEST` near a wreck, 0 a wreck). */
export const enginePower = (damage: number): number => {
  if (damage >= 1) return 0;
  if (damage <= WEAK_FROM) return 1;
  const k = (damage - WEAK_FROM) / (1 - WEAK_FROM);
  return 1 - (1 - WEAKEST) * k * k * (3 - 2 * k);
};
