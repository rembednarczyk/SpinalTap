import { DECAL_KINDS, type EntityId, SITE_KINDS } from "@seki/core";
import type { Mesh, Scene } from "../../babylon";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { bakePavilion, bakePavilionFar, pavilionsIn } from "../metro/pavilion-bake";
import { alchemiaIn, arkadyIn, bakeAlchemiaStandIn, bakeArkadyStandIn } from "../alchemia/alchemia-far";
import { bakePavilionStandIn, pavilionIn } from "../alchemia/pavilion-far";
import { bakeParkingStandIn, parkingIn } from "../alchemia/parking-far";
import { bakeP2StandIn, p2In } from "../alchemia/p2-far";
import { bakeBarrier } from "./barrier-models";
import { bakeSitePiece } from "./construction";
import { FINE_DECALS, bakeDecal } from "./decal-models";
import { bakeDoor } from "./door-models";
import { bakeFigure } from "./figure-models";
import { bakeClutter } from "./clutter-models";
import { cellBounds } from "./map-index";
import { type WorldProp, bake } from "./prop-batch";
import { chainModel, farModel, nearModel } from "./prop-models";
import type { PropPoles } from "./prop-poles";
import { type BlockBand, PROP_BLOCK } from "./prop-shapes";
import type { Box2 } from "./polygon";
import { bakeDogs, clearOf, gateDogs, stallDog } from "./robodogs";
import { type BakePart, type PackedMesh, SlicedBake, packedToMesh } from "./sliced-bake";
import { bakeStreetModel } from "./street-models";
import { bakePoles } from "./utility-poles";
import { TileLayout, TileLod, inDetailTile } from "./detail-tiles";

/**
 * A 256 m block of the map city's street furniture: its pieces, the detailed mesh baked when it
 * first comes near and the far mesh of simplified trees, lamps and monuments.
 */
export interface PropBlock {
  readonly key: string;
  readonly bounds: Box2;
  readonly pieces: Map<EntityId, WorldProp[]>;
  band: BlockBand;
  near: Mesh | null;
  /** Its detailed mesh is baked for its pieces as they are now. */
  baked: boolean;
  /** Its detailed mesh while it is being baked (`continueNear`), with the tiles of its trees and bollards. */
  job: SlicedBake | null;
  layout?: TileLayout | null;
  /** The level of each tile of its detailed mesh (`detail-tiles.ts`). */
  lod?: TileLod | null;
  far: Mesh | null;
  dirty: boolean;
}

/** What baking a block's meshes needs: the scene, the street props' material, the quality and the CC-BY props. */
export interface PropBakeDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly quality: RenderQuality;
  readonly poles: PropPoles;
}

/** A new empty block at a key of the `PROP_BLOCK` grid, dirty until its first flush. */
export const newBlock = (key: string): PropBlock => ({
  key,
  bounds: cellBounds(key, PROP_BLOCK),
  pieces: new Map(),
  band: "off",
  near: null,
  baked: false,
  job: null,
  far: null,
  dirty: true,
});

/** A block's pieces by entity id, so a block bakes the same whatever order its entities came in. */
export const sortedPieces = (block: Pick<PropBlock, "pieces">): WorldProp[] =>
  [...block.pieces.keys()].sort((a, b) => a - b).flatMap((id) => block.pieces.get(id)!);

const blockMesh = (deps: PropBakeDeps, name: string, sink: MeshSink): Mesh | null => {
  if (sink.empty) return null;
  const m = sinkToMesh(deps.scene, name, sink);
  m.material = deps.materials.get("streetProp");
  m.setEnabled(false);
  return m;
};

/** Builds a block's far mesh of simplified trees, lamps, monuments and poles. */
export const buildFar = (deps: PropBakeDeps, block: PropBlock): void => {
  const far = new MeshSink();
  for (const p of sortedPieces(block)) {
    // The map's barriers (ADR-0077) are drawn near only.
    if (p.prop === "barrier") continue;
    const f = deps.poles.isPole(p) ? deps.poles.far : farModel(p.prop, p.shape);
    if (f) bake(far, f, p);
  }
  for (const e of pavilionsIn(block.bounds)) bakePavilionFar(far, e);
  // Alchemia's food hall, the Arkady, the pavilion, P-1's trench and P-2's cutting from afar (ADR-0074): its detailed mesh is drawn near it only.
  if (alchemiaIn(block.bounds)) bakeAlchemiaStandIn(far);
  if (arkadyIn(block.bounds)) bakeArkadyStandIn(far);
  if (pavilionIn(block.bounds)) bakePavilionStandIn(far);
  if (parkingIn(block.bounds)) bakeParkingStandIn(far);
  if (p2In(block.bounds)) bakeP2StandIn(far);
  block.far = blockMesh(deps, `props-far-${block.key}`, far);
};

/** The robot dogs of a block (ADR-0063): by its stalls and by the gateways in it; none on phones. */
const bakeBlockDogs = (deps: Pick<PropBakeDeps, "poles">, sink: MeshSink, block: Pick<PropBlock, "bounds">, pieces: readonly WorldProp[]): void => {
  const dog = deps.poles.dog;
  const cityProps = deps.poles.props;
  if (!dog || !cityProps) return;
  const b = block.bounds;
  const spots = [
    ...pieces.flatMap((p) => {
      const s = stallDog(p);
      return s && clearOf(s, pieces, p) ? [s] : [];
    }),
    ...gateDogs().filter((s) => s.at.x >= b.minX && s.at.x < b.maxX && s.at.z >= b.minZ && s.at.z < b.maxZ && clearOf(s, pieces)),
  ];
  bakeDogs(sink, cityProps, dog, spots);
};

/** One piece of a block's detailed mesh, as `nearSink` bakes it (the poles are baked together). */
const bakePiece = (deps: Pick<PropBakeDeps, "quality" | "poles">, sink: MeshSink, p: WorldProp): void => {
  const { poles } = deps;
  const models = poles.models;
  // The decals (ADR-0058 stage 6) by their layouts; the phones go without the small ones.
  if (DECAL_KINDS.has(p.prop)) {
    if (deps.quality !== "low" || !FINE_DECALS.has(p.prop)) bakeDecal(sink, p);
    return;
  }
  // A door on a facade (ADR-0058 stage 9) at its own size, its leaf a model where they have loaded.
  if (p.prop === "door") bakeDoor(sink, models, p);
  // A wall, fence, hedge or gate of the map (ADR-0077), baked at its own length, height and rise.
  else if (p.prop === "barrier") bakeBarrier(sink, p, deps.quality);
  // A building site's piece (ADR-0087), at its own layout.
  else if (SITE_KINDS.has(p.prop)) bakeSitePiece(sink, p, deps.quality);
  // A still figure (ADR-0058 stage 8): a model of the crowd's file on every quality, nobody before it loads.
  else if (p.prop === "figure") bakeFigure(sink, poles.props, p, deps.quality);
  // The odds and ends of ADR-0096: models of `extra-props.glb` only.
  else if (p.prop === "clutter") bakeClutter(sink, poles.props, p, deps.quality);
  else if (!(models && bakeStreetModel(sink, models, p))) {
    bake(sink, nearModel(p.prop, p.shape, deps.quality), p);
    for (const c of p.chains ?? []) bake(sink, chainModel(c.end, deps.quality), { ...p, yaw: c.yaw });
  }
};

/** The parts of a block's detailed mesh in the order they are baked: a piece, the poles, the dogs, a pavilion, the stand-ins. */
const nearSteps = (deps: Pick<PropBakeDeps, "quality" | "poles">, block: Pick<PropBlock, "pieces" | "bounds">, tiled = false): BakePart[] => {
  const { poles } = deps;
  const pieces = sortedPieces(block);
  // The trees and bollards after them, in tiles of two levels of detail when drawn (`detail-tiles.ts`).
  const own = tiled ? pieces.filter((p) => !inDetailTile(p, deps.quality)) : pieces;
  const steps: BakePart[] = own.filter((p) => !poles.isPole(p)).map((p) => (sink) => bakePiece(deps, sink, p));
  const { pole, props } = poles;
  if (pole && props) steps.push((sink) => bakePoles(sink, props, pole, pieces.filter((p) => poles.isPole(p))));
  steps.push((sink) => bakeBlockDogs(deps, sink, block, pieces));
  // The metro's pavilions standing in the block (ADR-0071 stages 2 and 3): no mesh of their own.
  for (const e of pavilionsIn(block.bounds)) steps.push((sink) => bakePavilion(sink, e, deps.quality));
  // And under Alchemia's detailed mesh, hidden by it near the hall, standing in for it beyond.
  steps.push((sink) => {
    if (alchemiaIn(block.bounds)) bakeAlchemiaStandIn(sink);
    if (arkadyIn(block.bounds)) bakeArkadyStandIn(sink);
    if (pavilionIn(block.bounds)) bakePavilionStandIn(sink);
    if (parkingIn(block.bounds)) bakeParkingStandIn(sink);
    if (p2In(block.bounds)) bakeP2StandIn(sink);
  });
  return steps;
};

/**
 * A block's detailed pieces as one sink (ADR-0050), as `bakeNear` draws them: pure, so the glitch
 * scan flies the low patrols (ADR-0058 stage 7b) through the furniture the city draws.
 */
export const nearSink = (deps: Pick<PropBakeDeps, "quality" | "poles">, block: Pick<PropBlock, "pieces" | "bounds">): MeshSink => {
  const sink = new MeshSink();
  for (const step of nearSteps(deps, block)) step(sink);
  return sink;
};

/**
 * Bakes on a block's detailed mesh (ADR-0050) until `stop()`, asked after each part, so a frame
 * bakes some milliseconds of it and not a whole block of some hundred thousand vertices; the mesh
 * is made of the baked parts (the same vertices as `nearSink`) once they are in, in the same call
 * if `stop()` leaves time, else at the start of the next. True when it is made.
 */
export const continueNear = (deps: PropBakeDeps, block: PropBlock, stop: () => boolean): boolean => {
  const job = (block.job ??= newJob(deps, block));
  if (!job.ready) {
    job.run(stop);
    if (!job.ready || stop()) return false;
  }
  nearMesh(deps, block, job.packed!);
  return true;
};

/** A block's bake: its own pieces, then its trees and bollards in full and coarse per tile (`detail-tiles.ts`). */
const newJob = (deps: PropBakeDeps, block: PropBlock): SlicedBake => {
  let job: SlicedBake | null = null;
  const layout = new TileLayout(sortedPieces(block), deps.quality, () => job!);
  job = new SlicedBake([...nearSteps(deps, block, true), ...layout.parts]);
  block.layout = layout;
  return job;
};

const nearMesh = (deps: PropBakeDeps, block: PropBlock, packed: PackedMesh): void => {
  const m = packedToMesh(deps.scene, `props-${block.key}`, packed);
  const layout = block.layout;
  block.lod = null;
  if (m) {
    m.material = deps.materials.get("streetProp");
    m.setEnabled(false);
    if (layout && layout.tiles.length > 0) {
      block.lod = new TileLod(m, packed.indices, layout);
      // Coarse until the next update reads the camera.
      block.lod.show({ x: Infinity, z: Infinity });
    }
  }
  block.job = null;
  block.layout = null;
  block.baked = true;
  block.near = m;
};

/** Bakes a block's detailed pieces into one mesh on the street props' material (ADR-0050), all at once. */
export const bakeNear = (deps: PropBakeDeps, block: PropBlock): void => {
  nearMesh(deps, block, (block.job ?? newJob(deps, block)).finish());
};
