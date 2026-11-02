import type { RenderQuality } from "../../npr/quality";
import type { CityProps } from "../city-props";
import type { MeshSink } from "../mesh-sink";
import type { WorldProp } from "./prop-batch";
import { dogModel } from "./robodogs";
import { farPole, poleFits, poleModel } from "./utility-poles";

/**
 * The CC-BY street props of the street furniture (ADR-0063): the props file once it has loaded,
 * the utility pole and its far model, the robot dog, and which pole lamps are drawn as poles.
 * None of them on phones.
 */
export class PropPoles {
  /** The CC-BY street props (ADR-0063): poles, robot dogs and the street furniture, once the props files have loaded. */
  private cityProps: CityProps | null = null;
  /** Lamps whose pole fits clear of the buildings (`poleFits`), worked out once each. */
  private readonly fits = new WeakMap<WorldProp, boolean>();
  private farPoleModel: MeshSink | null = null;

  constructor(private readonly quality: RenderQuality) {}

  /** The props file has loaded: its pole and far pole from now on. */
  setProps(props: CityProps): void {
    this.cityProps = props;
    const pole = this.pole;
    this.farPoleModel = pole ? farPole(pole) : null;
  }

  /** The props file once it has loaded, whatever the quality. */
  get props(): CityProps | null {
    return this.cityProps;
  }

  /** The CC-BY street furniture (ADR-0063) where it has loaded; not on phones, like the poles. */
  get models(): CityProps | null {
    return this.quality === "low" ? null : this.cityProps;
  }

  /** The pole of the props file where road lamps become poles (not on phones, ADR-0063), or null. */
  get pole() {
    return this.quality === "low" ? null : poleModel(this.cityProps);
  }

  /** The simplified pole of the far meshes, once the props file has loaded. */
  get far(): MeshSink | null {
    return this.farPoleModel;
  }

  /** The robot dog (ADR-0063), or null on phones and before the props load. */
  get dog() {
    return this.quality === "low" ? null : dogModel(this.cityProps);
  }

  /** Is this piece drawn as a utility pole now: a pole lamp, the props loaded, its pole clear of the buildings. */
  isPole(p: WorldProp): boolean {
    const pole = this.pole;
    if (!pole || !p.pole) return false;
    let fits = this.fits.get(p);
    if (fits === undefined) {
      fits = poleFits(pole, p);
      this.fits.set(p, fits);
    }
    return fits;
  }
}
