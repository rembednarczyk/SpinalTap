import { WEAPON_CATALOG, type Vec3, type WeaponId } from "@seki/core";
import type { Entity } from "../components";
import type { CarState } from "./state";
import { attitude } from "./frame";

/*
 * Shooting from the car she drives (ADR-0097 §3: "w aucie broń tylko z jednej ręki przez okno"): the
 * one-handed guns only (a pistol, a revolver, a submachine gun), her other hand on the wheel; a
 * rifle or a shotgun stays quiet at the wheel. The shot leaves by the driver's window, at the height
 * of her shoulder seated, along her look (the mouse turns it round the car, `vehicle-system`).
 * The drive-by of open-world games, held to one hand as the cars of most of them do.
 */

/** Guns that fire one-handed out of the window. */
export const DRIVE_BY_CLASSES: ReadonlySet<string> = new Set(["pistol", "revolver", "smg"]);
/** Where the shot leaves, from her hips on the seat: up to her shoulder, out to the window on the car's left (m). */
const WINDOW = { up: 0.55, out: 0.45 } as const;

/** True when the weapon `id` fires from the car. */
export const firesFromCar = (id: WeaponId | null | undefined): boolean => {
  if (!id) return false;
  const def = (WEAPON_CATALOG as Readonly<Record<string, { readonly class: string } | undefined>>)[id];
  return !!def && DRIVE_BY_CLASSES.has(def.class);
};

/** Where her shot leaves the car: the driver's window by her shoulder (she sits at `player.position`, the car heading its own yaw). */
export const driveByOrigin = (player: Entity, car: CarState): Vec3 => {
  const yaw = attitude(car.q).yaw;
  // The car's left (the driver's door) in the world.
  const [lx, lz] = [-Math.cos(yaw), Math.sin(yaw)];
  return { x: player.position.x + lx * WINDOW.out, y: player.position.y + WINDOW.up, z: player.position.z + lz * WINDOW.out };
};
