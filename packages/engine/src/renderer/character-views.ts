import type { Scene } from "../babylon";
import type { AppearanceDescriptor, EntityId, Transform, ViewDescriptor, WeaponLook } from "@seki/core";
import type { CameraRig } from "../camera/camera-rig";
import type { MoonShadow } from "../npr/moon-shadow";
import type { ToonMaterials } from "../npr/toon-material";
import { CharacterDeaths } from "./character-deaths";
import { CharacterKit } from "./character-kit";
import { withinDrawDistance } from "./character-lod";
import { CharacterModels } from "./character-models";
import { type CharacterRig, animateRig, buildCivilian, buildCorpo, buildFixer, buildGanger, buildHeroine, buildRipperdoc } from "./characters";
import { markEnforcer } from "./enforcer-mark";
import { easeLift, groundLift } from "./ground-lift";
import { type CharacterModelKey, type CharacterModelManifest, ModelLibrary } from "./model-library";
import type { HumanoidRetarget } from "./model-rig";
import { type ScanClass, scanClassOfView } from "./scan-highlight";
import type { FxActors, ScanVisitor } from "./screen-fx";
import type { WeaponManifest } from "./weapon-mount";

/** The player, NPCs and enemies. */
export type CharacterDescriptor = Extract<ViewDescriptor, { kind: "heroine" | "npc" | "enemy" }>;

interface CharacterView {
  readonly rig: CharacterRig;
  transform: Transform;
  readonly model: CharacterModelKey | null;
  readonly name: string;
  readonly scan: ScanClass | null;
  /** Height of the sidewalk it stands on, eased (ADR-0041). */
  lift: number;
}

const modelKeyOf = (view: CharacterDescriptor): CharacterModelKey => {
  switch (view.kind) {
    case "heroine":
      return "heroine";
    case "enemy":
      return "ganger";
    case "npc":
      return view.preset === "fixer" ? "fixer" : view.preset === "ripperdoc" ? "ripperdoc" : "civilian";
  }
};

const builderOf = (view: CharacterDescriptor) =>
  view.kind === "heroine"
    ? buildHeroine
    : view.kind === "enemy"
      ? view.preset === "corpo"
        ? buildCorpo
        : buildGanger
      : view.preset === "fixer"
        ? buildFixer
        : view.preset === "ripperdoc"
          ? buildRipperdoc
          : buildCivilian;

const applyTransform = (rig: CharacterRig, t: Transform, lift: number): void => {
  rig.root.position.set(t.position.x, t.position.y + lift, t.position.z);
  rig.root.rotation.y = t.yaw;
};

/** First off the model's bones (gun, add-ons) and its own colours back, then into the pool. */
const disposeRig = (rig: CharacterRig, kit: CharacterKit, models: CharacterModels): void => {
  kit.loadouts.dispose(rig);
  models.release(rig);
  rig.root.dispose(false, false);
};

export interface CharacterViewsDeps {
  /** How far the picture lifts feet standing at (x, y, z) (sidewalks, ADR-0041/0045); default the old street's. */
  readonly lift?: (x: number, y: number, z: number) => number;
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow;
  readonly camera: CameraRig;
  /** The entity the camera follows, if any. */
  readonly cameraTarget: () => EntityId | null;
  /** Lays more over the walk animation of a character each frame (its activity, ADR-0040), before the model follows. */
  readonly pose?: (id: EntityId, rig: CharacterRig, speed: number, dt: number, retarget: HumanoidRetarget | null, clock: number) => void;
}

/**
 * Views of the characters: procedural rigs, their transforms, draw distance and animation. A
 * facade (ADR-0031) over `CharacterModels` (imported models dressed over the rigs, pooled for
 * reuse), `CharacterKit` (weapons and garment add-ons) and `CharacterDeaths` (the death fall
 * after the simulation removed one).
 */
export class CharacterViews implements FxActors {
  private readonly views = new Map<EntityId, CharacterView>();
  /** Weapons, loadouts and the weapon in hand per character. */
  private readonly kit: CharacterKit;
  /** Imported models dressed over the rigs, and their pool. */
  private readonly models: CharacterModels;
  /** Characters playing their death fall after the simulation removed them. */
  private readonly deaths = new CharacterDeaths((rig) => disposeRig(rig, this.kit, this.models));

  constructor(private readonly deps: CharacterViewsDeps) {
    const library = new ModelLibrary(deps.scene, deps.materials);
    this.kit = new CharacterKit({ ...deps, library });
    this.models = new CharacterModels({ library, loadouts: this.kit.loadouts, addCaster: (m) => deps.shadow.addCaster(m) });
  }

  has(id: EntityId): boolean {
    return this.views.has(id);
  }

  get size(): number {
    return this.views.size;
  }

  get dressedCount(): number {
    return this.models.dressedCount;
  }

  /** Models still loading for characters in the scene (tests wait for none before measuring). */
  get loadingCount(): number {
    return this.models.loadingCount;
  }

  ids(): EntityId[] {
    return [...this.views.keys()];
  }

  rigOf(id: EntityId): CharacterRig | null {
    return this.views.get(id)?.rig ?? null;
  }

  transformOf(id: EntityId): Transform | null {
    return this.views.get(id)?.transform ?? null;
  }

  heldOf(id: EntityId): WeaponLook | null {
    return this.kit.heldOf(id);
  }

  talk(id: EntityId, seconds: number): void {
    const v = this.views.get(id);
    if (v) this.models.of(v.rig)?.model.face?.talk(seconds);
  }

  spawn(id: EntityId, view: CharacterDescriptor, t: Transform): void {
    const name = `e${id}`;
    const rig =
      view.kind === "npc" && view.preset === "civilian"
        ? buildCivilian(this.deps.scene, this.deps.materials, name, view.umbrella !== false)
        : builderOf(view)(this.deps.scene, this.deps.materials, name);
    for (const m of rig.meshes) this.deps.shadow.addCaster(m);
    if (view.kind === "enemy" && view.enforcer) markEnforcer(this.deps.scene, this.deps.materials, rig, name);
    const model = modelKeyOf(view);
    const lift = (this.deps.lift ?? groundLift)(t.position.x, t.position.y, t.position.z);
    this.views.set(id, { rig, transform: t, model, name, scan: scanClassOfView(view), lift });
    applyTransform(rig, t, lift);
    this.models.dress(rig, model, name);
  }

  /** False for an unknown id. */
  move(id: EntityId, t: Transform): boolean {
    const v = this.views.get(id);
    if (!v) return false;
    v.transform = t;
    applyTransform(v.rig, t, v.lift);
    return true;
  }

  /** `fall` plays the death fall first; otherwise the character goes at once (reset, streaming, the player). */
  despawn(id: EntityId, fall: boolean): void {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    this.kit.forget(id);
    if (fall) {
      this.deaths.fall(v.rig);
    } else {
      disposeRig(v.rig, this.kit, this.models);
    }
  }

  /** Removes every character at once, the falling ones too. */
  clear(): void {
    for (const id of this.ids()) this.despawn(id, false);
    this.deaths.clear();
  }

  /**
   * Animation, the death falls, the dressed models and the loadouts on them. `frozen` stops the
   * idle clocks (breathing, blinks) and keeps the eases: the reference still is drawn after however
   * long the page took to load, and its pose must not depend on that (G-030).
   */
  update(dt: number, frozen = false): void {
    const clock = frozen ? 0 : dt;
    const eye = this.deps.camera.camera.position;
    const followed = this.deps.cameraTarget();
    for (const [id, v] of this.views) {
      // Far characters are switched off and skip their animation (ADR-0040).
      if (id !== followed) {
        const near = withinDrawDistance(v.rig.root.position, eye);
        if (v.rig.root.isEnabled(false) !== near) v.rig.root.setEnabled(near);
        if (!near) continue;
      }
      const t = v.transform;
      // On a sidewalk the figure stands on its top (ADR-0041); the kerb is a short step.
      const lift = easeLift(v.lift, (this.deps.lift ?? groundLift)(t.position.x, t.position.y, t.position.z), dt);
      if (lift !== v.lift) {
        v.lift = lift;
        v.rig.root.position.y = t.position.y + lift;
      }
      const motion = { ...(t.air !== undefined ? { air: t.air } : {}), ...(t.climb !== undefined ? { climb: t.climb } : {}), clock };
      animateRig(v.rig, t.speed, dt, t.crouch, { aim: t.aim ?? 0, guard: t.guard ?? 0 }, motion);
      this.deps.pose?.(id, v.rig, t.speed, dt, this.models.of(v.rig)?.retarget ?? null, clock);
    }
    this.deaths.update(dt);
    this.models.update(dt, clock);
    for (const v of this.views.values()) if (v.rig.root.isEnabled(false)) this.kit.loadouts.update(v.rig);
    for (const rig of this.deaths.rigs) this.kit.loadouts.update(rig);
  }

  /** Hides the player's body in first person. */
  setBodyVisible(id: EntityId, visible: boolean): void {
    const v = this.views.get(id);
    if (!v) return;
    if (v.rig.root.isEnabled() !== visible) v.rig.root.setEnabled(visible);
  }

  /** Every character with its scan class; the meshes of the dressed model when there is one. */
  scanTargets(visit: ScanVisitor): void {
    for (const [id, v] of this.views) visit(id, v.scan, () => this.models.of(v.rig)?.model.meshes ?? v.rig.meshes);
  }

  /**
   * Weapon models (glTF) that replace the placeholder box pistols in hands, holsters, the FPP
   * viewmodel and the hands of imported characters. Characters on screen are re-armed.
   */
  setWeaponModels(manifest: WeaponManifest): void {
    this.kit.setWeaponModels(manifest);
  }

  /** What a character wears and carries (ADR-0015): weapons in hand, holster and on the back, garment add-ons. */
  setAppearance(id: EntityId, appearance: AppearanceDescriptor): void {
    const v = this.views.get(id);
    if (!v || !v.rig.aiming) return;
    this.kit.arm(id, v.rig, v.name, appearance);
  }

  /** Imported character models (models/manifest.json); characters on screen are dressed too. */
  setCharacterModels(manifest: CharacterModelManifest): void {
    this.models.setManifest(manifest);
    for (const v of this.views.values()) if (!this.models.of(v.rig)) this.models.dress(v.rig, v.model, v.name);
  }

  /** Starts loading every model of the manifest and every weapon, one promise per file (ADR-0057). */
  preloadModels(): Promise<unknown>[] {
    return [...this.models.preload(), ...this.kit.preload()];
  }
}
