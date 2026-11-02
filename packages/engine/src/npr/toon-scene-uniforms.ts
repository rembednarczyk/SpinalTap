import { type BaseTexture, Matrix, type ShaderMaterial } from "../babylon";
import type { LightingRig } from "./lighting";
import { hex } from "./toon-material-factory";

export interface ShadowBinding {
  readonly texture: BaseTexture;
  readonly matrix: Matrix;
  readonly texelSize: number;
  /** Depth bias in [0, 1] depth units. */
  readonly bias: number;
  /** 0..1, 0 disables shadow lookups. */
  readonly strength: number;
}

type Vec4 = { x: number; y: number; z: number; w: number };

/**
 * The uniforms every toon material shares: the light rig of the time of day and district,
 * the moon shadow, the muzzle flash and the district rim tint (ADR-0030). Setters that can
 * be no-ops say whether anything changed, so the owner pushes only then.
 */
export class ToonSceneUniforms {
  private shadow: ShadowBinding | null = null;
  private flash: Vec4 = { x: 0, y: 0, z: 0, w: 0 };
  private rimTint: Vec4 = { x: 1, y: 1, z: 1, w: 0 };

  constructor(private current: LightingRig) {}

  get rig(): LightingRig {
    return this.current;
  }

  setRig(rig: LightingRig): void {
    this.current = rig;
  }

  applyRig(m: ShaderMaterial): void {
    const r = this.current;
    m.setVector3("sunDir", { x: r.sunDir.x, y: r.sunDir.y, z: r.sunDir.z });
    m.setColor3("sunColor", hex(r.sunColor));
    m.setColor3("ambientColor", hex(r.ambient));
    m.setColor3("fogColor", hex(r.fogColor));
    m.setColor3("shadeColor", hex(r.shadeTint));
    m.setColor3("fillColor", hex(r.fillColor));
    m.setFloat("fogDensity", r.fogDensity);
  }

  setShadow(shadow: ShadowBinding | null): void {
    this.shadow = shadow;
  }

  /** False without a shadow: there is no matrix to move. */
  setShadowMatrix(matrix: Matrix): boolean {
    if (!this.shadow) return false;
    this.shadow = { ...this.shadow, matrix };
    return true;
  }

  applyShadow(m: ShaderMaterial): void {
    const s = this.shadow;
    if (!s) {
      m.setMatrix("shadowMatrix", Matrix.Identity());
      m.setVector3("shadowParams", { x: 0, y: 0, z: 0 });
      return;
    }
    m.setTexture("shadowSampler", s.texture);
    m.setMatrix("shadowMatrix", s.matrix);
    m.setVector3("shadowParams", { x: s.bias, y: s.texelSize, z: s.strength });
  }

  /** Only the matrix uniform, after `setShadowMatrix`. */
  applyShadowMatrix(m: ShaderMaterial): void {
    if (this.shadow) m.setMatrix("shadowMatrix", this.shadow.matrix);
  }

  /** False while the flash stays dark. */
  setFlash(x: number, y: number, z: number, intensity: number): boolean {
    if (intensity <= 0 && this.flash.w <= 0) return false;
    this.flash = { x, y, z, w: Math.max(0, intensity) };
    return true;
  }

  applyFlash(m: ShaderMaterial): void {
    m.setVector4("flashLight", this.flash);
  }

  /** False when the tint stays the same. */
  setRimTint(color: string, weight: number): boolean {
    const c = hex(color);
    const next = { x: c.r, y: c.g, z: c.b, w: Math.max(0, Math.min(1, weight)) };
    const r = this.rimTint;
    if (r.x === next.x && r.y === next.y && r.z === next.z && r.w === next.w) return false;
    this.rimTint = next;
    return true;
  }

  applyRimTint(m: ShaderMaterial): void {
    m.setVector4("rimTint", this.rimTint);
  }
}
