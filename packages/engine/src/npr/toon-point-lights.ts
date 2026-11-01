import type { ShaderMaterial } from "../babylon";
import type { PointLightDef } from "./lighting";
import { hex } from "./toon-material-factory";
import { MAX_POINT_LIGHTS } from "./toon-shader";

/**
 * Lights farther than this from the camera only get a shader slot when nearer ones leave one
 * free. Wide enough that within one district the selection is the plain registration order.
 */
export const LIGHT_SLOT_DISTANCE = 50;

/**
 * Point lights registered by key and the ones bound to the shader's slots. Only
 * MAX_POINT_LIGHTS fit: slots go in registration order, first to lights within
 * LIGHT_SLOT_DISTANCE of the focus (the camera), then to the rest. The mutators say whether
 * the slots changed, so the owner pushes them only then.
 */
export class ToonPointLights {
  private readonly lights = new Map<string, PointLightDef>();
  /** Lights bound to the shader's point slots, in slot order. */
  private active: PointLightDef[] = [];
  private focus: { x: number; z: number } | null = null;

  add(key: string, light: PointLightDef): boolean {
    this.lights.set(key, light);
    return this.select();
  }

  remove(key: string): boolean {
    if (!this.lights.delete(key)) return false;
    return this.select();
  }

  setFocus(x: number, z: number): boolean {
    this.focus = { x, z };
    return this.select();
  }

  /** Lights currently bound to shader slots. */
  get count(): number {
    return this.active.length;
  }

  /** Writes the slots into a material; unused slots get a dark light far below. */
  apply(m: ShaderMaterial): void {
    const pos: number[] = [];
    const col: number[] = [];
    for (const l of this.active) {
      const c = hex(l.color);
      pos.push(l.position.x, l.position.y, l.position.z, l.range);
      col.push(c.r, c.g, c.b, l.intensity);
    }
    // Uniform arrays must be fully sized.
    while (pos.length < MAX_POINT_LIGHTS * 4) {
      pos.push(0, -1000, 0, 1);
      col.push(0, 0, 0, 0);
    }
    m.setArray4("pointPos", pos);
    m.setArray4("pointColor", col);
    m.setFloat("pointCount", this.active.length);
  }

  private select(): boolean {
    const near: PointLightDef[] = [];
    const far: PointLightDef[] = [];
    const f = this.focus;
    for (const l of this.lights.values()) {
      (f === null || Math.hypot(l.position.x - f.x, l.position.z - f.z) <= LIGHT_SLOT_DISTANCE ? near : far).push(l);
    }
    const next = [...near, ...far].slice(0, MAX_POINT_LIGHTS);
    if (next.length === this.active.length && next.every((l, i) => l === this.active[i])) return false;
    this.active = next;
    return true;
  }
}
