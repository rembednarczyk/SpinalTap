import type { EntityId, Vec3 } from "@seki/core";
import { type Mesh, MeshClass, type Scene } from "../../babylon";
import type { Block } from "../props";
import { inW3Interior } from "./w3-interior-cull";

/** Further than this from where it spawned (m) a prop is moving: a door's leaf sliding open. */
const REST = 1e-3;

/**
 * Does a prop of W-3's hall go into its bake (ADR-0082 §4): a block in its rooms (`inW3Interior`:
 * the doors' leaves, the stairs, the ladders, the devices on its walls), but not glass (blended
 * on its own) and not one with a kit skin (the skin keeps its box). Plain blocks of the rooms are
 * baked by `W3View` already and never come here.
 */
export const w3Bakeable = (view: Pick<Block, "skin" | "material">, at: Vec3): boolean => !view.skin && view.material !== "glass" && inW3Interior(at);

/** Is a prop where it spawned (a door's leaf shut)? */
export const atRest = (rest: Vec3, now: Vec3): boolean => Math.abs(now.x - rest.x) <= REST && Math.abs(now.y - rest.y) <= REST && Math.abs(now.z - rest.z) <= REST;

type Material = NonNullable<Mesh["material"]>;

interface Group {
  readonly material: Material;
  readonly ids: Set<EntityId>;
  mesh: Mesh | null;
  dirty: boolean;
}

interface Member {
  /** The prop's own mesh: hidden while the bake draws it. */
  readonly mesh: Mesh;
  readonly rest: Vec3;
  readonly group: Group;
  /** Off its rest point now. */
  moving: boolean;
  /** Out of the bake for good: a scan target's outline needs its own mesh. */
  pinned: boolean;
  /** Drawn by the bake now. */
  baked: boolean;
}

/**
 * W-3's hall's own props baked while they stand still (ADR-0082 §4, the debt of stage 2b): the
 * doors' leaves, stairs and ladders are one mesh per toon preset instead of some forty. Each prop
 * keeps its own mesh, hidden while the bake draws it: the camera's blockers, the moon shadow's
 * casters and the props' moves stay as they were. A door's leaf leaves the bake as it starts to
 * slide (at once, so it never shows shut and open together) and comes back once shut; a focused
 * scan target leaves it for good. The toon shader patterns surfaces in world space, so the bake
 * looks the same as its props. Shown and hidden with the hall (`W3InteriorCull`).
 */
export class W3PropBake {
  private readonly members = new Map<EntityId, Member>();
  private readonly groups = new Map<number, Group>();
  private shown = false;

  constructor(private readonly scene: Scene) {}

  get size(): number {
    return this.members.size;
  }

  /** The bake's meshes (tests, debug). */
  get meshes(): readonly Mesh[] {
    return [...this.groups.values()].flatMap((g) => (g.mesh ? [g.mesh] : []));
  }

  has(id: EntityId): boolean {
    return this.members.has(id);
  }

  /** Is the prop drawn by the bake now (its own mesh hidden)? */
  baked(id: EntityId): boolean {
    return this.members.get(id)?.baked ?? false;
  }

  /** A prop standing at `at`, its own mesh `mesh`; baked on the next flush. */
  add(id: EntityId, mesh: Mesh, at: Vec3): void {
    const material = mesh.material;
    if (!material || this.members.has(id)) return;
    let group = this.groups.get(material.uniqueId);
    if (!group) this.groups.set(material.uniqueId, (group = { material, ids: new Set(), mesh: null, dirty: true }));
    group.ids.add(id);
    group.dirty = true;
    this.members.set(id, { mesh, rest: { x: at.x, y: at.y, z: at.z }, group, moving: false, pinned: false, baked: false });
  }

  /** The prop is at `at` now: off its rest point it leaves the bake at once, back on it it returns on the next flush. */
  moved(id: EntityId, at: Vec3): void {
    const m = this.members.get(id);
    if (!m) return;
    const moving = !atRest(m.rest, at);
    if (moving === m.moving) return;
    m.moving = moving;
    m.group.dirty = true;
    if (moving) this.rebuild(m.group);
  }

  /** The prop draws its own mesh from now on (a scan target's outline). */
  release(id: EntityId): void {
    const m = this.members.get(id);
    if (!m || m.pinned) return;
    m.pinned = true;
    m.group.dirty = true;
    this.rebuild(m.group);
  }

  /** The prop goes (world streaming); its own mesh is the caller's to dispose. */
  remove(id: EntityId): void {
    const m = this.members.get(id);
    if (!m) return;
    this.members.delete(id);
    m.group.ids.delete(id);
    m.group.dirty = true;
  }

  /** Shows or hides the bake with the hall. */
  setShown(on: boolean): void {
    this.shown = on;
    for (const g of this.groups.values()) g.mesh?.setEnabled(on);
  }

  /** Rebuilds the groups that changed. Call once per frame before rendering. */
  flush(): void {
    for (const g of this.groups.values()) if (g.dirty) this.rebuild(g);
  }

  private rebuild(g: Group): void {
    g.dirty = false;
    const members = [...g.ids].map((id) => this.members.get(id)).filter((m): m is Member => m !== undefined);
    const still = members.filter((m) => !m.moving && !m.pinned);
    g.mesh?.dispose(false, false);
    g.mesh = still.length > 0 ? this.merge(g, still) : null;
    for (const m of members) {
      m.baked = g.mesh !== null && still.includes(m);
      m.mesh.setEnabled(!m.baked);
    }
    if (g.ids.size === 0) this.groups.delete(g.material.uniqueId);
  }

  private merge(g: Group, still: readonly Member[]): Mesh | null {
    // The props' meshes stay (disposeSource false): their world matrices are baked into the copy.
    for (const m of still) m.mesh.computeWorldMatrix(true);
    const merged = MeshClass.MergeMeshes(still.map((m) => m.mesh), false, true);
    if (!merged) return null;
    merged.name = `w3-bake-${g.material.name}`;
    merged.material = g.material;
    merged.isPickable = false;
    merged.freezeWorldMatrix();
    merged.setEnabled(this.shown);
    return merged;
  }
}
