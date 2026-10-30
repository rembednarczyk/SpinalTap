import type { EntityId, StreetPropItem, StreetPropKind, Vec3 } from "@seki/core";
import type { Mesh, Scene } from "../../babylon";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { cellBounds, cellKey } from "./map-index";
import { type WorldProp, bake, planHalos, toWorld } from "./prop-batch";
import { PropHaloMaterial } from "./prop-halo";
import { chainModel, farModel, propModel } from "./prop-models";
import { type BlockBand, PROP_BLOCK, PROP_LOD, type PropLod, blockBand } from "./prop-shapes";
import { type Box2, distanceToBox } from "./polygon";

/**
 * A 256 m block of the map city's street furniture: its pieces, the detailed mesh baked when it
 * first comes near and the far mesh of simplified trees, lamps and monuments.
 */
interface PropBlock {
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

export interface StreetPropsDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly quality: RenderQuality;
}

export interface StreetPropsStats {
  /** Pieces held. */
  readonly pieces: number;
  /** Blocks with pieces. */
  readonly cells: number;
  /** Detailed pieces drawn now, per kind. */
  readonly drawn: Readonly<Record<string, number>>;
  /** Detailed block meshes drawn now (one draw call per pass each). */
  readonly groups: number;
  /** Blocks drawing their far mesh. */
  readonly far: number;
}

/** The kinds that light the street at night and get halos. */
const LIT = (kind: StreetPropKind): boolean => kind.startsWith("lamp-") || kind === "floodlight";

/** Blocks baked per frame at most: a block coming near does not stall more than a frame. */
const BAKES_PER_FRAME = 1;

const distance = (eye: Vec3, b: Box2): number => Math.hypot(distanceToBox(eye.x, eye.z, b), Math.max(eye.y - 2, 0));

/**
 * Street furniture of the map city (ADR-0047, ADR-0050) behind the `BabylonRenderer` facade.
 * Pieces fall into 256 m blocks. A block within the detail distance draws all its pieces baked
 * into one mesh (baked when it first comes near, kept after); further away its far mesh of
 * simplified trees, lamps and monuments; beyond that nothing. So the draw calls follow the
 * blocks in view (two or three), not the kinds of furniture in them, which as thin instances per
 * kind cost one draw call per kind in view. The halos of every lamp of the city are one
 * additive mesh.
 */
export class StreetProps {
  private readonly entities = new Map<EntityId, Set<string>>();
  private readonly blocks = new Map<string, PropBlock>();
  private readonly halo: PropHaloMaterial;
  private haloMesh: Mesh | null = null;
  private readonly lod: PropLod;
  private drawn: Record<string, number> = {};
  private night = 1;
  private fog = -1;
  private waitingBlocks = 0;

  constructor(private readonly deps: StreetPropsDeps) {
    this.halo = new PropHaloMaterial(deps.scene);
    this.lod = PROP_LOD[deps.quality];
  }

  has(id: EntityId): boolean {
    return this.entities.has(id);
  }

  ids(): EntityId[] {
    return [...this.entities.keys()];
  }

  get size(): number {
    return this.entities.size;
  }

  spawn(id: EntityId, items: readonly StreetPropItem[], at: Vec3): void {
    this.despawn(id);
    const keys = new Set<string>();
    const byBlock = new Map<string, WorldProp[]>();
    for (const p of toWorld(items, at)) {
      const k = cellKey(p.x, p.z, PROP_BLOCK);
      const list = byBlock.get(k);
      if (list) list.push(p);
      else byBlock.set(k, [p]);
    }
    for (const [k, list] of byBlock) {
      const block = this.blockOf(k);
      block.pieces.set(id, list);
      block.dirty = true;
      keys.add(k);
    }
    this.entities.set(id, keys);
  }

  despawn(id: EntityId): void {
    const keys = this.entities.get(id);
    if (!keys) return;
    this.entities.delete(id);
    for (const k of keys) {
      const block = this.blocks.get(k);
      if (!block) continue;
      block.pieces.delete(id);
      block.dirty = true;
    }
  }

  /** Rebuilds the far meshes of changed blocks and the halos; forgets their detailed meshes. */
  flush(): boolean {
    let changed = false;
    for (const [key, block] of this.blocks) {
      if (!block.dirty) continue;
      changed = true;
      block.dirty = false;
      block.far?.dispose(false, false);
      block.near?.dispose(false, false);
      block.far = block.near = null;
      block.baked = false;
      block.band = "off";
      if (block.pieces.size === 0) this.blocks.delete(key);
      else this.buildFar(block);
    }
    if (changed) this.buildHalos();
    return changed;
  }

  /** Bands of the blocks from the camera, the detailed meshes they need, the halos' look. */
  update(eye: Vec3): void {
    const rig = this.deps.materials.currentRig;
    if (rig.fogDensity !== this.fog) {
      this.fog = rig.fogDensity;
      this.halo.setLook(1 - this.night, this.fog);
    }
    let budget = BAKES_PER_FRAME;
    let waiting = 0;
    const drawn: Record<string, number> = {};
    for (const block of this.blocks.values()) {
      block.band = blockBand(distance(eye, block.bounds), this.lod, block.band);
      if (block.band === "near" && !block.baked) {
        if (budget > 0) {
          budget -= 1;
          this.bakeNear(block);
        } else waiting += 1;
      }
      const detailed = block.band === "near" && block.baked;
      block.near?.setEnabled(detailed);
      // The far mesh stands in for a near block until its detail is baked.
      block.far?.setEnabled(block.band === "far" || (block.band === "near" && !block.baked));
      if (detailed) for (const list of block.pieces.values()) for (const p of list) drawn[p.prop] = (drawn[p.prop] ?? 0) + 1;
    }
    this.haloMesh?.setEnabled(this.night > 0.02);
    this.waitingBlocks = waiting;
    this.drawn = drawn;
  }

  /** Blocks near the camera still waiting for their detailed mesh. */
  get waiting(): number {
    return this.waitingBlocks;
  }

  /** Night 0 .. day 1 (ADR-0017): lamps' glass and the neon dim by day, the halos go out. */
  setDaylight(daylight: number): void {
    const day = Math.max(0, Math.min(1, daylight));
    this.night = 1 - day;
    this.deps.materials.get("streetProp").setFloat("selfLit", 1 - 0.4 * day);
    this.halo.setLook(day, Math.max(this.fog, 0));
  }

  get stats(): StreetPropsStats {
    let pieces = 0;
    let groups = 0;
    let far = 0;
    for (const b of this.blocks.values()) {
      for (const l of b.pieces.values()) pieces += l.length;
      if (b.near?.isEnabled()) groups++;
      if (b.far?.isEnabled()) far++;
    }
    return { pieces, cells: this.blocks.size, drawn: { ...this.drawn }, groups, far };
  }

  /** Every mesh built (debug and tests). */
  get meshes(): Mesh[] {
    const out: Mesh[] = [];
    for (const b of this.blocks.values()) for (const m of [b.near, b.far]) if (m) out.push(m);
    if (this.haloMesh) out.push(this.haloMesh);
    return out;
  }

  private blockOf(key: string): PropBlock {
    let b = this.blocks.get(key);
    if (!b) {
      b = { key, bounds: cellBounds(key, PROP_BLOCK), pieces: new Map(), band: "off", near: null, baked: false, far: null, dirty: true };
      this.blocks.set(key, b);
    }
    return b;
  }

  private sorted(block: PropBlock): WorldProp[] {
    return [...block.pieces.keys()].sort((a, b) => a - b).flatMap((id) => block.pieces.get(id)!);
  }

  private mesh(name: string, sink: MeshSink): Mesh | null {
    if (sink.empty) return null;
    const m = sinkToMesh(this.deps.scene, name, sink);
    m.material = this.deps.materials.get("streetProp");
    m.setEnabled(false);
    return m;
  }

  private buildFar(block: PropBlock): void {
    const far = new MeshSink();
    for (const p of this.sorted(block)) {
      const f = farModel(p.prop, p.shape);
      if (f) bake(far, f, p);
    }
    block.far = this.mesh(`props-far-${block.key}`, far);
  }

  /** Bakes a block's detailed pieces into one mesh on the street props' material (ADR-0050). */
  private bakeNear(block: PropBlock): void {
    block.baked = true;
    const sink = new MeshSink();
    for (const p of this.sorted(block)) {
      bake(sink, propModel(p.prop, p.shape).sink, p);
      for (const c of p.chains ?? []) bake(sink, chainModel(c.end), { ...p, yaw: c.yaw });
    }
    block.near = this.mesh(`props-${block.key}`, sink);
  }

  /** The halos of every lamp of the city in one additive mesh, outside the G-buffer, shadow and glow. */
  private buildHalos(): void {
    this.haloMesh?.dispose(false, false);
    this.haloMesh = null;
    const sink = new MeshSink();
    for (const key of [...this.blocks.keys()].sort()) for (const p of this.sorted(this.blocks.get(key)!)) if (LIT(p.prop)) planHalos(sink, p, propModel(p.prop, p.shape).lights);
    if (sink.empty) return;
    this.haloMesh = sinkToMesh(this.deps.scene, "props-halo", sink, true);
    this.haloMesh.material = this.halo.material;
    this.haloMesh.setEnabled(false);
  }
}
