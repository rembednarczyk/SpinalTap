import type { Vec3 } from "@seki/core";
import type { BaseTexture, Scene } from "../../babylon";
import type { LightingRig } from "../../npr/lighting";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import type { CityProps } from "../city-props";
import { MapSignMaterial } from "./map-signs";
import { MapWaterMaterial } from "./map-water";
import { MapSkyline, skylineLayoutFor } from "./skyline";
import { megaBodies } from "./skyline-bodies";

export interface MapLookDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly quality: RenderQuality;
  /** Replaces the drawn sign atlases (tests without a canvas). */
  readonly signAtlas?: BaseTexture;
}

/**
 * How the map city looks under the sky (ADR-0017): the sign and water materials, the skyline's
 * megabuildings (ADR-0051), the daylight on the facades and the reduced flashes.
 */
export class MapLook {
  readonly signs: MapSignMaterial;
  readonly water: MapWaterMaterial;
  /** The megabuildings over the roofs (ADR-0051). */
  private readonly skyline: MapSkyline;
  private rig: LightingRig | null = null;
  private daylight = 0;

  constructor(private readonly deps: MapLookDeps) {
    this.signs = new MapSignMaterial(deps.scene, deps.signAtlas, deps.quality === "low" ? 512 : 1024);
    this.water = new MapWaterMaterial(deps.scene);
    this.skyline = new MapSkyline(deps.scene, deps.quality !== "low", skylineLayoutFor(deps.quality));
  }

  /** The water's ripples and the signs' hum, after the look of a new lighting rig. */
  update(dt: number, frozen: boolean): void {
    const rig = this.deps.materials.currentRig;
    if (rig !== this.rig) {
      this.rig = rig;
      this.water.setLook(rig, this.daylight);
      this.signs.setDaylight(this.daylight, rig.fogDensity);
      this.skyline.setLook(rig, this.daylight);
    }
    if (!frozen) {
      this.water.update(dt);
      this.signs.update(dt);
    }
  }

  updateSkyline(dt: number, eye: Vec3, frozen: boolean): void {
    this.skyline.update(dt, eye, this.deps.scene.activeCamera?.maxZ ?? 320, frozen);
  }

  /** The skyline's megatowers (ADR-0063); the phone keeps the procedural tiers. */
  setProps(props: CityProps): void {
    if (this.deps.quality !== "low") this.skyline.setBodies(megaBodies(props));
  }

  /** Night 0 .. day 1 (ADR-0017): lit windows and shop fronts follow, the neon dims. */
  setDaylight(daylight: number): void {
    this.daylight = daylight;
    const self = 1 - 0.5 * Math.max(0, Math.min(1, daylight));
    this.deps.materials.get("facade").setFloat("selfLit", self);
    this.deps.materials.get("mapGround").setFloat("selfLit", self);
    this.deps.materials.get("mapTerrain").setFloat("selfLit", self);
    this.rig = null;
  }

  setReduceFlashes(on: boolean): void {
    this.signs.setReduceFlashes(on);
    this.skyline.setReduceFlashes(on);
  }
}
