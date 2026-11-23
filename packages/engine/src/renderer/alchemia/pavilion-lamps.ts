import type { Vec3 } from "@seki/core";
import { ALCHEMIA_PAVILION, PAVILION_CAMP_LAMP, PAVILION_CENTRE, PAVILION_NAV_LAMP } from "@seki/sim";
import type { PointLightDef } from "../../npr/lighting";
import type { ToonMaterials } from "../../npr/toon-material";

/**
 * The two lamps of the pavilion's roof scene (`docs/lokacje/alchemia-pawilon-dach.md`, §13 of `docs/zasady-lokacji.md`),
 * a part of Alchemia's view: Ren's camping lantern on his crate (the camp's motivated light, warm, the 30% under the
 * neon's accent), and the green bulkhead lamp over the ladder's foot and the service door (the way up stands out in the
 * green of the ways). Each in its fitting (Blender's models `rd-ren-table`, `rd-pav-bulkhead`), clipped so neither lights
 * what is behind a wall or a slab (G-263): the lantern the roof over the restaurant, the bulkhead the ground and the box's
 * walls below the roof. On only near the pavilion, so the lights' slots go to the street everywhere else.
 */

const R = ALCHEMIA_PAVILION.roof;

export const PAVILION_LAMPS: readonly { readonly key: string; readonly light: PointLightDef }[] = [
  {
    key: "alchemia-pavilion-camp",
    light: { position: PAVILION_CAMP_LAMP, color: "#ffc27a", range: 5.5, intensity: 1.4, clip: { minX: 423, maxX: 437, minZ: -9, maxZ: 7, minY: R - 0.05, maxY: R + 3 } },
  },
  {
    key: "alchemia-pavilion-ladder",
    light: { position: PAVILION_NAV_LAMP, color: "#3dff86", range: 6, intensity: 0.9, clip: { minX: 418, maxX: 427.5, minZ: -4, maxZ: 4.5, minY: -2, maxY: R + 0.4 } },
  },
];

/** On within this of the pavilion's middle, off past it and the margin. */
export const PAVILION_LAMPS_NEAR = 30;
const HOLD = 5;

export class PavilionLamps {
  private on = false;

  constructor(private readonly materials: Pick<ToonMaterials, "addLight" | "removeLight">) {}

  /** Each frame: on near the pavilion (`allowed` false: off, e.g. down in P-2 under it or without the map city). */
  update(eye: Vec3, allowed: boolean): void {
    const d = Math.hypot(eye.x - PAVILION_CENTRE.x, eye.z - PAVILION_CENTRE.z);
    const on = allowed && d < PAVILION_LAMPS_NEAR + (this.on ? HOLD : 0);
    if (on === this.on) return;
    this.on = on;
    for (const l of PAVILION_LAMPS) {
      if (on) this.materials.addLight(l.key, l.light);
      else this.materials.removeLight(l.key);
    }
  }

  /** Whether they are on (tests, debug). */
  get lit(): boolean {
    return this.on;
  }
}
