import type { Mesh, Vector3 } from "../babylon";
import type { EntityId, ViewDescriptor } from "@seki/core";
import type { MoonShadow } from "../npr/moon-shadow";
import type { ToonMaterials } from "../npr/toon-material";
import { CityKit } from "./city-kit";
import { type CityProps, parseCityProps } from "./city-props";
import { type DressBlock, isWalkedRoof } from "./dressing-plan";
import type { WorldDressing } from "./dressing";
import type { Stage } from "./stage";

export type BlockView = Extract<ViewDescriptor, { kind: "block" }>;

/** A skinned block waiting for the city kit. */
interface PendingSkin {
  readonly view: BlockView & { skin: NonNullable<BlockView["skin"]> };
  readonly center: Vector3;
  readonly box: Mesh | null;
}

export interface CityKitLoaderDeps {
  readonly stage: Stage;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow;
  readonly dressing: WorldDressing;
  /** Blocks in view, for the walked-roof test (ADR-0027, C8). */
  readonly blocks: () => Iterable<DressBlock>;
  /** Phones: the cheap versions of the facade props (ADR-0058). */
  readonly lite?: boolean;
  /** The facade props have loaded (ADR-0058): the map city bakes them into its cells too. */
  readonly onProps?: (props: CityProps) => void;
}

/**
 * The city kit (ADR-0022): loads it in the background, holds the skinned blocks that stream in
 * before it is ready, and tells the dressing whether it has a kit to dress around.
 */
export class CityKitLoader {
  /** Buildings and vehicles from the city kit, once it has loaded. */
  private city: CityKit | null = null;
  private readonly pendingSkins = new Map<EntityId, PendingSkin>();
  private daylight = 0;
  private cityProps: CityProps | null = null;

  constructor(private readonly deps: CityKitLoaderDeps) {}

  /** The kit once it has loaded (its models and material also draw the street's vehicles, ADR-0050). */
  get kit(): CityKit | null {
    return this.city;
  }

  /** The facade props once they have loaded (ADR-0058). */
  get props(): CityProps | null {
    return this.cityProps;
  }

  /**
   * Loads the kit in the background, then the facade props (ADR-0058) if there is a URL for
   * them; the scene is not ready (reference frames wait) until both are in.
   */
  load(url: string, propsUrl: string | null = null): void {
    const { scene } = this.deps.stage;
    const token = {};
    scene.addPendingData(token);
    CityKit.load(url)
      .then((data) => {
        if (scene.isDisposed) return;
        this.city = new CityKit(scene, this.deps.materials, this.deps.stage.glow, data, {
          onCovered: (box) => this.stepBack(box),
          walkedRoof: (center, size) => isWalkedRoof({ center, size }, this.deps.blocks()),
          lite: this.deps.lite === true,
        });
        this.city.setDaylight(this.daylight);
        for (const [id, p] of this.pendingSkins) this.city.add(id, p.view.skin, p.view.size, p.center, p.box);
        this.pendingSkins.clear();
        this.deps.dressing.setKit("kit");
        if (propsUrl) this.loadProps(propsUrl);
      })
      .catch((err: unknown) => {
        console.warn(`[city] ${url} failed to load, keeping plain blocks`, err);
        this.pendingSkins.clear();
        // The plain blocks get the procedural facades of every chunk (W9).
        this.deps.dressing.setKit("bare");
      })
      .finally(() => scene.removePendingData(token));
  }

  /** The props come after the kit: without them the procedural decor stays. */
  private loadProps(url: string): void {
    const { scene } = this.deps.stage;
    const token = {};
    scene.addPendingData(token);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`city props ${url}: ${res.status}`);
        return parseCityProps(await res.arrayBuffer());
      })
      .then((props) => {
        if (scene.isDisposed) return;
        this.cityProps = props;
        this.city?.setProps(props);
        this.deps.onProps?.(props);
      })
      .catch((err: unknown) => console.warn(`[city] ${url} failed to load, keeping the procedural decor`, err))
      .finally(() => scene.removePendingData(token));
  }

  /**
   * A box the kit now draws stays for the camera and the moon shadow, hidden. Its faces would
   * sit exactly on the model's walls and speckle them with shadow acne, so it steps back a
   * little inside them.
   */
  private stepBack(box: Mesh): void {
    const size = box.getBoundingInfo().boundingBox.extendSize;
    const inset = (half: number) => (half > 0 ? Math.max(0.5, (half - Math.min(0.25, half * 0.1)) / half) : 1);
    box.unfreezeWorldMatrix();
    const top = Math.min(0.3, size.y * 0.1);
    box.scaling.set(inset(size.x), size.y > 0 ? (size.y * 2 - top) / (size.y * 2) : 1, inset(size.z));
    box.position.y -= top / 2;
    box.freezeWorldMatrix();
    this.deps.shadow.invalidateStatics();
  }

  /** A skinned block: drawn from the kit now, or once it has loaded. */
  addSkin(id: EntityId, view: BlockView & { skin: NonNullable<BlockView["skin"]> }, center: Vector3, box: Mesh | null): void {
    if (this.city) this.city.add(id, view.skin, view.size, center, box);
    else this.pendingSkins.set(id, { view, center, box });
  }

  /** Rebuilds the kit cells around a point (a ladder or a roof rail makes a roof walked). */
  touch(x: number, z: number): void {
    this.city?.touch(x, z);
  }

  remove(id: EntityId): void {
    this.city?.remove(id);
    this.pendingSkins.delete(id);
  }

  setDaylight(daylight: number): void {
    this.daylight = daylight;
    this.city?.setDaylight(daylight);
  }

  flush(): void {
    this.city?.flush();
  }

  /** Kit meshes built for skinned blocks (debug and tests). */
  get meshCount(): number {
    return this.city?.meshCount ?? 0;
  }
}
