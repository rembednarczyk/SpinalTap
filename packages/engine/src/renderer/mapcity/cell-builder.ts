import type { EntityId } from "@seki/core";
import { ALCHEMIA_CUTS, METRO_CUTS } from "@seki/sim";
import type { Mesh, Scene } from "../../babylon";
import type { MoonShadow } from "../../npr/moon-shadow";
import type { ToonMaterials } from "../../npr/toon-material";
import type { CityProps } from "../city-props";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { planPavilionSigns } from "../metro/pavilion-signs";
import { findSpans, planFarCanyon, planNearCanyon } from "./canyon-plan";
import { planCanyonSigns } from "./canyon-signs";
import { planGround } from "./cell-ground";
import { planFarFrames, planNearFrames } from "./cell-plan";
import { facadeFrame } from "./facade-frame";
import { type ObstacleQuery, type PropSlot, bakeSlots } from "./facade-props";
import { cutGround } from "./ground-cut";
import { planTerrain } from "./ground-plan";
import { withLandmark } from "./landmarks";
import type { Cell } from "./map-cells";
import type { MapEntries, TerrainEntry } from "./map-entries";
import type { MapSignMaterial } from "./map-signs";
import type { MapWaterMaterial } from "./map-water";

/**
 * The ground dug out under the metro's pavilions (ADR-0071 stage 2) and Alchemia's food hall
 * (ADR-0074): no terrain or paving over their stairs and halls.
 */
const SHAFTS = [...METRO_CUTS, ...ALCHEMIA_CUTS].map((c) => c.bounds);

export interface CellBuilderDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow | null;
  /** The phone's lighter plans. */
  readonly lite: boolean;
  readonly entries: MapEntries;
  readonly signs: MapSignMaterial;
  readonly water: MapWaterMaterial;
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
      return e ? [withLandmark(facadeFrame(entries.building(id, e), entries.neighbourAt, entries.neighboursNear), e.landmark)] : [];
    });
    cell.spans = cell.frames.flatMap((f) => findSpans(f, entries.acrossAt));
    const far = new MeshSink();
    const signs = new MeshSink();
    planFarFrames(far, signs, cell.frames, (name) => this.deps.signs.slotFor(name), entries.drawnGround, lite);
    planFarCanyon(far, cell.spans);
    planCanyonSigns(signs, cell.frames, cell.spans, lite);
    // The metro's names (ADR-0071 stage 3) join a cell's signs, never make a mesh of their own.
    if (!signs.empty) planPavilionSigns(signs, cell.bounds);
    cell.far = far.empty ? null : this.mesh(`map-far-${cell.key}`, far, "facade");
    if (!signs.empty) {
      const m = sinkToMesh(this.deps.scene, `map-signs-${cell.key}`, signs, true);
      m.material = this.deps.signs.material;
      cell.signs = m;
    }
    this.ground(cell);
    cell.lod = "off";
    for (const m of [cell.far, cell.signs, cell.ground, cell.water]) m?.setEnabled(false);
  }

  private ground(cell: Cell): void {
    const { entries } = this.deps;
    const ground = new MeshSink();
    const water = new MeshSink();
    for (const id of [...cell.grounds].sort((a, b) => a - b)) planGround(ground, water, entries, id);
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
    // Only the detailed buildings near the camera cast the moon shadow.
    this.deps.shadow?.addCaster(m);
  }

  private mesh(name: string, sink: MeshSink, preset: "facade" | "mapGround" | "mapTerrain"): Mesh {
    const m = sinkToMesh(this.deps.scene, name, sink, true);
    m.material = this.deps.materials.get(preset);
    return m;
  }
}
