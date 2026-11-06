import { type Vec3, angleDelta, directionFromAngles } from "@seki/core";
import type { AimAssistLevel, AimTarget } from "@seki/engine";
import { type Entity, type Simulation, aimOrigin, lineOfSight } from "@seki/sim";
import type { SettingsVm } from "@seki/ui";

/** The part of the engine's AimAssist the app feeds before each poll (ADR-0072). */
export interface AimAssistSink {
  level: AimAssistLevel;
  adsWeapon: boolean;
  targets: readonly AimTarget[];
}

/**
 * One target along the aim axis: the ray from `origin` at the player's yaw and pitch. The TPP
 * camera sits on that ray behind the shoulder and the shots start on it (`aimOrigin`), so the
 * angles are the camera's as the crosshair shows them.
 */
export const aimTargetAlong = (origin: Vec3, yaw: number, pitch: number, point: Vec3, radius: number): AimTarget | null => {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const dz = point.z - origin.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance < 1e-6) return null;
  const axis = directionFromAngles(yaw, pitch);
  const cos = (axis.x * dx + axis.y * dy + axis.z * dz) / distance;
  return {
    yaw: angleDelta(yaw, Math.atan2(dx, dz)),
    // Positive pitch looks down (`directionFromAngles`: y = -sin(pitch)).
    pitch: Math.asin(Math.max(-1, Math.min(1, -dy / distance))) - pitch,
    angle: Math.acos(Math.max(-1, Math.min(1, cos))),
    radius: Math.atan2(radius, distance),
    distance,
  };
};

/**
 * The simulation's targets of the last step (`Simulation.aimTargets`, read only) as the engine
 * sees them. The query checks the line of sight from her eye; in TPP the shots start over the
 * shoulder, so an enemy the eye sees past the edge of a wall that the shoulder does not see
 * would pull the crosshair onto the wall. Such a one is left out.
 */
export const aimTargetsFor = (sim: Simulation, player: Entity, leftShoulder: boolean): AimTarget[] => {
  const mode = sim.domain.preferences.cameraMode;
  const origin = aimOrigin(player, mode, leftShoulder);
  const out: AimTarget[] = [];
  for (const c of sim.aimTargets()) {
    if (mode === "TPP" && !lineOfSight(sim.world, origin, c.point)) continue;
    const t = aimTargetAlong(origin, player.yaw, player.pitch, c.point, c.radius);
    if (t) out.push(t);
  }
  return out;
};

/**
 * Before each poll: the assist's level from the settings, whether the weapon in hand aims down
 * sights (the assist works only then) and the targets. One step behind, as all input is.
 */
export const feedAimAssist = (assist: AimAssistSink, settings: Pick<SettingsVm, "aimAssist">, sim: Simulation, leftShoulder: boolean): void => {
  const player = sim.player();
  assist.level = settings.aimAssist;
  assist.adsWeapon = !!player?.combatant?.stats?.ads;
  assist.targets = player && assist.adsWeapon && settings.aimAssist !== "off" ? aimTargetsFor(sim, player, leftShoulder) : [];
};
