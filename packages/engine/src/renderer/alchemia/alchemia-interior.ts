import type { Vec3 } from "@seki/core";
import { interiorAt } from "@seki/sim";
import type { ToonMaterials } from "../../npr/toon-material";
import { ALCHEMIA_LAMP_PREFIX, type AlchemiaLamp, alchemiaLampsFor } from "./alchemia-lights";

/** Alchemia's interiors with its own light (`interior-areas.ts`): the gallery's floors with the front's storeys, and the food hall. */
const LIT = new Set(["alchemia-gallery", "alchemia-foodhall"]);
/** The interior the eye is in holds this far past its walls, so a step in its doorway does not flicker the light. */
const HOLD = 0.5;

/**
 * Alchemia's interior mode (the user's note of 22.11, as W-3's of ADR-0082 §4): with the eye in its
 * gallery or its food hall its own warm rig replaces the sky's (`indoorRig`, mixed in by the renderer)
 * and only its lamps take the shader's slots, the few nearest the eye (`alchemiaLampsFor`). Its own
 * part behind `AlchemiaView`.
 */
export class AlchemiaInterior {
  /** The eye is in Alchemia's rooms: the renderer's interior mode. */
  interior = false;
  private held: string | null = null;
  private lamps: readonly AlchemiaLamp[] = [];

  constructor(private readonly materials: ToonMaterials) {}

  /** Only Alchemia's own lamps light it from inside (`ToonMaterials.setLightFocus`). */
  get lightScope(): string | null {
    return this.interior ? ALCHEMIA_LAMP_PREFIX : null;
  }

  /** The lamps on now (tests, debug). */
  get on(): readonly AlchemiaLamp[] {
    return this.lamps;
  }

  /** Call once per frame with the eye and whether the inside is drawn. */
  update(eye: Vec3, drawn: boolean): void {
    const at = drawn ? interiorAt(eye, this.held, HOLD) : null;
    this.held = at && LIT.has(at.id) ? at.id : null;
    this.interior = this.held !== null;
    this.light(this.interior ? alchemiaLampsFor(eye) : []);
  }

  private light(next: readonly AlchemiaLamp[]): void {
    if (next.length === this.lamps.length && next.every((l, i) => l === this.lamps[i])) return;
    for (const l of this.lamps) if (!next.includes(l)) this.materials.removeLight(l.key);
    for (const l of next) if (!this.lamps.includes(l)) this.materials.addLight(l.key, l.light);
    this.lamps = next;
  }
}
