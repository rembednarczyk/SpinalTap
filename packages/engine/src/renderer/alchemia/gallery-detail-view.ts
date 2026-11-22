import { FRONT_SHOP_DETAIL, GALLERY_DETAIL } from "@seki/sim";
import type { Mesh, Scene } from "../../babylon";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import type { CityProps } from "../city-props";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { toWorld } from "../mapcity/prop-batch";
import { bakeRoomDetail } from "../mapcity/room-detail-models";

export interface GalleryDetailDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  /** The rooms' detail's models once the props files have loaded (ADR-0098). */
  readonly props: () => CityProps | null;
  readonly quality: RenderQuality;
}

/**
 * The goods of Alchemia's shops (ADR-0098, `docs/pomieszczenia/alchemia-gallery.md`): Blender's models on their shelves,
 * in their cases and on their rails, the windows' mannequins, baked into one mesh on the street props' material and drawn
 * with the hall's inside only, as the boxes of goods they stand for were (`AlchemiaView`). Some two thousand models: in
 * the city's furniture block they would be drawn whenever the block is near (from 170 m, Neon Koi's street included), the
 * hall's walls between. Built once the props have loaded, on the phone with their simpler models.
 */
export class GalleryDetailView {
  private mesh: Mesh | null = null;
  private seen: CityProps | null = null;

  constructor(private readonly deps: GalleryDetailDeps) {}

  /** Its triangles (debug, tests). */
  get triangles(): number {
    return this.mesh ? this.mesh.getTotalIndices() / 3 : 0;
  }

  get shown(): boolean {
    return this.mesh?.isEnabled(false) ?? false;
  }

  /** Shown with the hall's inside, built the first time it is shown after the props have loaded. */
  show(on: boolean): void {
    const props = this.deps.props();
    if (on && props && props !== this.seen) this.build(props);
    if (this.mesh && this.mesh.isEnabled(false) !== on) this.mesh.setEnabled(on);
  }

  private build(props: CityProps): void {
    this.seen = props;
    const sink = new MeshSink();
    for (const p of toWorld([...GALLERY_DETAIL, ...FRONT_SHOP_DETAIL], { x: 0, y: 0, z: 0 })) bakeRoomDetail(sink, props, p, this.deps.quality);
    this.mesh?.dispose(false, false);
    this.mesh = null;
    if (sink.empty) return;
    const m = sinkToMesh(this.deps.scene, "alchemia-goods", sink);
    m.material = this.deps.materials.get("streetProp");
    m.isPickable = false;
    m.freezeWorldMatrix();
    m.setEnabled(false);
    this.mesh = m;
  }
}
