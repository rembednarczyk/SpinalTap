import { DECAL_KINDS, type EntityId } from "@seki/core";
import type { Mesh, Scene } from "../../babylon";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { FINE_DECALS, bakeDecal } from "./decal-models";
import { bakeDoor } from "./door-models";
import { cellBounds } from "./map-index";
import { type WorldProp, bake } from "./prop-batch";
import { chainModel, farModel, propModel } from "./prop-models";
import type { PropPoles } from "./prop-poles";
import { type BlockBand, PROP_BLOCK } from "./prop-shapes";
import type { Box2 } from "./polygon";
import { bakeDogs, clearOf, gateDogs, stallDog } from "./robodogs";
import { bakeStreetModel } from "./street-models";
import { bakePoles } from "./utility-poles";

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
  far: null,
  dirty: true,
});

/** A block's pieces by entity id, so a block bakes the same whatever order its entities came in. */
export const sortedPieces = (block: PropBlock): WorldProp[] =>
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
    const f = deps.poles.isPole(p) ? deps.poles.far : farModel(p.prop, p.shape);
    if (f) bake(far, f, p);
  }
  block.far = blockMesh(deps, `props-far-${block.key}`, far);
};

/** The robot dogs of a block (ADR-0063): by its stalls and by the gateways in it; none on phones. */
const bakeBlockDogs = (deps: PropBakeDeps, sink: MeshSink, block: PropBlock, pieces: readonly WorldProp[]): void => {
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

/** Bakes a block's detailed pieces into one mesh on the street props' material (ADR-0050). */
export const bakeNear = (deps: PropBakeDeps, block: PropBlock): void => {
  block.baked = true;
  const sink = new MeshSink();
  const { poles } = deps;
  const pole = poles.pole;
  const pieces = sortedPieces(block);
  const models = poles.models;
  for (const p of pieces) {
    if (poles.isPole(p)) continue;
    // The decals (ADR-0058 stage 6) by their layouts; the phones go without the small ones.
    if (DECAL_KINDS.has(p.prop)) {
      if (deps.quality !== "low" || !FINE_DECALS.has(p.prop)) bakeDecal(sink, p);
      continue;
    }
    // A door on a facade (ADR-0058 stage 9) at its own size, its leaf a model where they have loaded.
    if (p.prop === "door") {
      bakeDoor(sink, models, p);
      continue;
    }
    if (models && bakeStreetModel(sink, models, p)) continue;
    bake(sink, propModel(p.prop, p.shape).sink, p);
    for (const c of p.chains ?? []) bake(sink, chainModel(c.end), { ...p, yaw: c.yaw });
  }
  if (pole && poles.props) bakePoles(sink, poles.props, pole, pieces.filter((p) => poles.isPole(p)));
  bakeBlockDogs(deps, sink, block, pieces);
  block.near = blockMesh(deps, `props-${block.key}`, sink);
};
