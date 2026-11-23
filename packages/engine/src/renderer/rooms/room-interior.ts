import type { Vec3 } from "@seki/core";
import { interiorAt } from "@seki/sim";
import type { ToonMaterials } from "../../npr/toon-material";
import { DIM_ROOMS, LIT_ROOMS, ROOM_LAMP_PREFIX, type RoomLamp, roomLampsFor } from "./room-lights";

/** Where the rooms' lamps go: the toon materials' point lights, or a stand-in that reaches them later. */
export type RoomLights = Pick<ToonMaterials, "addLight" | "removeLight">;

/** The interior the eye is in holds this far past its walls, so a step in its doorway does not flicker the light. */
const HOLD = 0.5;

/**
 * The old town's rooms' and Tessen's office's interior mode (`docs/zasady-lokacji.md` §13, as Alchemia's): with the eye
 * in one of them its own dim rig replaces the sky's (`indoorRig("room")`, mixed in by the renderer) and only its lamps
 * take the shader's slots (`roomLampsFor`). Its own part behind the renderer's facade (ADR-0031).
 */
export class RoomsInterior {
  /** The eye is in one of these rooms: the renderer's interior mode. */
  interior = false;
  private held: string | null = null;
  private lamps: readonly RoomLamp[] = [];

  constructor(private readonly materials: RoomLights) {}

  /** Only the room's own lamps light it from inside (`ToonMaterials.setLightFocus`). */
  get lightScope(): string | null {
    return this.interior && this.held !== null && LIT_ROOMS.has(this.held) ? ROOM_LAMP_PREFIX : null;
  }

  /** The lamps on now (tests, debug). */
  get on(): readonly RoomLamp[] {
    return this.lamps;
  }

  /** Call once per frame with the eye. */
  update(eye: Vec3): void {
    const at = interiorAt(eye, this.held, HOLD);
    this.held = at && (LIT_ROOMS.has(at.id) || DIM_ROOMS.has(at.id)) ? at.id : null;
    this.interior = this.held !== null;
    this.light(this.held && LIT_ROOMS.has(this.held) ? roomLampsFor(this.held, eye) : []);
  }

  private light(next: readonly RoomLamp[]): void {
    if (next.length === this.lamps.length && next.every((l, i) => l === this.lamps[i])) return;
    for (const l of this.lamps) if (!next.includes(l)) this.materials.removeLight(l.key);
    for (const l of next) if (!this.lamps.includes(l)) this.materials.addLight(l.key, l.light);
    this.lamps = next;
  }
}
