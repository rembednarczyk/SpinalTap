import type { EntityId } from "@seki/core";
import { ALCHEMIA_CUTS, METRO_CUTS, W3_CUTS } from "@seki/sim";
import type { Mesh, Scene } from "../../babylon";
import type { MoonShadow } from "../../npr/moon-shadow";
import type { ToonMaterials } from "../../npr/toon-material";
import type { CityProps } from "../city-props";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { planPavilionSigns } from "../metro/pavilion-signs";
import { planAlchemiaSigns } from "../alchemia/front-signs";
import { planDeptakSigns } from "../alchemia/deptak-signs";
import { findSpans, planFarCanyon, planNearCanyon } from "./canyon-plan";
import { planCanyonSigns } from "./canyon-signs";
import { planFaraHolo } from "./fara-holo-signs";
import { planFestoons, planNeonEdges } from "./festoon-signs";
import { planGround } from "./cell-ground";
import { planFarFrames, planNearFrames } from "./cell-plan";
import { facadeFrame } from "./facade-frame";
import { type ObstacleQuery, type PropSlot, bakeSlots } from "./facade-props";
import { type SiteTextMap, planSiteSigns } from "./construction/site-signs";
import { cutGround } from "./ground-cut";
import { planTerrain } from "./ground-plan";
import { withLandmark } from "./landmarks";
import type { Cell } from "./map-cells";
import type { MapEntries, TerrainEntry } from "./map-entries";
import type { MapSignMaterial } from "./map-signs";
import type { MapWaterMaterial } from "./map-water";
import { MAP_SIGN_KIND } from "./sign-plan";
import { WaterField } from "./water-field";

/**
 * The ground dug out under the metro's pavilions (ADR-0071 stage 2), Alchemia's food hall
 * (ADR-0074) and in W-3's hall (ADR-0082 stage 2: its shafts down to the basement, store S's
 * levelled floor, the culvert's mouth): no terrain or paving over their stairs and floors.
 */
const SHAFTS = [...METRO_CUTS, ...ALCHEMIA_CUTS, ...W3_CUTS].map((c) => c.bounds);

export interface CellBuilderDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow | null;
  /** The phone's lighter plans. */
  readonly lite: boolean;
  readonly entries: MapEntries;
  readonly signs: MapSignMaterial;
  readonly water: MapWaterMaterial;
  /** The building sites' board texts in the player's language (ADR-0087 stage 2), by catalog key. */
  readonly siteTexts: () => SiteTextMap;
}

/**
 * Builds the meshes of the map city (ADR-0044) from its entries: a terrain chunk, a cell's far,
 * sign, ground and water meshes, and its near mesh with the full facades.
 */
export class CellBuilder {
  constructor(private readonly deps: CellBuilderDeps) {}

  terrain(id: EntityId, t: TerrainEntry): Mesh | null {
    const sink = new MeshSink();
    planTerrain(sink, t.grid, t.open);
    cutGround(sink, SHAFTS);
    return sink.empty ? null : this.mesh(`map-terrain-${id}`, sink, "mapTerrain");
  }

  /** The facade frames and spans of a cell, its far and sign meshes, then its ground and water. */
  cell(cell: Cell): void {
    const { entries, lite } = this.deps;
    const ids = [...cell.buildings].sort((a, b) => a - b);
    cell.frames = ids.flatMap((id) => {
      const e = entries.buildings.get(id);
      return e ? [withLandmark(facadeFrame(entries.building(id, e), entries.neighbourAt, entries.neighboursNear, entries.mapEdgeAt), e.landmark)] : [];
    });
    cell.spans = cell.frames.flatMap((f) => findSpans(f, entries.acrossAt));
    const far = new MeshSink();
    const signs = new MeshSink();
    const field = new WaterField(entries, cell.bounds);
    // The rows of the names atlas its plaques take, given back when it is built again or goes (G-916).
    const names: string[] = [];
    const nameSlot = (name: string): number | null => {
      const slot = this.deps.signs.slotFor(name);
      if (slot !== null) names.push(name);
      return slot;
    };
    planFarFrames(far, signs, cell.frames, nameSlot, entries.drawnGround, lite);
    cell.names = names;
    planFarCanyon(far, cell.spans);
    planCanyonSigns(signs, cell.frames, cell.spans, lite);
    // The metro's glass and names (ADR-0071 stage 3) join a cell's signs; the glass is a pavilion's walls, so in any cell.
    planPavilionSigns(signs, cell.bounds, lite);
    // So do the building sites' beacons and boards (ADR-0087 stage 2), the boards in the player's language.
    if (!signs.empty) planSiteSigns(signs, cell.bounds, this.deps.siteTexts(), lite);
    // So does the light of Alchemia's front (ADR-0074 C4): its sign's letters, the holograms, the screens' pictures.
    if (!signs.empty) planAlchemiaSigns(signs, cell.bounds);
    // And the neons of the deptak on Lubartowska on the tenement across from it (ADR-0074 C7).
    if (!signs.empty) planDeptakSigns(signs, cell.bounds);
    // And the hologram of the parish church over its foundations on Plac po Farze, whether the cell has signs or not.
    planFaraHolo(signs, cell.bounds);
    // And the markets' festoons (Plac Zamkowy's from its lamp posts, the night markets' across their aisles) and their canopies' neon strips (24.11).
    planFestoons(signs, cell.bounds);
    planNeonEdges(signs, cell.bounds);
    cell.far = far.empty ? null : this.mesh(`map-far-${cell.key}`, far, "facade");
    if (!signs.empty) {
      // The neon's streaks shine in the puddles of the ground under them (ADR-0084).
      field.bakeOver(signs, (v) => Math.round(signs.uvs2[v * 2 + 1] ?? 0) === MAP_SIGN_KIND.reflection);
      const m = sinkToMesh(this.deps.scene, `map-signs-${cell.key}`, signs, true);
      m.material = this.deps.signs.material;
      cell.signs = m;
    }
    this.ground(cell, field);
    cell.lod = "off";
    for (const m of [cell.far, cell.signs, cell.ground, cell.water]) m?.setEnabled(false);
  }

  /** Gives back the rows of the names atlas the cell's plaques took (G-916). */
  releaseNames(cell: Cell): void {
    for (const name of cell.names) this.deps.signs.release(name);
    cell.names = [];
  }

  /** The cell's ground with its water field (ADR-0084), piece by piece, and its water. */
  private ground(cell: Cell, field: WaterField): void {
    const { entries } = this.deps;
    const ground = new MeshSink();
    const water = new MeshSink();
    for (const id of [...cell.grounds].sort((a, b) => a - b)) {
      planGround(ground, water, entries, id);
      field.bake(ground, entries.grounds.get(id));
    }
    cutGround(ground, SHAFTS);
    cell.ground = ground.empty ? null : this.mesh(`map-ground-${cell.key}`, ground, "mapGround");
    if (!water.empty) {
      const m = sinkToMesh(this.deps.scene, `map-water-${cell.key}`, water, false);
      m.material = this.deps.water.material;
      cell.water = m;
    }
  }

  /** The cell's detailed buildings, with the facade props baked in once they have loaded (ADR-0058). */
  near(cell: Cell, facadeProps: CityProps | null, obstacles: ObstacleQuery): void {
    cell.near?.dispose(false, false);
    cell.near = null;
    cell.nearDirty = false;
    const sink = new MeshSink();
    const lite = this.deps.lite;
    const slots: PropSlot[] = [];
    const place = facadeProps ? (s: PropSlot) => slots.push(s) > 0 : undefined;
    planNearFrames(sink, cell.frames, lite, place, obstacles);
    if (facadeProps) bakeSlots(sink, facadeProps, slots, lite);
    planNearCanyon(sink, cell.spans, lite, this.deps.entries.drawnGround);
    if (sink.empty) return;
    const m = this.mesh(`map-near-${cell.key}`, sink, "facade");
    m.setEnabled(false);
    cell.near = m;
    // Only the detailed buildings near the camera cast the moon shadow; they never move, so the
    // shadow keeps them between frames while the view stands still.
    this.deps.shadow?.addFixedCaster(m);
  }

  private mesh(name: string, sink: MeshSink, preset: "facade" | "mapGround" | "mapTerrain"): Mesh {
    const m = sinkToMesh(this.deps.scene, name, sink, true);
    m.material = this.deps.materials.get(preset);
    return m;
  }
}
