import { type AbstractMesh, type Color3, Color4, Matrix, type Mesh, MeshBuilder, Vector3 } from "../babylon";
import type { AppearanceDescriptor, CameraMode, DespawnReason, EffectDescriptor, EntityId, HackTargetKind, RenderPort, Transform, ViewDescriptor, WeaponLook } from "@seki/core";
import type { DistrictId } from "@seki/sim";
import { CameraRig } from "../camera/camera-rig";
import { Effects } from "../effects/effects";
import { createRain } from "../effects/rain";
import { FlashLimiter } from "../effects/flash-limiter";
import { GameplayFxState } from "../effects/gameplay-fx";
import { GameplayPost } from "../effects/gameplay-post";
import { DISTRICT_PALETTES, PaletteBlend, districtAt, rigWithPalette } from "../npr/district-palette";
import { Grading } from "../npr/grading";
import { LineArt } from "../npr/line-art";
import { SpeedLines } from "../npr/speed-lines";
import { NIGHT_RIG, rigForDaylight } from "../npr/lighting";
import { MoonShadow } from "../npr/moon-shadow";
import { ToonMaterials } from "../npr/toon-material";
import { Atmosphere, createSplashes, createSteam } from "./atmosphere";
import { CityKit } from "./city-kit";
import { type DressBlock, isWalkedRoof } from "./dressing-plan";
import { WorldDressing } from "./dressing";
import { FarCity } from "./far-city";
import {
  type CharacterRig,
  animateRig,
  deathFinished,
  raiseWeapon,
  setWeaponDrawn,
  startDeath,
  startReload,
  startStagger,
  startSwing,
  buildCivilian, buildCorpo, buildFixer, buildGanger, buildHeroine, buildRipperdoc } from "./characters";
import { type CharacterModelKey, type CharacterModelManifest, type ModelInstance, ModelLibrary } from "./model-library";
import { HumanoidRetarget } from "./model-rig";
import { SpringBones, humanoidColliders } from "./spring-bones";
import { type WeaponManifest, WeaponMounts } from "./weapon-mount";
import { Loadouts } from "./loadout";
import { type PropView, buildBlock, buildLamp, buildLootBag, buildNeon, buildWater } from "./props";
import { Lasers } from "./lasers";
import { type ScanClass, ScanHighlight, scanClassOfTarget, scanClassOfView } from "./scan-highlight";
import { Signage } from "./signage";
import type { Stage } from "./stage";

/** An imported model dressed over a procedural rig, which keeps animating invisibly. */
interface Dressed {
  readonly model: ModelInstance;
  readonly retarget: HumanoidRetarget;
  /** Hair and cloth secondary motion, if the model has such bones. */
  readonly springs: SpringBones | null;
  /** Pool key: the model file. */
  readonly url: string;
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
  | { kind: "character"; rig: CharacterRig; transform: Transform; model: CharacterModelKey | null; name: string; scan: ScanClass | null }
  | { kind: "prop"; prop: PropView; lightKey: string | null; decor: Decor };

/** Atmosphere pieces added for a prop, taken back when the prop goes (world streaming). */
interface Decor {
  readonly meshes: Mesh[];
  readonly flicker: { emissiveColor: Color3 } | null;
}

const v3 = (p: { x: number; y: number; z: number }) => new Vector3(p.x, p.y, p.z);

export interface RendererOptions {
  /**
   * URL of the city kit (ADR-0022). Skinned blocks are drawn from it once it loads; until
   * then, and without it, they are plain boxes.
   */
  readonly cityKit?: string | null;
}

type BlockView = Extract<ViewDescriptor, { kind: "block" }>;

/** A skinned block waiting for the city kit. */
interface PendingSkin {
  readonly view: BlockView & { skin: NonNullable<BlockView["skin"]> };
  readonly center: Vector3;
  readonly box: Mesh | null;
}

/**
 * Gameplay moments the renderer shows over the whole frame (ADR-0030). The app translates domain
 * events into these; proposed as EffectDescriptor kinds in core.
 */
export type GameplayFxEvent =
  /** The player took damage. */
  | { readonly kind: "player-hurt"; readonly amount: number }
  /** A quickhack upload started or landed. */
  | { readonly kind: "quickhack"; readonly phase: "started" | "applied" }
  /** Heat level 0..3; `searching` while the hunters have lost the player. */
  | { readonly kind: "heat"; readonly level: number; readonly searching: boolean };

/** RenderPort over Babylon.js. Turns entity view descriptors into NPR meshes and drives the camera. */
export class BabylonRenderer implements RenderPort {
  readonly materials: ToonMaterials;
  readonly rig: CameraRig;
  readonly grading: Grading;
  private readonly effects: Effects;
  private readonly lasers: Lasers;
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
  private readonly weapons: WeaponMounts;
  /** Weapons and garment add-ons per character, from `setAppearance`. */
  private readonly loadouts: Loadouts;
  private models: CharacterModelManifest = {};
  private readonly dressed = new Map<CharacterRig, Dressed>();
  /** Rigs whose model is still loading, so a manifest arriving meanwhile does not dress them twice. */
  private readonly loadingModels = new Set<CharacterRig>();

  /** Buildings and vehicles from the city kit (ADR-0022), once it has loaded. */
  private city: CityKit | null = null;
  /** Procedural dressing of every streamed-in chunk (ADR-0027). */
  readonly dressing: WorldDressing;
  /** Stand-ins, tower rings and megabuildings beyond the streets (ADR-0027). */
  readonly farCity: FarCity;
  /** Blocks in view, for the walked-roof test (ADR-0027, C8). */
  private readonly blocks = new Map<EntityId, DressBlock>();
  private readonly pendingSkins = new Map<EntityId, PendingSkin>();
  private daylight = 0;
  /** Every effect that brightens the frame asks here first: three flashes a second at most. */
  private readonly limiter = new FlashLimiter();
  private readonly fx = new GameplayFxState(this.limiter);
  private readonly fxPost: GameplayPost;
  /** Signs, holo-ads and their street reflections, one draw call (ADR-0030). */
  readonly signage: Signage;
  /** District colour script on screen, blending when the camera crosses a seam. */
  private readonly palette = new PaletteBlend(DISTRICT_PALETTES["shinsekai-7"]);
  private district: DistrictId | null = null;
  /** Jump to the next district's palette instead of blending (start, new game, load). */
  private snapPalette = true;
  private reduceFlashes = false;
  private scanning = false;
  private scanFocus: { id: EntityId; kind: HackTargetKind | undefined } | null = null;
  private readonly scanHighlight = new ScanHighlight();

  constructor(
    private readonly stage: Stage,
    options: RendererOptions = {},
  ) {
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
    this.weapons = new WeaponMounts(this.library);
    this.loadouts = new Loadouts(scene, this.materials, this.weapons, (meshes) => {
      for (const m of meshes) this.shadow.addCaster(m);
    });
    this.rig = new CameraRig(scene, this.materials, (m) => this.blockers.has(m));
    this.rig.onBodyVisibility = (visible) => this.setPlayerBodyVisible(visible);
    // Line art must be attached before the grading pipeline so the ink gets graded too.
    this.lineArt = high ? new LineArt(scene, this.rig.camera) : null;
    if (this.lineArt) this.lineArt.geometryBuffer.renderTransparentMeshes = false;
    this.speedLines = new SpeedLines(scene, this.rig.camera);
    this.atmosphere = new Atmosphere(scene, NIGHT_RIG);
    this.farCity = new FarCity(scene, NIGHT_RIG);
    this.signage = new Signage(scene);
    // Without a kit the dressing goes in with the first chunk; with one, once it is known whether it loaded.
    this.dressing = new WorldDressing(scene, this.materials, options.cityKit ? "pending" : "bare", {
      built: (m) => this.shadow.addStaticCaster(m),
    });
    this.warmUpMaterials();
    this.grading = new Grading(scene, this.rig.camera, { reference: stage.options.reference }, this.limiter);
    // After the grading pipeline, so the scanner drains the graded colour.
    this.fxPost = new GameplayPost(scene, this.rig.camera);
    this.applyLook();
    this.effects = new Effects(scene, stage.glow);
    this.lasers = new Lasers(scene, stage.glow);
    this.rain = stage.options.reference ? null : createRain(scene);
    this.splashes = stage.options.reference || !high ? null : createSplashes(scene);
    if (!stage.options.reference) {
      // Manhole in the street and the vent behind the car wash.
      createSteam(scene, new Vector3(1.8, 0.05, 5.5), new Color4(0.6, 0.74, 0.85, 0.3), 22);
      createSteam(scene, new Vector3(-5.2, 1.45, 44), new Color4(0.8, 0.58, 0.64, 0.26), 14);
    }
    if (options.cityKit) this.loadCityKit(options.cityKit);
  }

  /**
   * Compiles the bare-structure skins (ADR-0027) up front, so the first pillar or wall that
   * streams in does not stall a frame on a shader compile.
   */
  private warmUpMaterials(): void {
    const probe = MeshBuilder.CreateBox("material-warmup", { size: 0.01 }, this.stage.scene);
    probe.isVisible = false;
    probe.isPickable = false;
    let left = 2;
    for (const preset of ["concreteBare", "metalPanel"] as const) {
      this.materials.get(preset).forceCompilation(probe, () => {
        left -= 1;
        if (left === 0) probe.dispose();
      });
    }
    // The holo shader too (ADR-0030); the gameplay post-process compiles when it is created.
    this.signage.warmUp();
  }

  /** Loads the kit in the background; the scene is not ready (reference frames wait) until it is in. */
  private loadCityKit(url: string): void {
    const { scene } = this.stage;
    const token = {};
    scene.addPendingData(token);
    CityKit.load(url)
      .then((data) => {
        if (scene.isDisposed) return;
        this.city = new CityKit(scene, this.materials, this.stage.glow, data, {
          onCovered: (box) => this.stepBack(box),
          walkedRoof: (center, size) => isWalkedRoof({ center, size }, this.blocks.values()),
        });
        this.city.setDaylight(this.daylight);
        for (const [id, p] of this.pendingSkins) this.city.add(id, p.view.skin, p.view.size, p.center, p.box);
        this.pendingSkins.clear();
        this.dressing.setKit("kit");
      })
      .catch((err: unknown) => {
        console.warn(`[city] ${url} failed to load, keeping plain blocks`, err);
        this.pendingSkins.clear();
        // The plain blocks get the procedural facades of every chunk (W9).
        this.dressing.setKit("bare");
      })
      .finally(() => scene.removePendingData(token));
  }

  /**
   * A box the kit now draws stays for the camera and the moon shadow, hidden. Its faces would
   * sit exactly on the model's walls and speckle them with shadow acne, so it steps back a
   * little inside them.
   */
  private stepBack(box: Mesh): void {
    const size = box.getBoundingInfo().boundingBox.extendSize;
    const inset = (half: number) => (half > 0 ? Math.max(0.5, (half - Math.min(0.25, half * 0.1)) / half) : 1);
    box.unfreezeWorldMatrix();
    const top = Math.min(0.3, size.y * 0.1);
    box.scaling.set(inset(size.x), size.y > 0 ? (size.y * 2 - top) / (size.y * 2) : 1, inset(size.z));
    box.position.y -= top / 2;
    box.freezeWorldMatrix();
    this.shadow.invalidateStatics();
  }

  /** Kit meshes built for skinned blocks (debug and tests). */
  get cityMeshes(): number {
    return this.city?.meshCount ?? 0;
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
              ? view.preset === "corpo"
                ? buildCorpo
                : buildGanger
              : view.preset === "fixer"
                ? buildFixer
                : view.preset === "ripperdoc"
                  ? buildRipperdoc
                  : buildCivilian;
        const rig = build(scene, this.materials, name);
        for (const m of rig.meshes) this.shadow.addCaster(m);
        const model = modelKeyOf(view);
        this.entities.set(id, { kind: "character", rig, transform: t, model, name, scan: scanClassOfView(view) });
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
        if (view.kind === "block") {
          this.dressing.addBlock(id, view, at);
          this.blocks.set(id, { center: { x: at.x, y: at.y, z: at.z }, size: view.size, material: view.material, ...(view.rungs ? { rungs: view.rungs } : {}) });
          // A ladder, or a rail or crate up on a roof, can make a roof walked: rebuild the kit
          // cells around it. Anything else leaves built cells alone (rebuilding them stalls a frame).
          const raised = at.y - view.size.y / 2 > 2 && Math.min(view.size.x, view.size.z) < 3;
          if (!view.skin && (view.rungs || raised)) this.city?.touch(at.x, at.z);
        } else if (view.kind === "neon") {
          this.dressing.addSign(id, view, at);
        }
        if (view.kind === "block" && view.skin) {
          const box = (prop.root.getChildMeshes(true)[0] as Mesh | undefined) ?? null;
          const skinned = { view: { ...view, skin: view.skin }, center: at, box };
          if (this.city) this.city.add(id, view.skin, view.size, at, box);
          else this.pendingSkins.set(id, skinned);
        }
        return;
      }
      case "water": {
        const prop = buildWater(scene, this.materials, name, view, v3(t.position));
        this.entities.set(id, { kind: "prop", prop, lightKey: null, decor: { meshes: [], flicker: null } });
        return;
      }
      case "loot": {
        const prop = buildLootBag(scene, this.materials, name, view, v3(t.position));
        for (const m of prop.glowing) this.stage.glow.addIncludedOnlyMesh(m);
        this.entities.set(id, { kind: "prop", prop, lightKey: null, decor: { meshes: [], flicker: null } });
        return;
      }
    }
  }

  updateTransform(id: EntityId, t: Transform): void {
    const e = this.entities.get(id);
    if (e?.kind === "prop") {
      // A lift platform or gate (ADR-0020): props are built frozen, so thaw on the first move.
      const root = e.prop.root;
      if (root.position.x === t.position.x && root.position.y === t.position.y && root.position.z === t.position.z) return;
      for (const m of root.getChildMeshes(false)) if (m.isWorldMatrixFrozen) m.unfreezeWorldMatrix();
      root.position.set(t.position.x, t.position.y, t.position.z);
      return;
    }
    if (e?.kind !== "character") return;
    e.transform = t;
    this.applyTransform(e.rig, t);
  }

  despawn(id: EntityId, reason: DespawnReason = "removed"): void {
    const e = this.entities.get(id);
    if (!e) return;
    this.entities.delete(id);
    this.held.delete(id);
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
    this.city?.remove(id);
    this.pendingSkins.delete(id);
    this.dressing.remove(id);
    this.blocks.delete(id);
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
    this.rig.setHeldWeapon(this.held.get(id) ?? null);
  }

  /** Weapon in hand per character, so the FPP viewmodel can follow whoever the camera takes. */
  private readonly held = new Map<EntityId, WeaponLook | null>();

  /** Outfits and stowed weapons arrive with the appearance work (ADR-0015, stage E7). */

  playEffect(effect: EffectDescriptor): void {
    switch (effect.kind) {
      case "muzzle-flash": {
        const own = effect.shooterId === this.cameraTarget;
        const shooter = this.entities.get(effect.shooterId);
        if (shooter?.kind === "character") raiseWeapon(shooter.rig);
        const from = (own ? this.rig.muzzlePosition() : null) ?? v3(effect.from);
        this.effects.muzzleFlash(from, v3(effect.to));
        if (own) this.rig.kick();
        // The muzzle lights the whole street: one of the three flashes a second, or none.
        if (!this.reduceFlashes && this.limiter.tryFlash()) this.flash = { x: from.x, y: from.y, z: from.z, life: 0.07 };
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
      case "talk": {
        const e = this.entities.get(effect.entityId);
        if (e?.kind === "character") this.dressed.get(e.rig)?.model.face?.talk(effect.seconds);
        return;
      }
      case "reload": {
        const e = this.entities.get(effect.entityId);
        if (e?.kind === "character") startReload(e.rig, effect.duration);
        if (effect.entityId === this.cameraTarget) this.rig.startReload(effect.duration);
        return;
      }
      case "melee": {
        const e = this.entities.get(effect.entityId);
        if (e?.kind === "character") startSwing(e.rig, effect.strike, effect.windup, effect.recovery);
        if (effect.entityId === this.cameraTarget) this.rig.startSwing(effect.strike, effect.windup, effect.recovery);
        return;
      }
      case "stagger": {
        const e = this.entities.get(effect.entityId);
        if (e?.kind === "character") startStagger(e.rig, effect.duration);
        if (effect.entityId === this.cameraTarget) this.rig.shake(0.8);
        return;
      }
      case "block": {
        this.effects.hitSpark(v3(effect.at), effect.parried);
        const e = this.entities.get(effect.entityId);
        if (e?.kind === "character") e.rig.flinch = Math.max(e.rig.flinch, 0.4);
        if (effect.entityId === this.cameraTarget) this.rig.shake(effect.parried ? 0.15 : 0.35);
        return;
      }
      case "flinch": {
        const e = this.entities.get(effect.entityId);
        if (e?.kind === "character") e.rig.flinch = 1;
        if (effect.entityId === this.cameraTarget) this.rig.shake(0.6);
        return;
      }
      case "laser": {
        if (effect.duration <= 0) this.lasers.stop(effect.shooterId);
        else this.lasers.start(effect.shooterId, effect.targetId, effect.duration);
        return;
      }
      case "time-of-day": {
        // The app sends this only when the light level moves a step, so re-applying is cheap.
        this.daylight = effect.daylight;
        this.applyLook();
        this.materials.get("dressing").setFloat("selfLit", 1 - 0.5 * Math.max(0, Math.min(1, effect.daylight)));
        this.city?.setDaylight(effect.daylight);
        return;
      }
    }
  }

  /**
   * Light rig of the time of day in the colours of the district on screen (ADR-0030): toon fog,
   * ambient and rim, the grade, the sky, the far city and the signs.
   */
  private applyLook(): void {
    const p = this.palette.value;
    const rig = rigWithPalette(rigForDaylight(this.daylight), p, this.daylight);
    this.materials.setRig(rig);
    this.materials.setRimTint(p.rim, p.rimWeight * (1 - 0.5 * Math.max(0, Math.min(1, this.daylight))));
    this.atmosphere.setDaylight(rig, this.daylight);
    this.farCity.setDaylight(rig, this.daylight);
    this.signage.setDaylight(rig, this.daylight);
    this.grading.setPalette(p);
  }

  /** The district under the camera picks the palette; a seam crossing blends over a few seconds. */
  private updatePalette(dt: number): void {
    const cam = this.rig.camera.position;
    const here = districtAt(cam.x, cam.z) ?? this.district;
    if (here !== null && (here !== this.district || this.snapPalette)) {
      this.palette.retarget(DISTRICT_PALETTES[here], this.snapPalette);
      if (this.snapPalette) this.applyLook();
      this.district = here;
      this.snapPalette = false;
    }
    if (this.palette.update(dt)) this.applyLook();
  }

  /** District whose colours are on screen (debug and tests). */
  get paletteDistrict(): DistrictId | null {
    return this.district;
  }

  /** Accessibility (ADR-0028): no aberration, glitch or flicker anywhere; slow fades only. */
  setReduceFlashes(on: boolean): void {
    this.reduceFlashes = on;
    this.fx.setReduceFlashes(on);
    this.grading.setReduceFlashes(on);
    this.signage.setReduceFlashes(on);
    this.farCity.setReduceFlashes(on);
    this.atmosphere.reduceFlicker = on;
  }

  /** A gameplay moment over the whole frame (ADR-0030): a hit, a quickhack, heat. */
  gameplayFx(e: GameplayFxEvent): void {
    switch (e.kind) {
      case "player-hurt":
        this.fx.hurtBy(e.amount);
        return;
      case "quickhack":
        this.fx.hack(e.phase);
        return;
      case "heat":
        this.fx.setHeat(e.level, e.searching);
        return;
    }
  }

  /** The scanner is held: scanlines and drained colour, targets outlined by kind. */
  setScanning(on: boolean): void {
    if (on === this.scanning) return;
    this.scanning = on;
    this.fx.setScanning(on);
    if (!on) this.scanHighlight.release();
  }

  /** What the scanner focuses (ScanFocusChanged): filled and outlined; cameras and devices in yellow. */
  setScanFocus(id: EntityId | null, kind?: HackTargetKind): void {
    this.scanFocus = id === null ? null : { id, kind };
  }

  /** Outlines every character in the scanner's colours, the focused target filled too. */
  private updateScanHighlight(): void {
    if (!this.scanning) return;
    const strength = Math.min(1, this.fx.uniforms.scan * 1.4);
    const keep = new Set<AbstractMesh>();
    for (const [id, e] of this.entities) {
      const focused = this.scanFocus?.id === id;
      const own = e.kind === "character" ? e.scan : null;
      const cls = focused ? scanClassOfTarget(this.scanFocus?.kind, own) : own;
      if (!cls) continue;
      const meshes: readonly AbstractMesh[] = e.kind === "character" ? (this.dressed.get(e.rig)?.model.meshes ?? e.rig.meshes) : e.prop.root.getChildMeshes(false);
      this.scanHighlight.mark(meshes, cls, focused, strength);
      for (const m of meshes) keep.add(m);
    }
    this.scanHighlight.release(keep);
  }

  /** Per-frame presentation update: animation, camera, VFX, rain. Call before scene.render(). */
  frame(dt: number): void {
    this.limiter.advance(dt);
    this.city?.flush();
    if (this.dressing.flush()) this.farCity.setResident(this.dressing.residentChunks());
    for (const e of this.entities.values()) {
      if (e.kind === "character") {
        const t = e.transform;
        const motion = { ...(t.air !== undefined ? { air: t.air } : {}), ...(t.climb !== undefined ? { climb: t.climb } : {}) };
        animateRig(e.rig, t.speed, dt, t.crouch, { aim: t.aim ?? 0, guard: t.guard ?? 0 }, motion);
      }
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
      d.retarget.update();
      d.springs?.update(dt);
      d.model.face?.update(dt);
    }
    for (const e of this.entities.values()) if (e.kind === "character") this.loadouts.update(e.rig);
    for (const rig of this.dying) this.loadouts.update(rig);
    const target = this.cameraTarget === null ? undefined : this.entities.get(this.cameraTarget);
    this.rig.update(target?.kind === "character" ? target.transform : null, dt);
    // Shadow follows what the camera looks at: the player, or the fixed reference view.
    const focus = target?.kind === "character" ? target.transform.position : this.rig.camera.position;
    const moved = this.shadow.update(focus);
    this.materials.setLightFocus(this.rig.camera.position.x, this.rig.camera.position.z);
    if (moved) this.materials.setShadowMatrix(moved);
    this.effects.update(dt);
    this.lasers.update(dt, (id) => {
      const e = this.entities.get(id);
      return e?.kind === "character" ? e.transform : null;
    });
    if (this.flash) {
      this.flash.life -= dt;
      const intensity = Math.max(0, this.flash.life / 0.07);
      this.materials.setFlash(this.flash.x, this.flash.y, this.flash.z, intensity);
      if (this.flash.life <= 0) this.flash = null;
    }
    this.atmosphere.update(dt, this.stage.options.reference);
    this.farCity.update(dt, this.rig.camera.position, this.stage.options.reference);
    this.signage.update(dt, this.stage.options.reference);
    this.updatePalette(dt);
    this.fx.update(dt);
    this.fxPost.update(this.fx.uniforms, this.fx.active);
    this.updateScanHighlight();
    this.grading.update(dt);
    this.speedLines.update(dt);
    this.rain?.follow(this.rig.camera.position);
    this.splashes?.follow(this.rig.camera.position);
  }

  private resetting = false;
  private flash: { x: number; y: number; z: number; life: number } | null = null;

  clear(): void {
    this.lasers.clear();
    // A new game or a load lands anywhere: the next district's colours come in at once.
    this.snapPalette = true;
    this.scanHighlight.release();
    this.fx.setHeat(0, false);
    this.resetting = true;
    for (const id of [...this.entities.keys()]) this.despawn(id);
    for (const rig of this.dying.splice(0)) this.disposeRig(rig);
    this.resetting = false;
  }

  /**
   * Weapon models (glTF) that replace the placeholder box pistols in hands, holsters, the FPP
   * viewmodel and the hands of imported characters. Characters on screen are re-armed.
   */
  setWeaponModels(manifest: WeaponManifest): void {
    this.weapons.setManifest(manifest);
    this.loadouts.remountAll();
    if (this.weapons.has("pistol")) {
      void this.weapons.mount(this.rig.weaponMount, "pistol", "vm-weapon", "view").then((pivot) => {
        if (pivot) this.rig.hidePlaceholderGun();
      });
    }
  }

  /** What a character wears and carries (ADR-0015): weapons in hand, holster and on the back, garment add-ons. */
  setAppearance(id: EntityId, appearance: AppearanceDescriptor): void {
    const e = this.entities.get(id);
    if (e?.kind !== "character" || !e.rig.aiming) return;
    const w = appearance.weapons;
    // A baton or blade in hand swings and guards instead of aiming (ADR-0019).
    e.rig.melee = w.active === "melee" && w.melee !== null;
    this.held.set(id, w[w.active]);
    if (id === this.cameraTarget) this.rig.setHeldWeapon(w[w.active]);
    this.loadouts.set(e.rig, appearance, e.name);
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

  private readonly modelPool = new Map<string, ModelInstance[]>();

  private attachModel(rig: CharacterRig, model: ModelInstance, url: string, key: CharacterModelKey | null): void {
    model.root.setEnabled(true);
    const retarget = HumanoidRetarget.create(rig, model.root, model.prefix);
    if (!retarget) {
      console.warn(`[models] ${url}: no humanoid bones found, keeping the procedural ${key}`);
      model.dispose();
      return;
    }
    for (const m of rig.meshes) m.setEnabled(false);
    for (const m of model.meshes) if (m.getTotalVertices() > 0) this.shadow.addCaster(m);
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
