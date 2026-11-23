import type { Vec3 } from "@seki/core";
import { type Color4, type ParticleSystem, type Scene, Vector3 } from "../babylon";
import { createSteam } from "./atmosphere";

/**
 * How far from the camera a vent steams, metres. Past it its puffs are a few pixels behind the city, and a running
 * particle system is a draw call wherever the camera is: every vent of Krakowskie Przedmieście cost one in W-3 at the
 * other end of the city (its night scene went over budget with one more vent, #957).
 */
export const STEAM_REACH = 90;

/** One vent: where it steams, its colour and how many puffs a second. */
export interface SteamVent {
  readonly at: Vec3;
  readonly tint: Color4;
  readonly rate: number;
}

/**
 * The street's steam (`STEAM_VENTS`): a particle system a vent, running only while the camera is within
 * `STEAM_REACH` of it, as the rain and the splashes follow the camera (distance culling of an effect, as engines cull
 * particle emitters off screen or far). A vent left behind stops and drops its puffs at once, so it draws nothing.
 */
export class SteamVents {
  private readonly vents: { readonly ps: ParticleSystem; readonly at: Vec3; on: boolean }[];

  /** `make` builds a vent's system (the game's puffs, `createSteam`; a plain one in the tests, which have no canvas). */
  constructor(scene: Scene, vents: readonly SteamVent[], make: (scene: Scene, at: Vector3, tint: Color4, rate: number) => ParticleSystem = createSteam) {
    this.vents = vents.map((v) => {
      const ps = make(scene, new Vector3(v.at.x, v.at.y, v.at.z), v.tint, v.rate);
      ps.stop();
      ps.reset();
      return { ps, at: v.at, on: false };
    });
  }

  /** Starts the vents the camera came near and stops, emptied, those it left. */
  follow(camera: { readonly x: number; readonly z: number }): void {
    for (const v of this.vents) {
      const near = Math.hypot(v.at.x - camera.x, v.at.z - camera.z) <= STEAM_REACH;
      if (near === v.on) continue;
      v.on = near;
      if (near) v.ps.start();
      else {
        v.ps.stop();
        v.ps.reset();
      }
    }
  }

  /** How many vents steam now (tests). */
  get running(): number {
    return this.vents.filter((v) => v.on).length;
  }
}
