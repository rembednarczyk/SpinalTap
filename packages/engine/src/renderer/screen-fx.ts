import { type AbstractMesh, Color4, Vector3 } from "../babylon";
import type { EffectDescriptor, EntityId, HackTargetKind, Transform, Vec3 } from "@seki/core";
import { type DistrictId, STEAM_VENTS } from "@seki/sim";
import type { CameraRig } from "../camera/camera-rig";
import { Effects } from "../effects/effects";
import { FlashLimiter } from "../effects/flash-limiter";
import { GameplayFxState } from "../effects/gameplay-fx";
import { GameplayPost } from "../effects/gameplay-post";
import { createRain } from "../effects/rain";
import { TrailMeshes } from "../effects/trail-meshes";
import { TrailState } from "../effects/trails";
import { DISTRICT_PALETTES, PaletteBlend, districtAt, rigWithPalette } from "../npr/district-palette";
import { Grading } from "../npr/grading";
import { qualityTier } from "../npr/quality";
import { rigForDaylight } from "../npr/lighting";
import type { SpeedLines } from "../npr/speed-lines";
import type { ToonMaterials } from "../npr/toon-material";
import { type Atmosphere, createSplashes, createSteam } from "./atmosphere";
import { type CharacterRig, raiseWeapon, setWeaponDrawn, startReload, startStagger, startSwing } from "./characters";
import type { FarCity } from "./far-city";
import { Lasers } from "./lasers";
import { type ScanClass, ScanHighlight, scanClassOfTarget } from "./scan-highlight";
import type { Signage } from "./signage";
import type { Stage } from "./stage";

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
  | { readonly kind: "heat"; readonly level: number; readonly searching: boolean }
  /** Someone dashed from `at` (Dashed, ADR-0036): streaks behind them; blur and speed lines for the player. */
  | { readonly kind: "dash"; readonly entityId: EntityId; readonly at: Vec3; readonly air: boolean }
  /** A blade sent a bullet back (ProjectileReflected): a spark at `at` and a light trail to `to`. */
  | { readonly kind: "reflect"; readonly defenderId: EntityId; readonly at: Vec3; readonly to: Vec3 };

/** Visits one entity the scanner may outline: its own scan class and, lazily, its meshes. */
export type ScanVisitor = (id: EntityId, own: ScanClass | null, meshes: () => readonly AbstractMesh[]) => void;

/** The characters effects act on: rigs to animate, faces to talk, transforms for lasers. */
export interface FxActors {
  rigOf(id: EntityId): CharacterRig | null;
  transformOf(id: EntityId): Transform | null;
  talk(id: EntityId, seconds: number): void;
}

export interface ScreenFxDeps {
  readonly stage: Stage;
  readonly materials: ToonMaterials;
  readonly camera: CameraRig;
  readonly atmosphere: Atmosphere;
  readonly farCity: FarCity;
  readonly signage: Signage;
  readonly speedLines: SpeedLines;
  readonly actors: FxActors;
  /** The entity the camera follows, if any. */
  readonly cameraTarget: () => EntityId | null;
  /** Every entity the scanner may outline. */
  readonly scanTargets: (visit: ScanVisitor) => void;
  /** Multiplies the fog density of every look (1 in the game; the map preview sees further, ADR-0044). */
  readonly fogScale?: number;
  /** Whether a roof is above a point: rain does not fall in a gate's passage or indoors. */
  readonly roofOver?: (x: number, y: number, z: number) => boolean;
}

const v3 = (p: { x: number; y: number; z: number }) => new Vector3(p.x, p.y, p.z);

type ActorEffect = Extract<EffectDescriptor, { kind: "weapon" | "talk" | "reload" | "melee" | "stagger" | "block" | "flinch" }>;

/**
 * Everything over the frame (ADR-0030): one-shot effects and lasers, rain, splashes and steam,
 * the grade and the gameplay post-process, the district palette with the time of day, the
 * flash limit and reduced flashes, and the scanner's outlines.
 */
export class ScreenFx {
  readonly grading: Grading;
  /** Every effect that brightens the frame asks here first: three flashes a second at most. */
  private readonly limiter = new FlashLimiter();
  private readonly fx = new GameplayFxState(this.limiter);
  private readonly fxPost: GameplayPost;
  private readonly effects: Effects;
  private readonly lasers: Lasers;
  /** Dash streaks and reflected bullets (ADR-0036); the reflection's spark shares the flash budget. */
  private readonly trails = new TrailState(this.limiter);
  private readonly trailMeshes: TrailMeshes;
  private readonly rain: ReturnType<typeof createRain> | null;
  private readonly splashes: ReturnType<typeof createSplashes> | null;
  /** District colour script on screen, blending when the camera crosses a seam. */
  private readonly palette = new PaletteBlend(DISTRICT_PALETTES["shinsekai-7"]);
  private district: DistrictId | null = null;
  /** Jump to the next district's palette instead of blending (start, new game, load). */
  private snapPalette = true;
  private daylight = 0;
  private reduceFlashes = false;
  private flash: { x: number; y: number; z: number; life: number } | null = null;
  private scanning = false;
  private scanFocus: { id: EntityId; kind: HackTargetKind | undefined } | null = null;
  private readonly scanHighlight = new ScanHighlight();

  /** Builds the grade and the post-process (in that order: the scanner drains the graded colour), then the particles. */
  constructor(private readonly deps: ScreenFxDeps) {
    const { stage, camera } = deps;
    const { scene } = stage;
    const tier = qualityTier(stage.options.quality);
    this.grading = new Grading(scene, camera.camera, { reference: stage.options.reference }, this.limiter);
    // After the grading pipeline, so the scanner drains the graded colour.
    this.fxPost = new GameplayPost(scene, camera.camera);
    this.applyLook();
    this.effects = new Effects(scene, stage.glow);
    this.lasers = new Lasers(scene, stage.glow);
    this.trailMeshes = new TrailMeshes(scene, stage.glow);
    this.rain = stage.options.reference ? null : createRain(scene, deps.roofOver);
    this.splashes = stage.options.reference || !tier.splashes ? null : createSplashes(scene);
    if (!stage.options.reference) {
      // The manhole on the deptak and the vent behind the car wash (ADR-0045).
      const [manhole, vent] = STEAM_VENTS;
      if (manhole) createSteam(scene, new Vector3(manhole.x, manhole.y, manhole.z), new Color4(0.6, 0.74, 0.85, 0.3), 22);
      if (vent) createSteam(scene, new Vector3(vent.x, vent.y, vent.z), new Color4(0.8, 0.58, 0.64, 0.26), 14);
    }
  }

  private isCameraTarget(id: EntityId): boolean {
    return id === this.deps.cameraTarget();
  }

  play(effect: EffectDescriptor): void {
    const { camera, materials } = this.deps;
    switch (effect.kind) {
      case "muzzle-flash": {
        const own = this.isCameraTarget(effect.shooterId);
        const shooter = this.deps.actors.rigOf(effect.shooterId);
        if (shooter) raiseWeapon(shooter);
        const from = (own ? camera.muzzlePosition() : null) ?? v3(effect.from);
        this.effects.muzzleFlash(from, v3(effect.to));
        if (own) camera.kick();
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
        this.deps.speedLines.active = effect.active;
        if (this.rain) this.rain.system.updateSpeed = effect.active ? 1 / 200 : 1 / 60;
        return;
      case "heal":
        this.grading.pulse();
        return;
      case "laser":
        if (effect.duration <= 0) this.lasers.stop(effect.shooterId);
        else this.lasers.start(effect.shooterId, effect.targetId, effect.duration);
        return;
      case "time-of-day":
        // The app sends this only when the light level moves a step, so re-applying is cheap.
        this.daylight = effect.daylight;
        this.applyLook();
        materials.get("dressing").setFloat("selfLit", 1 - 0.5 * Math.max(0, Math.min(1, effect.daylight)));
        return;
      default:
        this.playActor(effect);
    }
  }

  /** Effects on one character: its rig animates, and the camera follows when it is the player. */
  private playActor(effect: ActorEffect): void {
    const camera = this.deps.camera;
    const rig = this.deps.actors.rigOf(effect.entityId);
    const own = this.isCameraTarget(effect.entityId);
    switch (effect.kind) {
      case "weapon":
        if (rig) setWeaponDrawn(rig, effect.drawn);
        if (own) camera.setWeaponDrawn(effect.drawn);
        return;
      case "talk":
        if (rig) this.deps.actors.talk(effect.entityId, effect.seconds);
        return;
      case "reload":
        if (rig) startReload(rig, effect.duration);
        if (own) camera.startReload(effect.duration);
        return;
      case "melee":
        if (rig) startSwing(rig, effect.strike, effect.windup, effect.recovery);
        if (own) camera.startSwing(effect.strike, effect.windup, effect.recovery);
        return;
      case "stagger":
        if (rig) startStagger(rig, effect.duration);
        if (own) camera.shake(0.8);
        return;
      case "block":
        this.effects.hitSpark(v3(effect.at), effect.parried);
        if (rig) rig.flinch = Math.max(rig.flinch, 0.4);
        if (own) camera.shake(effect.parried ? 0.15 : 0.35);
        return;
      case "flinch":
        if (rig) rig.flinch = 1;
        if (own) camera.shake(0.6);
        return;
    }
  }

  /**
   * Light rig of the time of day in the colours of the district on screen (ADR-0030): toon fog,
   * ambient and rim, the grade, the sky, the far city and the signs.
   */
  private applyLook(): void {
    const { materials, atmosphere, farCity, signage } = this.deps;
    const p = this.palette.value;
    const look = rigWithPalette(rigForDaylight(this.daylight), p, this.daylight);
    const scale = this.fogScale ?? this.deps.fogScale ?? 1;
    const rig = scale === 1 ? look : { ...look, fogDensity: look.fogDensity * scale };
    materials.setRig(rig);
    materials.setRimTint(p.rim, p.rimWeight * (1 - 0.5 * Math.max(0, Math.min(1, this.daylight))));
    atmosphere.setDaylight(rig, this.daylight);
    farCity.setDaylight(rig, this.daylight);
    signage.setDaylight(rig, this.daylight);
    this.grading.setPalette(p);
  }

  /** The district under the camera picks the palette; a seam crossing blends over a few seconds. */
  private updatePalette(dt: number): void {
    const cam = this.deps.camera.camera.position;
    const here = districtAt(cam.x, cam.z) ?? this.district;
    if (here !== null && (here !== this.district || this.snapPalette)) {
      this.palette.retarget(DISTRICT_PALETTES[here], this.snapPalette);
      if (this.snapPalette) this.applyLook();
      this.district = here;
      this.snapPalette = false;
    }
    if (this.palette.update(dt)) this.applyLook();
  }

  private fogScale: number | null = null;

  /** Multiplies the fog density from now on (the map preview's overview shots, ADR-0044). */
  setFogScale(scale: number): void {
    this.fogScale = scale;
    this.applyLook();
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
    this.deps.signage.setReduceFlashes(on);
    this.deps.farCity.setReduceFlashes(on);
    this.deps.atmosphere.reduceFlicker = on;
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
      case "dash":
        this.trails.dash(e.entityId, e.at);
        if (!this.isCameraTarget(e.entityId)) return;
        this.fx.dash(e.air);
        this.deps.speedLines.pulse(this.reduceFlashes ? 0.5 : 1);
        return;
      case "reflect":
        this.reflect(e.defenderId, e.at, e.to);
        return;
    }
  }

  /** Spark on the blade, a trail to where the bullet went, and the street lit only within the flash budget. */
  private reflect(defenderId: EntityId, at: Vec3, to: Vec3): void {
    this.effects.hitSpark(v3(at), true);
    if (this.trails.reflect(at, to, this.reduceFlashes)) this.flash = { x: at.x, y: at.y, z: at.z, life: 0.05 };
    if (this.isCameraTarget(defenderId)) this.deps.camera.shake(0.2);
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
    this.deps.scanTargets((id, own, meshesOf) => {
      const focused = this.scanFocus?.id === id;
      const cls = focused ? scanClassOfTarget(this.scanFocus?.kind, own) : own;
      if (!cls) return;
      const meshes = meshesOf();
      this.scanHighlight.mark(meshes, cls, focused, strength);
      for (const m of meshes) keep.add(m);
    });
    this.scanHighlight.release(keep);
  }

  /** Under a roof (the metro car, ADR-0036): no rain or splashes in front of the camera. */
  setIndoor(on: boolean): void {
    for (const p of [this.rain, this.splashes]) {
      if (!p) continue;
      if (on) p.system.stop();
      else p.system.start();
    }
  }

  /** Starts a frame: the flash budget moves on before anything asks it. */
  beginFrame(dt: number): void {
    this.limiter.advance(dt);
  }

  /** After the camera has moved: VFX, muzzle light, atmosphere, palette, post-process, grade, rain. */
  update(dt: number): void {
    const { stage, camera, materials } = this.deps;
    const reference = stage.options.reference;
    this.effects.update(dt);
    this.lasers.update(dt, (id) => this.deps.actors.transformOf(id));
    this.trails.update(dt, (id) => this.deps.actors.transformOf(id)?.position ?? null);
    this.trailMeshes.update(this.trails.trails);
    if (this.flash) {
      this.flash.life -= dt;
      const intensity = Math.max(0, Math.min(1, this.flash.life / 0.07));
      materials.setFlash(this.flash.x, this.flash.y, this.flash.z, intensity);
      if (this.flash.life <= 0) this.flash = null;
    }
    this.deps.atmosphere.update(dt, reference);
    this.deps.farCity.update(dt, camera.camera.position, reference);
    this.deps.signage.update(dt, reference);
    this.updatePalette(dt);
    this.fx.update(dt);
    this.fxPost.update(this.fx.uniforms, this.fx.active);
    this.updateScanHighlight();
    this.grading.update(dt);
    this.deps.speedLines.update(dt);
    this.rain?.follow(camera.camera.position);
    const target = this.deps.cameraTarget();
    const feet = (target === null ? null : this.deps.actors.transformOf(target)?.position.y) ?? camera.camera.position.y - 1.6;
    this.splashes?.follow(camera.camera.position, feet);
  }

  /** A new game or a load lands anywhere: lasers off, the next district's colours at once, no heat. */
  clear(): void {
    this.lasers.clear();
    this.trails.clear();
    this.snapPalette = true;
    this.scanHighlight.release();
    this.fx.setHeat(0, false);
  }
}
