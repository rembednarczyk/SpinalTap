import type { ShaderMaterial } from "../babylon";
import { MAX_LAMP_STREAKS } from "./lamp-streaks";
import { PRESETS } from "./presets";
import { hex } from "./toon-material-factory";

/** Materials of the map city's wet ground (ADR-0084): they mirror the lamps near the eye. */
const mirrorsLamps = (key: string): boolean => (PRESETS as Record<string, { readonly water?: boolean }>)[key]?.water === true;

/**
 * The wet street's share of the toon uniforms (ADR-0084): the district tint of the water,
 * pushed to every material, and the lamps it mirrors, pushed only to the wet ground's.
 * Kept apart from `ToonMaterials`, which hands it its material cache (ADR-0031).
 */
export class ToonWetGround {
  private tint = "#ffffff";
  private streaks: { pos: number[]; col: number[] } = { pos: [], col: [] };

  constructor(private readonly materials: ReadonlyMap<string, ShaderMaterial>) {}

  /** District tint of the wet street. */
  setTint(color: string): void {
    if (color === this.tint) return;
    this.tint = color;
    for (const m of this.materials.values()) this.applyTint(m);
  }

  /** The lamps the wet street mirrors (`lamp-streaks.ts`): xyz and seed, colour with its brightness. */
  setLampStreaks(pos: readonly number[], col: readonly number[]): void {
    this.streaks = { pos: [...pos], col: [...col] };
    for (const [key, m] of this.materials) if (mirrorsLamps(key)) this.applyStreaks(m);
  }

  /** Brings a new material under the material key `key` up to date. */
  apply(key: string, m: ShaderMaterial): void {
    this.applyTint(m);
    if (mirrorsLamps(key)) this.applyStreaks(m);
  }

  private applyTint(m: ShaderMaterial): void {
    m.setColor3("wetTint", hex(this.tint));
  }

  private applyStreaks(m: ShaderMaterial): void {
    const { pos, col } = this.streaks;
    // Uniform arrays must be fully sized.
    const fill = (a: number[]) => [...a, ...new Array<number>(MAX_LAMP_STREAKS * 4 - a.length).fill(0)];
    m.setArray4("streakLamp", fill(pos));
    m.setArray4("streakColor", fill(col));
    m.setFloat("streakCount", pos.length / 4);
  }
}
