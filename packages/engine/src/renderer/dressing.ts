import type { EntityId, Vec3, ViewDescriptor } from "@seki/core";
import { type ChunkDef, WORLD_CHUNKS, chunkAt, distanceToRect } from "@seki/sim";
import { type Mesh, MeshClass, type Scene, VertexData } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import { type DressBlock, type DressSign, planDressing } from "./dressing-plan";
import type { MeshSink } from "./mesh-sink";
import { planSidewalks } from "./sidewalk-plan";

type BlockView = Extract<ViewDescriptor, { kind: "block" }>;
type NeonView = Extract<ViewDescriptor, { kind: "neon" }>;

/** Bakes a sink into a frozen, unpickable mesh with colours per vertex. */
export const sinkToMesh = (scene: Scene, name: string, sink: MeshSink, uv2 = false): Mesh => {
  const data = new VertexData();
  data.positions = sink.positions;
  data.normals = sink.normals;
  data.colors = sink.colors;
  data.uvs = sink.uvs;
  if (uv2) data.uvs2 = sink.uvs2;
  data.indices = sink.indices;
  const mesh = new MeshClass(name, scene);
  data.applyToMesh(mesh, false);
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
};

const placeKey = (p: Vec3): string => `${p.x.toFixed(2)}:${p.y.toFixed(2)}:${p.z.toFixed(2)}`;

/** Whether skinned buildings are drawn by the city kit, bare (no kit), or not known yet. */
export type KitState = "pending" | "kit" | "bare";

interface Bucket {
  readonly blocks: Map<EntityId, DressBlock>;
  readonly signs: Map<EntityId, DressSign>;
  mesh: Mesh | null;
  dirty: boolean;
}

export interface WorldDressingHooks {
  /** A dressing mesh was built: it casts the moon shadow. */
  readonly built?: (mesh: Mesh) => void;
  /** A dressing mesh is about to be disposed. */
  readonly released?: (mesh: Mesh) => void;
}

/**
 * Procedural set dressing for every streaming chunk (ADR-0027, W9): blocks are grouped by the
 * chunk they stand in; a chunk's dressing is baked into one vertex-coloured mesh when its blocks
 * stream in and released when the last of them streams out. Rebuilt lazily, once per frame at
 * most. While the city kit is still loading nothing is built, so skinned buildings are never
 * dressed twice.
 */
export class WorldDressing {
  private readonly buckets = new Map<string, Bucket>();
  private readonly where = new Map<EntityId, string>();
  private readonly all = new Map<EntityId, DressBlock>();
  private kit: KitState;

  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
    kit: KitState,
    private readonly hooks: WorldDressingHooks = {},
    private readonly chunks: readonly ChunkDef[] = WORLD_CHUNKS,
  ) {
    this.kit = kit;
    for (const c of chunks) for (const p of c.props) if (!this.owner.has(placeKey(p.center))) this.owner.set(placeKey(p.center), c.id);
  }

  /** Chunk of each prop placement in the table: chunk bounds overlap, so position alone is not enough. */
  private readonly owner = new Map<string, string>();

  /** Chunk a prop at this point belongs to: by its placement, else the chunk it lies in, else the nearest. */
  chunkOf(p: Vec3): string {
    const owned = this.owner.get(placeKey(p));
    if (owned !== undefined) return owned;
    const inside = chunkAt(p.x, p.z, this.chunks);
    if (inside) return inside.id;
    let best = "";
    let dist = Infinity;
    for (const c of this.chunks) {
      const d = distanceToRect(p.x, p.z, c.bounds);
      if (d < dist) {
        dist = d;
        best = c.id;
      }
    }
    return best;
  }

  setKit(state: KitState): void {
    if (state === this.kit) return;
    this.kit = state;
    for (const b of this.buckets.values()) b.dirty = true;
  }

  addBlock(id: EntityId, view: BlockView, center: Vec3): void {
    const block: DressBlock = {
      center: { x: center.x, y: center.y, z: center.z },
      size: view.size,
      material: view.material,
      ...(view.skin ? { skin: view.skin } : {}),
      ...(view.rungs ? { rungs: view.rungs } : {}),
      ...(view.slope ? { slope: view.slope } : {}),
    };
    this.bucketFor(id, center).blocks.set(id, block);
    this.all.set(id, block);
  }

  addSign(id: EntityId, view: NeonView, center: Vec3): void {
    this.bucketFor(id, center).signs.set(id, { center: { x: center.x, y: center.y, z: center.z }, size: view.size });
  }

  remove(id: EntityId): void {
    const key = this.where.get(id);
    if (key === undefined) return;
    this.where.delete(id);
    this.all.delete(id);
    const b = this.buckets.get(key);
    if (!b) return;
    b.blocks.delete(id);
    b.signs.delete(id);
    b.dirty = true;
  }

  /** Chunks with at least one block in view: resident, from the renderer's side. */
  residentChunks(): ReadonlySet<string> {
    const out = new Set<string>();
    for (const [key, b] of this.buckets) if (b.blocks.size > 0 && key !== "") out.add(key);
    return out;
  }

  /** Rebuilds the chunks whose blocks changed. Call once per frame before rendering. */
  flush(): boolean {
    if (this.kit === "pending") return false;
    let changed = false;
    const world = [...this.all.values()];
    for (const [key, b] of this.buckets) {
      if (!b.dirty) continue;
      b.dirty = false;
      changed = true;
      if (b.mesh) {
        this.hooks.released?.(b.mesh);
        b.mesh.dispose(false, false);
        b.mesh = null;
      }
      if (b.blocks.size === 0) {
        this.buckets.delete(key);
        continue;
      }
      const ids = [...b.blocks.keys()].sort((x, y) => x - y);
      const sink = planDressing({
        blocks: ids.map((id) => b.blocks.get(id)).filter((x): x is DressBlock => x !== undefined),
        world,
        signs: [...b.signs.values()],
        kit: this.kit === "kit",
      });
      // The chunk's sidewalks and crossings (ADR-0041) go into the same mesh.
      planSidewalks(sink, key);
      if (sink.empty) continue;
      const mesh = sinkToMesh(this.scene, `dressing-${key || "free"}`, sink);
      mesh.material = this.materials.get("dressing");
      b.mesh = mesh;
      this.hooks.built?.(mesh);
    }
    return changed;
  }

  /** Dressing meshes currently built (debug and tests). */
  get meshes(): Mesh[] {
    return [...this.buckets.values()].flatMap((b) => (b.mesh ? [b.mesh] : []));
  }

  private bucketFor(id: EntityId, center: Vec3): Bucket {
    this.remove(id);
    const key = this.chunkOf(center);
    let b = this.buckets.get(key);
    if (!b) {
      b = { blocks: new Map(), signs: new Map(), mesh: null, dirty: true };
      this.buckets.set(key, b);
    }
    b.dirty = true;
    this.where.set(id, key);
    return b;
  }
}
