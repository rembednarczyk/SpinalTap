import { type AbstractMesh, type Color3, type Mesh, Vector3 } from "../babylon";
import type { EntityId, Transform, ViewDescriptor } from "@seki/core";
import type { MoonShadow } from "../npr/moon-shadow";
import type { ToonMaterials } from "../npr/toon-material";
import type { Atmosphere } from "./atmosphere";
import type { BlockView, CityKitLoader } from "./city-kit-loader";
import type { DressBlock } from "./dressing-plan";
import type { WorldDressing } from "./dressing";
import { type PropView, buildBlock, buildLamp, buildLootBag, buildNeon, buildWater } from "./props";
import type { ScanVisitor } from "./screen-fx";
import type { Stage } from "./stage";
import { InteriorBatches } from "./interior-batch";

/** Everything in the world that is not a character: blocks, neon, lamps, water, loot. */
export type PropDescriptor = Exclude<ViewDescriptor, { kind: "heroine" | "npc" | "enemy" | "crowd" }>;

/** Atmosphere pieces added for a prop, taken back when the prop goes (world streaming). */
interface Decor {
  readonly meshes: Mesh[];
  readonly flicker: { emissiveColor: Color3 } | null;
}

interface PropEntry {
  readonly prop: PropView;
  readonly lightKey: string | null;
  readonly decor: Decor;
}



const v3 = (p: { x: number; y: number; z: number }) => new Vector3(p.x, p.y, p.z);

export interface PropViewsDeps {
  readonly stage: Stage;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow;
  readonly atmosphere: Atmosphere;
  readonly dressing: WorldDressing;
  readonly cityKit: CityKitLoader;
}

/**
 * Views of the props: blocks (with their dressing, kit skins and camera blockers), neon signs and
 * lamps (with light shafts, reflections and flicker), water, loot bags, and lifts and gates that move.
 */
export class PropViews {
  private readonly props = new Map<EntityId, PropEntry>();
  /** Meshes the camera pulls in front of. */
  private readonly blockers = new Set<AbstractMesh>();
  /** Blocks in view, for the walked-roof test (ADR-0027, C8). */
  private readonly blocks = new Map<EntityId, DressBlock>();

  /** Plain interior blocks, merged (ADR-0038). */
  private readonly interiors: InteriorBatches;

  constructor(private readonly deps: PropViewsDeps) {
    this.interiors = new InteriorBatches(deps.stage.scene, deps.materials, (old, next) => {
      if (old) this.blockers.delete(old);
      if (next) this.blockers.add(next);
    });
  }

  has(id: EntityId): boolean {
    return this.props.has(id) || this.interiors.has(id);
  }

  get size(): number {
    return this.props.size + this.interiors.size;
  }

  ids(): EntityId[] {
    return [...this.props.keys(), ...this.interiors.ids()];
  }

  /** Rebuilds the merged interior meshes that changed. Call once per frame before rendering. */
  flush(): void {
    this.interiors.flush();
  }

  isBlocker(mesh: AbstractMesh): boolean {
    return this.blockers.has(mesh);
  }

  blockViews(): Iterable<DressBlock> {
    return this.blocks.values();
  }

  spawn(id: EntityId, view: PropDescriptor, t: Transform): void {
    const { scene, glow } = this.deps.stage;
    const { materials } = this.deps;
    const name = `e${id}`;
    const at = v3(t.position);
    switch (view.kind) {
      case "block":
        if (view.interior && !view.skin && !view.slope && !view.rungs) {
          this.interiors.add(id, view, t.position);
          this.deps.dressing.addBlock(id, view, at);
          this.blocks.set(id, { center: { ...t.position }, size: view.size, material: view.material });
          return;
        }
        this.spawnLit(id, name, view, at);
        return;
      case "neon":
      case "lamp":
        this.spawnLit(id, name, view, at);
        return;
      case "water": {
        const prop = buildWater(scene, materials, name, view, at);
        this.props.set(id, { prop, lightKey: null, decor: { meshes: [], flicker: null } });
        return;
      }
      case "loot": {
        const prop = buildLootBag(scene, materials, name, view, at);
        for (const m of prop.glowing) glow.addIncludedOnlyMesh(m);
        this.props.set(id, { prop, lightKey: null, decor: { meshes: [], flicker: null } });
        return;
      }
    }
  }

  /** Blocks, neon signs and lamps: glow, blockers, shadow casters, decor and lights. */
  private spawnLit(id: EntityId, name: string, view: Extract<PropDescriptor, { kind: "block" | "neon" | "lamp" }>, at: Vector3): void {
    const { scene, glow } = this.deps.stage;
    const { materials, shadow } = this.deps;
    const prop =
      view.kind === "block"
        ? buildBlock(scene, materials, name, view, at)
        : view.kind === "neon"
          ? buildNeon(scene, name, view, at)
          : buildLamp(scene, materials, name, view.color, at);
    for (const m of prop.glowing) glow.addIncludedOnlyMesh(m);
    for (const m of prop.blockers) this.blockers.add(m);
    for (const m of prop.casters) shadow.addStaticCaster(m);
    const decor = this.decorate(name, view, at, prop);
    const lightKey = prop.light ? name : null;
    if (prop.light && lightKey) materials.addLight(lightKey, prop.light);
    this.props.set(id, { prop, lightKey, decor });
    if (view.kind === "block") this.addBlock(id, view, at, prop);
    else if (view.kind === "neon") this.deps.dressing.addSign(id, view, at);
  }

  /** Dressing, the walked-roof record and the kit skin of a block. */
  private addBlock(id: EntityId, view: BlockView, at: Vector3, prop: PropView): void {
    this.deps.dressing.addBlock(id, view, at);
    this.blocks.set(id, { center: { x: at.x, y: at.y, z: at.z }, size: view.size, material: view.material, ...(view.rungs ? { rungs: view.rungs } : {}) });
    // A ladder, or a rail or crate up on a roof, can make a roof walked: rebuild the kit
    // cells around it. Anything else leaves built cells alone (rebuilding them stalls a frame).
    const raised = at.y - view.size.y / 2 > 2 && Math.min(view.size.x, view.size.z) < 3;
    if (!view.skin && (view.rungs || raised)) this.deps.cityKit.touch(at.x, at.z);
    if (view.skin) {
      const box = (prop.root.getChildMeshes(true)[0] as Mesh | undefined) ?? null;
      this.deps.cityKit.addSkin(id, { ...view, skin: view.skin }, at, box);
    }
  }

  /** A lift platform or gate (ADR-0020): props are built frozen, so thaw on the first move. False for an unknown id. */
  move(id: EntityId, t: Transform): boolean {
    const e = this.props.get(id);
    if (!e) return false;
    const root = e.prop.root;
    if (root.position.x === t.position.x && root.position.y === t.position.y && root.position.z === t.position.z) return true;
    for (const m of root.getChildMeshes(false)) if (m.isWorldMatrixFrozen) m.unfreezeWorldMatrix();
    root.position.set(t.position.x, t.position.y, t.position.z);
    return true;
  }

  despawn(id: EntityId): void {
    if (this.interiors.has(id)) {
      this.interiors.remove(id);
      this.deps.dressing.remove(id);
      this.blocks.delete(id);
      return;
    }
    const e = this.props.get(id);
    if (!e) return;
    this.props.delete(id);
    const { materials, atmosphere } = this.deps;
    this.deps.cityKit.remove(id);
    this.deps.dressing.remove(id);
    this.blocks.delete(id);
    for (const m of e.prop.blockers) this.blockers.delete(m);
    if (e.lightKey) materials.removeLight(e.lightKey);
    for (const m of e.decor.meshes) atmosphere.removeDecoration(m);
    if (e.decor.flicker) atmosphere.removeFlicker(e.decor.flicker);
    // Glowing parts (neon faces, lamp bulbs) own their material and texture; the rest share toon presets.
    for (const m of e.prop.glowing) m.material?.dispose(false, true);
    e.prop.root.dispose(false, false);
  }

  /** Props have no scan class of their own; the focused one is still outlined. */
  scanTargets(visit: ScanVisitor): void {
    for (const [id, e] of this.props) visit(id, null, () => e.prop.root.getChildMeshes(false));
  }

  /** Light shafts, wet-street reflections and flicker for lamps and neon signs. */
  private decorate(name: string, view: PropDescriptor, at: Vector3, prop: PropView): Decor {
    const { atmosphere } = this.deps;
    if (view.kind === "lamp" && prop.light) {
      const l = prop.light.position;
      const cone = atmosphere.addLightCone(`${name}-cone`, new Vector3(l.x, 5.05, l.z), view.color);
      const refl = atmosphere.addReflection(`${name}-refl`, new Vector3(l.x, 0, l.z), new Vector3(-Math.sign(at.x) || 1, 0, 0), 1.4, 5, view.color, 0.35);
      return { meshes: [cone, refl], flicker: null };
    }
    if (view.kind !== "neon") return { meshes: [], flicker: null };
    const thinX = view.size.x <= view.size.z && view.size.x <= view.size.y;
    const towards = thinX ? new Vector3(at.x > 0 ? -1 : 1, 0, 0) : new Vector3(0, 0, -1);
    const width = thinX ? view.size.z : view.size.x;
    const refl = atmosphere.addReflection(`${name}-refl`, new Vector3(at.x, 0, at.z), towards, Math.max(1.2, width), 7, view.color, 0.55);
    const sign = prop.glowing[0]?.material as unknown as { emissiveColor?: Color3 } | null;
    if (sign?.emissiveColor && (view.label === "HOTEL" || view.label === "KUSURI")) {
      const flicker = sign as { emissiveColor: Color3 };
      atmosphere.addFlicker(flicker, view.label.length);
      return { meshes: [refl], flicker };
    }
    return { meshes: [refl], flicker: null };
  }
}
