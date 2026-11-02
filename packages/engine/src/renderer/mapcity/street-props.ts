import type { EntityId, StreetPropItem, Vec3 } from "@seki/core";
import type { Mesh, Scene } from "../../babylon";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import type { CityProps } from "../city-props";
import type { Obstacle } from "./facade-props";
import { LampHalos } from "./lamp-halos";
import { cellKey } from "./map-index";
import { type WorldProp, toWorld } from "./prop-batch";
import { type PropBakeDeps, type PropBlock, bakeNear, buildFar, newBlock } from "./prop-block";
import { standingObstacles } from "./prop-obstacles";
import { PropPoles } from "./prop-poles";
import { PROP_BLOCK, PROP_LOD, type PropLod, blockBand } from "./prop-shapes";
import { type Box2, distanceToBox } from "./polygon";
import { isPoleLamp } from "./utility-poles";

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
 *
 * The facade over its parts (ADR-0031): the blocks' meshes are baked by `prop-block`, the CC-BY
 * poles and dogs are `PropPoles`, the halos `LampHalos`, the awnings' obstacles `prop-obstacles`.
 */
export class StreetProps {
  private readonly entities = new Map<EntityId, Set<string>>();
  private readonly blocks = new Map<string, PropBlock>();
  private readonly halos: LampHalos;
  private readonly poles: PropPoles;
  private readonly bake: PropBakeDeps;
  private readonly lod: PropLod;
  private drawn: Record<string, number> = {};
  private waitingBlocks = 0;

  constructor(private readonly deps: StreetPropsDeps) {
    this.halos = new LampHalos(deps.scene);
    this.lod = PROP_LOD[deps.quality];
    this.poles = new PropPoles(deps.quality);
    this.bake = { ...deps, poles: this.poles };
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
    for (const w of toWorld(items, at)) {
      const p = isPoleLamp(w) ? { ...w, pole: true } : w;
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

  /** The props file has loaded (ADR-0063): the detailed blocks and the halos are made again with its poles and dogs. */
  setProps(props: CityProps): void {
    this.poles.setProps(props);
    for (const b of this.blocks.values()) {
      b.near?.dispose(false, false);
      b.near = null;
      b.baked = false;
      // The far poles too, enabled again by the next update's band.
      b.far?.dispose(false, false);
      b.far = null;
      buildFar(this.bake, b);
    }
    this.halos.build(this.blocks, this.poles);
  }

  /** Furniture standing up within `r` of (x, z), for the awnings of the facades (ADR-0058). */
  obstacles(x: number, z: number, r: number): Obstacle[] {
    return standingObstacles(this.blocks, this.poles, x, z, r);
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
      else buildFar(this.bake, block);
    }
    if (changed) this.halos.build(this.blocks, this.poles);
    return changed;
  }

  /** Bands of the blocks from the camera, the detailed meshes they need, the halos' look. */
  update(eye: Vec3): void {
    this.halos.setFog(this.deps.materials.currentRig.fogDensity);
    let budget = BAKES_PER_FRAME;
    let waiting = 0;
    const drawn: Record<string, number> = {};
    for (const block of this.blocks.values()) {
      block.band = blockBand(distance(eye, block.bounds), this.lod, block.band);
      if (block.band === "near" && !block.baked) {
        if (budget > 0) {
          budget -= 1;
          bakeNear(this.bake, block);
        } else waiting += 1;
      }
      const detailed = block.band === "near" && block.baked;
      block.near?.setEnabled(detailed);
      // The far mesh stands in for a near block until its detail is baked.
      block.far?.setEnabled(block.band === "far" || (block.band === "near" && !block.baked));
      if (detailed) for (const list of block.pieces.values()) for (const p of list) drawn[p.prop] = (drawn[p.prop] ?? 0) + 1;
    }
    this.halos.show();
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
    this.deps.materials.get("streetProp").setFloat("selfLit", 1 - 0.4 * day);
    this.halos.setDaylight(day);
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
    const halo = this.halos.mesh;
    if (halo) out.push(halo);
    return out;
  }

  private blockOf(key: string): PropBlock {
    let b = this.blocks.get(key);
    if (!b) {
      b = newBlock(key);
      this.blocks.set(key, b);
    }
    return b;
  }
}
