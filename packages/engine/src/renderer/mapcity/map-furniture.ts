import type { CityProps } from "../city-props";
import { StreetProps, type StreetPropsDeps } from "./street-props";

/**
 * The map city's street furniture (ADR-0047), made on the first `street-props` view, and the
 * facade props (ADR-0058) it and the near meshes share once they have loaded.
 */
export class MapFurniture {
  private street: StreetProps | null = null;
  private daylight = 0;
  private facade: CityProps | null = null;

  constructor(private readonly deps: StreetPropsDeps) {}

  /** The street furniture, or null before the first `street-props` view. */
  get current(): StreetProps | null {
    return this.street;
  }

  /** The facade props baked into the near meshes (ADR-0058), once loaded. */
  get facadeProps(): CityProps | null {
    return this.facade;
  }

  /** The street furniture, made now if it is the first time. */
  get(): StreetProps {
    if (!this.street) {
      this.street = new StreetProps(this.deps);
      this.street.setDaylight(this.daylight);
      if (this.facade) this.street.setProps(this.facade);
    }
    return this.street;
  }

  setProps(props: CityProps): void {
    this.facade = props;
    this.street?.setProps(props);
  }

  setDaylight(daylight: number): void {
    this.daylight = daylight;
    this.street?.setDaylight(daylight);
  }
}
