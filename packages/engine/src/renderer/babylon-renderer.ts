import { type AbstractMesh, type Color3, Color4, Matrix, type Mesh, MeshBuilder, Vector3 } from "../babylon";
import { applyOutline } from "../npr/outline";
import type { CameraMode, DespawnReason, EffectDescriptor, EntityId, RenderPort, Transform, ViewDescriptor } from "@seki/core";
import { CameraRig } from "../camera/camera-rig";
import { Effects } from "../effects/effects";
import { createRain } from "../effects/rain";
import { Grading } from "../npr/grading";
import { LineArt } from "../npr/line-art";
import { SpeedLines } from "../npr/speed-lines";
import { NIGHT_RIG } from "../npr/lighting";
import { MoonShadow } from "../npr/moon-shadow";
import { ToonMaterials } from "../npr/toon-material";
import { Atmosphere, createSplashes, createSteam } from "./atmosphere";
import { createDressing } from "./dressing";
import { type CharacterRig, animateRig, deathFinished, raiseWeapon, setWeaponDrawn, startDeath, buildCivilian, buildFixer, buildGanger, buildHeroine, buildRipperdoc } from "./characters";
import { type CharacterModelKey, type CharacterModelManifest, type ModelInstance, ModelLibrary } from "./model-library";
import { HumanoidRetarget } from "./model-rig";
import { SpringBones, humanoidColliders } from "./spring-bones";
import { type PropView, buildBlock, buildLamp, buildNeon } from "./props";
import type { Stage } from "./stage";

/** An imported model dressed over a procedural rig, which keeps animating invisibly. */
interface Dressed {
  readonly model: ModelInstance;
  readonly retarget: HumanoidRetarget;
  /** Hair and cloth secondary motion, if the model has such bones. */
  readonly springs: SpringBones | null;
  /** Pistol in the model's hand, shown while the rig has it drawn. */
  gun: AbstractMesh | null;
}

const modelKeyOf = (view: ViewDescriptor): CharacterModelKey | null => {
  switch (view.kind) {
    case "heroine":
      return "heroine";
    case "enemy":
      return "ganger";
    case "npc":
      return view.preset === "fixer" ? "fixer" : view.preset === "ripperdoc" ? "ripperdoc" : "civilian";
    default:
      return null;
  }
};

type Spawned =
  | { kind: "character"; rig: CharacterRig; transform: Transform; model: CharacterModelKey | null; name: string }
  | { kind: "prop"; prop: PropView; lightKey: string | null; decor: Decor };

/** Atmosphere pieces added for a prop, taken back when the prop goes (world streaming). */
interface Decor {
  readonly meshes: Mesh[];
  readonly flicker: { emissiveColor: Color3 } | null;
}

const v3 = (p: { x: number; y: number; z: number }) => new Vector3(p.x, p.y, p.z);

/** RenderPort over Babylon.js. Turns entity view descriptors into NPR meshes and drives the camera. */
export class BabylonRenderer implements RenderPort {
  readonly materials: ToonMaterials;
  readonly rig: CameraRig;
  readonly grading: Grading;
  private readonly effects: Effects;
  private readonly rain: ReturnType<typeof createRain> | null;
  private readonly splashes: ReturnType<typeof createSplashes> | null;
  readonly shadow: MoonShadow;
  readonly lineArt: LineArt | null;
  readonly atmosphere: Atmosphere;
  readonly speedLines: SpeedLines;
  private readonly entities = new Map<EntityId, Spawned>();
  /** Characters playing their death fall after the simulation removed them. */
  private readonly dying: CharacterRig[] = [];
  private readonly blockers = new Set<AbstractMesh>();
  private cameraTarget: EntityId | null = null;
  private readonly library: ModelLibrary;
  private models: CharacterModelManifest = {};
  private readonly dressed = new Map<CharacterRig, Dressed>();
  /** Rigs whose model is still loading, so a manifest arriving meanwhile does not dress them twice. */
  private readonly loadingModels = new Set<CharacterRig>();

  constructor(private readonly stage: Stage) {
    const { scene } = stage;
    this.materials = new ToonMaterials(scene);
    const high = (stage.options.quality ?? "high") === "high";
    this.shadow = new MoonShadow(scene, NIGHT_RIG, 28, high ? 2048 : 1024);
    this.materials.setShadow({
      texture: this.shadow.texture,
      matrix: this.shadow.update({ x: 0, y: 0, z: 0 }) ?? Matrix.Identity(),
      texelSize: this.shadow.texelSize,
      bias: high ? 0.0012 : 0.002,
      strength: 0.9,
    });
    this.library = new ModelLibrary(scene, this.materials);
    this.rig = new CameraRig(scene, this.materials, (m) => this.blockers.has(m));
    this.rig.onBodyVisibility = (visible) => this.setPlayerBodyVisible(visible);
    // Line art must be attached before the grading pipeline so the ink gets graded too.
    this.lineArt = high ? new LineArt(scene, this.rig.camera) : null;
    if (this.lineArt) this.lineArt.geometryBuffer.renderTransparentMeshes = false;
    this.speedLines = new SpeedLines(scene, this.rig.camera);
    this.atmosphere = new Atmosphere(scene, NIGHT_RIG);
    const dressing = createDressing(scene, this.materials);
    for (const m of dressing.casters) this.shadow.addStaticCaster(m);
    for (const m of dressing.meshes) if (m.material?.name.includes("vendingGlow")) stage.glow.addIncludedOnlyMesh(m);
    this.grading = new Grading(scene, this.rig.camera, { reference: stage.options.reference });
    this.effects = new Effects(scene, stage.glow);
    this.rain = stage.options.reference ? null : createRain(scene);
    this.splashes = stage.options.reference || !high ? null : createSplashes(scene);
    if (!stage.options.reference) {
      // Manhole in the street and the vent behind the car wash.
      createSteam(scene, new Vector3(1.8, 0.05, 5.5), new Color4(0.6, 0.74, 0.85, 0.3), 22);
      createSteam(scene, new Vector3(-5.2, 1.45, 44), new Color4(0.8, 0.58, 0.64, 0.26), 14);
    }
  }

  spawn(id: EntityId, view: ViewDescriptor, t: Transform): void {
    if (this.entities.has(id)) this.despawn(id);
    const { scene } = this.stage;
    const name = `e${id}`;
    switch (view.kind) {
      case "heroine":
      case "npc":
      case "enemy": {
        const build =
          view.kind === "heroine"
            ? buildHeroine
            : view.kind === "enemy"
              ? buildGanger
              : view.preset === "fixer"
                ? buildFixer
                : view.preset === "ripperdoc"
                  ? buildRipperdoc
                  : buildCivilian;
        const rig = build(scene, this.materials, name);
        for (const m of rig.meshes) this.shadow.addCaster(m);
        const model = modelKeyOf(view);
        this.entities.set(id, { kind: "character", rig, transform: t, model, name });
        this.applyTransform(rig, t);
        this.dress(rig, model, name);
        return;
      }
      case "block":
      case "neon":
      case "lamp": {
        const at = v3(t.position);
        const prop =
          view.kind === "block"
            ? buildBlock(scene, this.materials, name, view, at)
            : view.kind === "neon"
              ? buildNeon(scene, name, view, at)
              : buildLamp(scene, this.materials, name, view.color, at);
        for (const m of prop.glowing) this.stage.glow.addIncludedOnlyMesh(m);
        for (const m of prop.blockers) this.blockers.add(m);
        for (const m of prop.casters) this.shadow.addStaticCaster(m);
        const decor = this.decorateProp(name, view, at, prop);
        const lightKey = prop.light ? name : null;
        if (prop.light && lightKey) this.materials.addLight(lightKey, prop.light);
        this.entities.set(id, { kind: "prop", prop, lightKey, decor });
        return;
      }
    }
  }

  updateTransform(id: EntityId, t: Transform): void {
    const e = this.entities.get(id);
    if (e?.kind !== "character") return;
    e.transform = t;
    this.applyTransform(e.rig, t);
  }

  despawn(id: EntityId, reason: DespawnReason = "removed"): void {
    const e = this.entities.get(id);
    if (!e) return;
    this.entities.delete(id);
    if (e.kind === "character") {
      // Enemies fall over before disappearing; a reset (load, new game) or a chunk streaming
      // out clears them at once.
      if (!this.resetting && reason === "removed" && id !== this.cameraTarget) {
        startDeath(e.rig);
        this.dying.push(e.rig);
      } else {
        this.disposeRig(e.rig);
      }
      return;
    }
    for (const m of e.prop.blockers) this.blockers.delete(m);
    if (e.lightKey) this.materials.removeLight(e.lightKey);
    for (const m of e.decor.meshes) this.atmosphere.removeDecoration(m);
    if (e.decor.flicker) this.atmosphere.removeFlicker(e.decor.flicker);
    // Glowing parts (neon faces, lamp bulbs) own their material and texture; the rest share toon presets.
    for (const m of e.prop.glowing) m.material?.dispose(false, true);
    e.prop.root.dispose(false, false);
  }

  setCameraMode(mode: CameraMode): void {
    this.rig.setMode(mode);
  }

  attachCamera(id: EntityId): void {
    this.cameraTarget = id;
  }

  playEffect(effect: EffectDescriptor): void {
    switch (effect.kind) {
      case "muzzle-flash": {
        const own = effect.shooterId === this.cameraTarget;
        const shooter = this.entities.get(effect.shooterId);
        if (shooter?.kind === "character") raiseWeapon(shooter.rig);
        const from = (own ? this.rig.muzzlePosition() : null) ?? v3(effect.from);
        this.effects.muzzleFlash(from, v3(effect.to));
        if (own) this.rig.kick();
        this.flash = { x: from.x, y: from.y, z: from.z, life: 0.07 };
        return;
      }
      case "hit-spark":
        this.effects.hitSpark(v3(effect.at), effect.critical);
        return;
      case "memory-glitch":
        this.grading.glitch();
        return;
      case "overdrive":
        this.grading.setOverdrive(effect.active);
        this.speedLines.active = effect.active;
        if (this.rain) this.rain.system.updateSpeed = effect.active ? 1 / 200 : 1 / 60;
        return;
      case "heal":
        this.grading.pulse();
        return;
      case "weapon": {
        const e = this.entities.get(effect.entityId);
        if (e?.kind === "character") setWeaponDrawn(e.rig, effect.drawn);
        if (effect.entityId === this.cameraTarget) this.rig.setWeaponDrawn(effect.drawn);
        return;
      }
      case "flinch": {
        const e = this.entities.get(effect.entityId);
        if (e?.kind === "character") e.rig.flinch = 1;
        if (effect.entityId === this.cameraTarget) this.rig.shake(0.6);
        return;
      }
    }
  }

  /** Per-frame presentation update: animation, camera, VFX, rain. Call before scene.render(). */
  frame(dt: number): void {
    for (const e of this.entities.values()) if (e.kind === "character") animateRig(e.rig, e.transform.speed, dt);
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const rig = this.dying[i];
      if (!rig) continue;
      animateRig(rig, 0, dt);
      if (deathFinished(rig)) {
        this.disposeRig(rig);
        this.dying.splice(i, 1);
      }
    }
    for (const [rig, d] of this.dressed) {
      d.retarget.update();
      d.springs?.update(dt);
      d.gun?.setEnabled(rig.drawn >= 0.5);
    }
    const target = this.cameraTarget === null ? undefined : this.entities.get(this.cameraTarget);
    this.rig.update(target?.kind === "character" ? target.transform : null, dt);
    // Shadow follows what the camera looks at: the player, or the fixed reference view.
    const focus = target?.kind === "character" ? target.transform.position : this.rig.camera.position;
    const moved = this.shadow.update(focus);
    this.materials.setLightFocus(this.rig.camera.position.x, this.rig.camera.position.z);
    if (moved) this.materials.setShadowMatrix(moved);
    this.effects.update(dt);
    if (this.flash) {
      this.flash.life -= dt;
      const intensity = Math.max(0, this.flash.life / 0.07);
      this.materials.setFlash(this.flash.x, this.flash.y, this.flash.z, intensity);
      if (this.flash.life <= 0) this.flash = null;
    }
    this.atmosphere.update(dt, this.stage.options.reference);
    this.grading.update(dt);
    this.speedLines.update(dt);
    this.rain?.follow(this.rig.camera.position);
    this.splashes?.follow(this.rig.camera.position);
  }

  private resetting = false;
  private flash: { x: number; y: number; z: number; life: number } | null = null;

  clear(): void {
    this.resetting = true;
    for (const id of [...this.entities.keys()]) this.despawn(id);
    for (const rig of this.dying.splice(0)) this.disposeRig(rig);
    this.resetting = false;
  }

  /** Imported character models (models/manifest.json); characters on screen are dressed too. */
  setCharacterModels(manifest: CharacterModelManifest): void {
    this.models = manifest;
    for (const e of this.entities.values()) if (e.kind === "character" && !this.dressed.has(e.rig)) this.dress(e.rig, e.model, e.name);
  }

  get dressedCount(): number {
    return this.dressed.size;
  }

  /** Loads the model in the background and swaps it in once ready, if the rig still exists. */
  private dress(rig: CharacterRig, key: CharacterModelKey | null, name: string): void {
    const spec = key ? this.models[key] : undefined;
    if (!spec) return;
    this.loadingModels.add(rig);
    this.library
      .instantiate(spec, `${name}-m`)
      .then((model) => {
        this.loadingModels.delete(rig);
        if (rig.root.isDisposed()) return model.dispose();
        const retarget = HumanoidRetarget.create(rig, model.root, `${name}-m-`);
        if (!retarget) {
          console.warn(`[models] ${spec.url}: no humanoid bones found, keeping the procedural ${key}`);
          return model.dispose();
        }
        for (const m of rig.meshes) m.setEnabled(false);
        for (const m of model.meshes) if (m.getTotalVertices() > 0) this.shadow.addCaster(m);
        const prefix = `${name}-m-`;
        const springs = SpringBones.create(model.root, { vrm: model.springs, prefix, colliders: humanoidColliders(model.root, prefix) });
        const dressed: Dressed = { model, retarget, springs, gun: null };
        this.dressed.set(rig, dressed);
        if (rig.aiming) dressed.gun = this.arm(model, retarget);
      })
      .catch((err: unknown) => {
        this.loadingModels.delete(rig);
        console.warn(`[models] ${spec.url} failed to load`, err);
      });
  }

  /** The procedural gun is baked into the hidden rig mesh; a dressed shooter gets its own. */
  private arm(model: ModelInstance, retarget: HumanoidRetarget): AbstractMesh | null {
    const gun = MeshBuilder.CreateBox(`${model.root.name}-gun`, { width: 0.035, height: 0.2, depth: 0.06 }, this.stage.scene);
    gun.material = this.materials.get("gun");
    gun.isPickable = false;
    applyOutline(gun);
    if (!retarget.holdInRightHand(gun, new Vector3(0, -0.1, 0.03))) {
      gun.dispose();
      return null;
    }
    model.meshes.push(gun);
    this.shadow.addCaster(gun);
    return gun;
  }

  private disposeRig(rig: CharacterRig): void {
    this.dressed.get(rig)?.model.dispose();
    this.dressed.delete(rig);
    rig.root.dispose(false, false);
  }

  /** Interpolated transform of the entity the camera follows (the player), if any. */
  get cameraTargetTransform(): Transform | null {
    const target = this.cameraTarget === null ? undefined : this.entities.get(this.cameraTarget);
    return target?.kind === "character" ? target.transform : null;
  }

  get entityCount(): number {
    return this.entities.size;
  }

  /** Light shafts, wet-street reflections and flicker for lamps and neon signs. */
  private decorateProp(name: string, view: ViewDescriptor, at: Vector3, prop: PropView): Decor {
    if (view.kind === "lamp" && prop.light) {
      const l = prop.light.position;
      const cone = this.atmosphere.addLightCone(`${name}-cone`, new Vector3(l.x, 5.05, l.z), view.color);
      const refl = this.atmosphere.addReflection(`${name}-refl`, new Vector3(l.x, 0, l.z), new Vector3(-Math.sign(at.x) || 1, 0, 0), 1.4, 5, view.color, 0.35);
      return { meshes: [cone, refl], flicker: null };
    }
    if (view.kind !== "neon") return { meshes: [], flicker: null };
    const thinX = view.size.x <= view.size.z && view.size.x <= view.size.y;
    const towards = thinX ? new Vector3(at.x > 0 ? -1 : 1, 0, 0) : new Vector3(0, 0, -1);
    const width = thinX ? view.size.z : view.size.x;
    const refl = this.atmosphere.addReflection(`${name}-refl`, new Vector3(at.x, 0, at.z), towards, Math.max(1.2, width), 7, view.color, 0.55);
    const sign = prop.glowing[0]?.material as unknown as { emissiveColor?: Color3 } | null;
    if (sign?.emissiveColor && (view.label === "HOTEL" || view.label === "KUSURI")) {
      const flicker = sign as { emissiveColor: Color3 };
      this.atmosphere.addFlicker(flicker, view.label.length);
      return { meshes: [refl], flicker };
    }
    return { meshes: [refl], flicker: null };
  }

  private applyTransform(rig: CharacterRig, t: Transform): void {
    rig.root.position.set(t.position.x, t.position.y, t.position.z);
    rig.root.rotation.y = t.yaw;
  }

  private setPlayerBodyVisible(visible: boolean): void {
    const target = this.cameraTarget === null ? undefined : this.entities.get(this.cameraTarget);
    if (target?.kind !== "character") return;
    if (target.rig.root.isEnabled() !== visible) target.rig.root.setEnabled(visible);
  }
}
