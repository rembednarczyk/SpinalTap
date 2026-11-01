import type { ActivityId, EntityId } from "@seki/core";
import type { DistrictId } from "@seki/sim";
import type { CharacterActivities } from "./character-activities";
import type { CharacterViews } from "./character-views";
import type { CityKitLoader } from "./city-kit-loader";
import type { CrowdViews } from "./crowd-views";
import type { MapCitySlot } from "./map-city-slot";
import type { MapCityStats } from "./mapcity/map-city";
import type { MetroRide } from "./metro-ride";
import type { PropViews } from "./prop-views";
import type { ScreenFx } from "./screen-fx";
import type { VehicleViews } from "./vehicle-views";
import type { WetAsphalt } from "./wet-asphalt";

export interface RendererStatsDeps {
  readonly characters: CharacterViews;
  readonly activities: CharacterActivities;
  readonly props: PropViews;
  readonly crowd: CrowdViews;
  readonly vehicles: VehicleViews;
  readonly cityKit: CityKitLoader;
  readonly map: MapCitySlot;
  readonly metro: MetroRide;
  readonly fx: ScreenFx;
  readonly wet: WetAsphalt | null;
}

/**
 * What the renderer holds and draws, read by the debug API and the tests (ADR-0046): a part
 * behind the `BabylonRenderer` facade that only reads the other parts.
 */
export class RendererStats {
  constructor(private readonly deps: RendererStatsDeps) {}

  /** Views of every kind on screen. */
  get entityCount(): number {
    const { characters, props, crowd, vehicles, map } = this.deps;
    return characters.size + props.size + crowd.size + vehicles.size + (map.current?.size ?? 0);
  }

  /** Characters dressed in an imported model. */
  get dressedCount(): number {
    return this.deps.characters.dressedCount;
  }

  /** Character models still loading. */
  get modelsLoading(): number {
    return this.deps.characters.loadingCount;
  }

  /** Activity a character plays now. */
  activityOf(id: EntityId): ActivityId | null {
    return this.deps.activities.activityOf(id);
  }

  /** Residents in the world and how many of them were drawn last frame. */
  get crowdStats(): { readonly residents: number; readonly drawn: number } {
    return { residents: this.deps.crowd.size, drawn: this.deps.crowd.drawn };
  }

  /** The street's vehicles: driving, drawn near and far, parked, and their meshes. */
  get vehicleStats(): VehicleViews["stats"] {
    return this.deps.vehicles.stats;
  }

  /** Kit meshes built for skinned blocks. */
  get cityMeshes(): number {
    return this.deps.cityKit.meshCount;
  }

  /** What the map city holds and draws; null before the first map view. */
  get mapStats(): MapCityStats | null {
    return this.deps.map.current?.stats ?? null;
  }

  /** Every cell near the camera is drawn in detail and the wet probe has caught up (G-114); tests wait for it before a sample. */
  get citySettled(): boolean {
    const { map, wet, metro } = this.deps;
    return (map.current?.settled ?? true) && !(wet?.pending && !metro.active);
  }

  /** Renders of the wet-asphalt probe so far, null without one. */
  get wetProbeRenders(): number | null {
    return this.deps.wet?.renderCount ?? null;
  }

  /** District whose colours are on screen. */
  get paletteDistrict(): DistrictId | null {
    return this.deps.fx.paletteDistrict;
  }

  /** True while the metro car is on screen. */
  get metroRiding(): boolean {
    return this.deps.metro.active;
  }
}
