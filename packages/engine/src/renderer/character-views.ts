import type { Scene } from "../babylon";
import type { AppearanceDescriptor, EntityId, Transform } from "@seki/core";
import type { CameraRig } from "../camera/camera-rig";
import { fadeFigure } from "../npr/body-dither";
import type { MoonShadow } from "../npr/moon-shadow";
import type { ToonMaterials } from "../npr/toon-material";
import { CharacterDeaths } from "./character-deaths";
import { CharacterKit } from "./character-kit";
import { withinDrawDistance } from "./character-lod";
import { CharacterModels } from "./character-models";
import { type CharacterRig, animateRig, buildCivilian, buildCorpo, buildFixer, buildGanger, buildHeroine, buildRipperdoc } from "./characters";
import { markEnforcer } from "./enforcer-mark";
import { easeLift, groundLift } from "./ground-lift";
import type { LadderRungs } from "./ladder-hands";
import { type CharacterModelManifest, ModelLibrary } from "./model-library";
import { type CharacterDescriptor, type ModelChoice, modelChoiceOf } from "./model-cast";
import { type WallProbe, layBody, placeLaid } from "./body-lay";
import { animateGrab, inGrab, placeHeld, reachForNeck } from "./grab-clip";
import { carriedShoulder } from "./knockout-carry";
import { animateKnockout, settleKnockout } from "./knockout-pose";
import type { HumanoidRetarget } from "./model-rig";
import { type ScanClass, scanClassOfView } from "./scan-highlight";
import type { FxActors, ScanVisitor } from "./screen-fx";
import type { WeaponManifest } from "./weapon-mount";

export type { CharacterDescriptor } from "./model-cast";

interface CharacterView {
  readonly rig: CharacterRig;
  transform: Transform;
  readonly model: ModelChoice | null;
  readonly name: string;
  readonly scan: ScanClass | null;
  /** Height of the sidewalk it stands on, eased (ADR-0041). */
  lift: number;
}

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
  /** The rungs of the ladder a climber with the feet at (x, y, z) hangs on, for the hands (G-310). */
  readonly rungs?: (x: number, y: number, z: number) => LadderRungs | null;
  /** Walls round a lying body (G-458): it is turned on the ground until it is clear of them. */
  readonly wall?: WallProbe;
  /** Character model files in memory at once (`QualityTier.modelFiles`, ADR-0076 stage 4b). */
  readonly modelFiles?: number;
}

/** What the loading screen waits for and what loads after it (ADR-0057, ADR-0076 stage 4a). */
export interface ModelLoading {
  /** Starts loading the models of the characters in the scene, the heroine's and every weapon: one promise per file. */
  start(): Promise<unknown>[];
  /** Loads the background roles' models the start did not, one file at a time, while `live` says so. */
  rest(live?: () => boolean): Promise<void>;
  /** Model files in memory now, weapons' too; a file nobody wears goes after a while (ADR-0076 stage 4b). */
  loaded(): string[];
}

/** The followed character has a body on her shoulder. */
const carrying = (views: ReadonlyMap<EntityId, CharacterView>, followed: EntityId): boolean => {
  for (const [id, v] of views) if (carriedShoulder(id, v.transform, followed, views) !== null) return true;
  return false;
};

/** The root of a body lying turned away from a wall (G-458) or held in a grab (ADR-0075), over the simulation's place. */
const placeBody = (v: CharacterView, dt: number, carried: boolean, holder: CharacterRig | null, wall: WallProbe | undefined): void => {
  const t = v.transform;
  const lay = layBody(v.rig, dt, t, carried, wall);
  if (!placeHeld(v.rig, t, v.lift, holder, lay) && lay) placeLaid(v.rig, t, v.lift, lay);
};

/**
 * Views of the characters: procedural rigs, their transforms, draw distance and animation. A
 * facade (ADR-0031) over `CharacterModels` (imported models dressed over the rigs, pooled for
 * reuse), `CharacterKit` (weapons and garment add-ons), `CharacterDeaths` (the death fall
 * after the simulation removed one), the knockout parts (`knockout-pose`, `knockout-carry`,
 * `body-lay`) and the takedown grab's (`grab-clip`, ADR-0075).
 */
export class CharacterViews implements FxActors {
  private readonly views = new Map<EntityId, CharacterView>();
  /** Weapons, loadouts and the weapon in hand per character. */
  private readonly kit: CharacterKit;
  /** Imported models dressed over the rigs, and their pool. */
  private readonly models: CharacterModels;
  /** Characters playing their death fall after the simulation removed them. */
  private readonly deaths = new CharacterDeaths((rig) => disposeRig(rig, this.kit, this.models));
  /** The character the followed one holds in a takedown grab, kept while her clip eases out. */
  private held: EntityId | null = null;

  constructor(private readonly deps: CharacterViewsDeps) {
    const library = new ModelLibrary(deps.scene, deps.materials);
    this.kit = new CharacterKit({ ...deps, library });
    this.models = new CharacterModels({ library, loadouts: this.kit.loadouts, addCaster: (m) => deps.shadow.addCaster(m), scene: deps.scene, materials: deps.materials, ...(deps.modelFiles !== undefined ? { modelFiles: deps.modelFiles } : {}) });
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

  /** The FPP viewmodel shows the weapon in the hand of `id`, whom the camera now follows. */
  holdInView(id: EntityId): void {
    this.kit.holdInView(id);
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
    const model = modelChoiceOf(view);
    const lift = (this.deps.lift ?? groundLift)(t.position.x, t.position.y, t.position.z);
    this.views.set(id, { rig, transform: t, model, name, scan: scanClassOfView(view), lift });
    applyTransform(rig, t, lift);
    const shoulder = carriedShoulder(id, t, this.deps.cameraTarget(), this.views);
    settleKnockout(rig, !!t.unconscious, shoulder);
    const lay = layBody(rig, 0, t, shoulder !== null, this.deps.wall, true);
    if (lay) placeLaid(rig, t, lift, lay);
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

  /**
   * `fall` plays the death fall first; otherwise the character goes at once (reset, streaming, the
   * player). A knocked-out body is down already and goes at once too (into a hiding place, ADR-0065).
   */
  despawn(id: EntityId, fall: boolean): void {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    this.kit.forget(id);
    // A pooled model must not come back faded on someone else.
    fadeFigure(v.rig.root, 0);
    if (fall && !v.transform.unconscious) {
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
    const holder = followed === null ? undefined : this.views.get(followed);
    // Hands full (G-459): the weapon goes away in a grab and with a body on the shoulder.
    const busy = holder !== undefined && followed !== null && (holder.transform.grab !== undefined || carrying(this.views, followed));
    if (holder) holder.rig.handsBusy = busy;
    this.deps.camera.handsBusy = busy;
    for (const [id, v] of this.views) {
      // Far characters are switched off and skip their animation (ADR-0040).
      const t = v.transform;
      const shoulder = carriedShoulder(id, t, followed, this.views);
      if (id !== followed) {
        const near = withinDrawDistance(v.rig.root.position, eye);
        // A carried body is hidden with its carrier in first person.
        const shown = near && (shoulder === null || followed === null || this.views.get(followed)?.rig.root.isEnabled(false) !== false);
        if (v.rig.root.isEnabled(false) !== shown) v.rig.root.setEnabled(shown);
        if (!near) settleKnockout(v.rig, !!t.unconscious, null);
        if (!shown) continue;
      }
      // On a sidewalk the figure stands on its top (ADR-0041); the kerb is a short step.
      const lift = easeLift(v.lift, (this.deps.lift ?? groundLift)(t.position.x, t.position.y, t.position.z), dt);
      if (lift !== v.lift) {
        v.lift = lift;
        v.rig.root.position.y = t.position.y + lift;
      }
      const climb = t.climb !== undefined ? { climb: t.climb, rungs: this.deps.rungs?.(t.position.x, t.position.y, t.position.z) ?? null } : {};
      const motion = { ...(t.air !== undefined ? { air: t.air } : {}), ...climb, clock };
      animateRig(v.rig, t.speed, dt, t.crouch, { aim: t.aim ?? 0, guard: t.guard ?? 0 }, motion);
      this.deps.pose?.(id, v.rig, t.speed, dt, this.models.of(v.rig)?.retarget ?? null, clock);
      animateKnockout(v.rig, dt, !!t.unconscious, shoulder);
      animateGrab(v.rig, dt, t, id === followed ? "holder" : "held");
      if (id !== followed && t.grab) this.held = id;
      if (id !== followed) placeBody(v, dt, shoulder !== null, holder?.rig ?? null, this.deps.wall);
    }
    // The hands on the held one's neck, once both are posed; until her clip has eased out.
    const held = this.held === null ? undefined : this.views.get(this.held);
    if (holder && held && inGrab(holder.rig)) reachForNeck(holder.rig, held.rig);
    else this.held = null;
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
    this.kit.setViewArms(manifest.heroine);
    for (const v of this.views.values()) if (!this.models.of(v.rig)) this.models.dress(v.rig, v.model, v.name);
  }

  /** The models the loading screen waits for, and those that load once the game is on screen. */
  get modelLoading(): ModelLoading {
    return {
      start: () => [...this.models.preload([...this.views.values()].map((v) => v.model)), ...this.kit.preload()],
      rest: (live) => this.models.prefetch(live),
      loaded: () => this.models.loadedFiles(),
    };
  }
}
