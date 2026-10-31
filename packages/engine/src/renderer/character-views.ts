import type { Scene } from "../babylon";
import type { AppearanceDescriptor, EntityId, Transform, ViewDescriptor, WeaponLook } from "@seki/core";
import type { CameraRig } from "../camera/camera-rig";
import type { MoonShadow } from "../npr/moon-shadow";
import type { ToonMaterials } from "../npr/toon-material";
import {
  type CharacterRig,
  animateRig,
  buildCivilian,
  buildCorpo,
  buildFixer,
  buildGanger,
  buildHeroine,
  buildRipperdoc,
  deathFinished,
  startDeath,
} from "./characters";
import { markEnforcer } from "./enforcer-mark";
import { withinDrawDistance } from "./character-lod";
import { easeLift, groundLift } from "./ground-lift";
import { Loadouts } from "./loadout";
import { type CharacterModelKey, type CharacterModelManifest, type ModelInstance, ModelLibrary } from "./model-library";
import { HumanoidRetarget } from "./model-rig";
import { type ScanClass, scanClassOfView } from "./scan-highlight";
import type { FxActors, ScanVisitor } from "./screen-fx";
import { SpringBones, humanoidColliders } from "./spring-bones";
import { type WeaponManifest, WeaponMounts } from "./weapon-mount";

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

/** An imported model dressed over a procedural rig, which keeps animating invisibly. */
interface Dressed {
  readonly model: ModelInstance;
  readonly retarget: HumanoidRetarget;
  /** Hair and cloth secondary motion, if the model has such bones. */
  readonly springs: SpringBones | null;
  /** Pool key: the model file. */
  readonly url: string;
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
 * Views of the characters: procedural rigs, imported models dressed over them (pooled for
 * reuse), weapons and garment add-ons, and the death fall after the simulation removed one.
 */
export class CharacterViews implements FxActors {
  private readonly views = new Map<EntityId, CharacterView>();
  /** Characters playing their death fall after the simulation removed them. */
  private readonly dying: CharacterRig[] = [];
  private readonly library: ModelLibrary;
  private readonly weapons: WeaponMounts;
  /** Weapons and garment add-ons per character, from `setAppearance`. */
  private readonly loadouts: Loadouts;
  private models: CharacterModelManifest = {};
  private readonly dressed = new Map<CharacterRig, Dressed>();
  /** Rigs whose model is still loading, so a manifest arriving meanwhile does not dress them twice. */
  private readonly loadingModels = new Set<CharacterRig>();
  private readonly modelPool = new Map<string, ModelInstance[]>();
  /** Weapon in hand per character, so the FPP viewmodel can follow whoever the camera takes. */
  private readonly held = new Map<EntityId, WeaponLook | null>();

  constructor(private readonly deps: CharacterViewsDeps) {
    this.library = new ModelLibrary(deps.scene, deps.materials);
    this.weapons = new WeaponMounts(this.library);
    this.loadouts = new Loadouts(deps.scene, deps.materials, this.weapons, (meshes) => {
      for (const m of meshes) deps.shadow.addCaster(m);
    });
  }

  has(id: EntityId): boolean {
    return this.views.has(id);
  }

  get size(): number {
    return this.views.size;
  }

  get dressedCount(): number {
    return this.dressed.size;
  }

  /** Models still loading for characters in the scene (tests wait for none before measuring). */
  get loadingCount(): number {
    return this.loadingModels.size;
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
    return this.held.get(id) ?? null;
  }

  talk(id: EntityId, seconds: number): void {
    const v = this.views.get(id);
    if (v) this.dressed.get(v.rig)?.model.face?.talk(seconds);
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
    this.dress(rig, model, name);
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
    this.held.delete(id);
    if (fall) {
      startDeath(v.rig);
      this.dying.push(v.rig);
    } else {
      this.disposeRig(v.rig);
    }
  }

  /** Removes every character at once, the falling ones too. */
  clear(): void {
    for (const id of this.ids()) this.despawn(id, false);
    for (const rig of this.dying.splice(0)) this.disposeRig(rig);
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
      this.deps.pose?.(id, v.rig, t.speed, dt, this.dressed.get(v.rig)?.retarget ?? null, clock);
    }
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const rig = this.dying[i];
      if (!rig) continue;
      animateRig(rig, 0, dt);
      if (deathFinished(rig)) {
        this.disposeRig(rig);
        this.dying.splice(i, 1);
      }
    }
    for (const d of this.dressed.values()) {
      if (!d.model.root.isEnabled()) continue;
      d.retarget.update();
      d.springs?.update(dt);
      d.model.face?.update(clock);
    }
    for (const v of this.views.values()) if (v.rig.root.isEnabled(false)) this.loadouts.update(v.rig);
    for (const rig of this.dying) this.loadouts.update(rig);
  }

  /** Hides the player's body in first person. */
  setBodyVisible(id: EntityId, visible: boolean): void {
    const v = this.views.get(id);
    if (!v) return;
    if (v.rig.root.isEnabled() !== visible) v.rig.root.setEnabled(visible);
  }

  /** Every character with its scan class; the meshes of the dressed model when there is one. */
  scanTargets(visit: ScanVisitor): void {
    for (const [id, v] of this.views) visit(id, v.scan, () => this.dressed.get(v.rig)?.model.meshes ?? v.rig.meshes);
  }

  /**
   * Weapon models (glTF) that replace the placeholder box pistols in hands, holsters, the FPP
   * viewmodel and the hands of imported characters. Characters on screen are re-armed.
   */
  setWeaponModels(manifest: WeaponManifest): void {
    const camera = this.deps.camera;
    this.weapons.setManifest(manifest);
    this.loadouts.remountAll();
    if (this.weapons.has("pistol")) {
      void this.weapons.mount(camera.weaponMount, "pistol", "vm-weapon", "view").then((pivot) => {
        if (pivot) camera.hidePlaceholderGun();
      });
    }
  }

  /** What a character wears and carries (ADR-0015): weapons in hand, holster and on the back, garment add-ons. */
  setAppearance(id: EntityId, appearance: AppearanceDescriptor): void {
    const v = this.views.get(id);
    if (!v || !v.rig.aiming) return;
    const w = appearance.weapons;
    // A baton or blade in hand swings and guards instead of aiming (ADR-0019).
    v.rig.melee = w.active === "melee" && w.melee !== null;
    this.held.set(id, w[w.active]);
    if (id === this.deps.cameraTarget()) this.deps.camera.setHeldWeapon(w[w.active]);
    this.loadouts.set(v.rig, appearance, v.name);
  }

  /** Imported character models (models/manifest.json); characters on screen are dressed too. */
  setCharacterModels(manifest: CharacterModelManifest): void {
    this.models = manifest;
    for (const v of this.views.values()) if (!this.dressed.has(v.rig)) this.dress(v.rig, v.model, v.name);
  }

  /** Loads the model in the background and swaps it in once ready, if the rig still exists. */
  private dress(rig: CharacterRig, key: CharacterModelKey | null, name: string): void {
    const spec = key ? this.models[key] : undefined;
    if (!spec) return;
    // A model released by a cleared scene (new game, load, streaming) is reused at once.
    const pooled = this.modelPool.get(spec.url)?.pop();
    if (pooled) {
      this.attachModel(rig, pooled, spec.url, key);
      return;
    }
    this.loadingModels.add(rig);
    this.library
      .instantiate(spec, `${name}-m`)
      .then((model) => {
        this.loadingModels.delete(rig);
        if (rig.root.isDisposed()) return this.releaseModel(model, spec.url);
        this.attachModel(rig, model, spec.url, key);
      })
      .catch((err: unknown) => {
        this.loadingModels.delete(rig);
        console.warn(`[models] ${spec.url} failed to load`, err);
      });
  }

  private attachModel(rig: CharacterRig, model: ModelInstance, url: string, key: CharacterModelKey | null): void {
    model.root.setEnabled(true);
    const retarget = HumanoidRetarget.create(rig, model.root, model.prefix);
    if (!retarget) {
      console.warn(`[models] ${url}: no humanoid bones found, keeping the procedural ${key}`);
      model.dispose();
      return;
    }
    for (const m of rig.meshes) m.setEnabled(false);
    for (const m of model.meshes) if (m.getTotalVertices() > 0) this.deps.shadow.addCaster(m);
    const springs = SpringBones.create(model.root, { vrm: model.springs, prefix: model.prefix, colliders: humanoidColliders(model.root, model.prefix) });
    this.dressed.set(rig, { model, retarget, springs, url });
    // The gun in the model's hand and the garment add-ons on its bones.
    this.loadouts.setModel(rig, { retarget, meshes: model.meshes });
  }

  /** Detaches a model, resets its pose and keeps it for the next character of the same look. */
  private releaseModel(model: ModelInstance, url: string): void {
    model.root.parent = null;
    model.root.setEnabled(false);
    model.resetPose();
    const pool = this.modelPool.get(url) ?? [];
    pool.push(model);
    this.modelPool.set(url, pool);
  }

  private disposeRig(rig: CharacterRig): void {
    // First off the model's bones (gun, add-ons) and its own colours back, then into the pool.
    this.loadouts.dispose(rig);
    const d = this.dressed.get(rig);
    if (d) this.releaseModel(d.model, d.url);
    this.dressed.delete(rig);
    rig.root.dispose(false, false);
  }
}
