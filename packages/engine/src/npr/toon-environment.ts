import type { BaseTexture } from "../babylon";
import type { ToonEnvBinding } from "./toon-material-factory";

interface EnvState extends ToonEnvBinding {
  readonly presets: ReadonlySet<string>;
}

/**
 * The wet-asphalt probe (ADR-0036) and the presets that sample it. Fixed before those
 * materials are created: the reflection is compiled in, not toggled.
 */
export class ToonEnvironment {
  private env: EnvState | null = null;

  set(texture: BaseTexture, presets: ReadonlySet<string>, strength: number): void {
    this.env = { texture, presets, strength };
  }

  /** False while there is no probe, so there is nothing to push. */
  setStrength(strength: number): boolean {
    if (!this.env) return false;
    this.env = { ...this.env, strength };
    return true;
  }

  /** Whether the material cached under `name` samples the probe. */
  samples(name: string): boolean {
    return this.env !== null && this.env.presets.has(name);
  }

  /** The probe a new material of `name` compiles in, or null. */
  bindingFor(name: string): ToonEnvBinding | null {
    return this.env && this.env.presets.has(name) ? this.env : null;
  }
}
