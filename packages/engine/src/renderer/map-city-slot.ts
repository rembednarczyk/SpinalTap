import type { Scene, Vector3 } from "../babylon";
import type { MoonShadow } from "../npr/moon-shadow";
import type { RenderQuality } from "../npr/quality";
import type { ToonMaterials } from "../npr/toon-material";
import type { CityProps } from "./city-props";
import { groundLift } from "./ground-lift";
import { MapCity } from "./mapcity/map-city";
import { sightBlocked } from "./mapcity/sight";

export interface MapCitySlotDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow;
  readonly quality: RenderQuality;
  /** The facade props of the city kit once they loaded, null before (ADR-0058). */
  readonly props: () => CityProps | null;
}

/**
 * The map city's place behind the `BabylonRenderer` facade (ADR-0044): made on first use, so
 * scenes without map data stay exactly as they were, and handed the light and the calm mode
 * it missed. Answers the queries other parts ask of the map's surfaces.
 */
export class MapCitySlot {
  private city: MapCity | null = null;
  private daylight = 0;
  private reduceFlashes = false;

  constructor(private readonly deps: MapCitySlotDeps) {}

  /** The map city, null before the first map view. */
  get current(): MapCity | null {
    return this.city;
  }

  /** The map city, made now if it was not yet. */
  get(): MapCity {
    if (!this.city) {
      const { scene, materials, shadow, quality } = this.deps;
      this.city = new MapCity({ scene, materials, shadow, quality });
      this.city.setDaylight(this.daylight);
      this.city.setReduceFlashes(this.reduceFlashes);
      const props = this.deps.props();
      if (props) this.city.setProps(props);
    }
    return this.city;
  }

  /** Feet lift on the map's surfaces (ADR-0045), or on the old street's sidewalks without map data. */
  readonly liftAt = (x: number, y: number, z: number): number => (this.city ? this.city.surfaceLift(x, y, z) : groundLift(x, y, z));

  /** Line of sight through the map city: its buildings and its terrain hide what is behind. */
  readonly sight = (from: Vector3, to: Vector3): boolean => {
    const city = this.city;
    return city !== null && sightBlocked((x, y, z) => city.roofOver(x, y, z) || y < (city.heightAt(x, z) ?? -Infinity) - 0.3, from, to);
  };

  /** Terrain height of the map city at (x, z), null outside its terrain (preview camera, tests). */
  heightAt(x: number, z: number): number | null {
    return this.city?.heightAt(x, z) ?? null;
  }

  /** Night 0 .. day 1 (ADR-0017), kept for a city made later. */
  setDaylight(daylight: number): void {
    this.daylight = daylight;
    this.city?.setDaylight(daylight);
  }

  /** Accessibility (ADR-0028), kept for a city made later. */
  setReduceFlashes(on: boolean): void {
    this.reduceFlashes = on;
    this.city?.setReduceFlashes(on);
  }
}
