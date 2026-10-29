import { type AbstractMesh, Matrix, MeshBuilder } from "../babylon";
import type { ActivityId, AppearanceDescriptor, CameraMode, DespawnReason, EffectDescriptor, EntityId, HackTargetKind, RenderPort, Transform, ViewDescriptor } from "@seki/core";
import type { ChunkDef, DistrictId } from "@seki/sim";
import { WORLD_CHUNKS } from "@seki/sim";
import { CameraRig } from "../camera/camera-rig";
import type { Grading } from "../npr/grading";
import { LineArt } from "../npr/line-art";
import { SpeedLines } from "../npr/speed-lines";
import { NIGHT_RIG } from "../npr/lighting";
import { MoonShadow } from "../npr/moon-shadow";
import { WET_PRESETS, qualityTier } from "../npr/quality";
import { ToonMaterials } from "../npr/toon-material";
import { Atmosphere } from "./atmosphere";
import { CharacterActivities } from "./character-activities";
import { type CharacterDescriptor, CharacterViews } from "./character-views";
import { CityKitLoader } from "./city-kit-loader";
import { CrowdViews } from "./crowd-views";
import { WorldDressing } from "./dressing";
import { FarCity } from "./far-city";
import { MapCity, type MapCityStats, isMapView } from "./mapcity/map-city";
import { MetroRide, type MetroRideView, type RideCast } from "./metro-ride";
import { VehicleViews } from "./vehicle-views";
import type { CharacterModelManifest } from "./model-library";
import { PropViews } from "./prop-views";
import { type GameplayFxEvent, ScreenFx } from "./screen-fx";
import { Signage } from "./signage";
import { WetProbe } from "./wet-probe";
import { groundLift } from "./ground-lift";
import type { Stage } from "./stage";
import type { WeaponManifest } from "./weapon-mount";

export type { GameplayFxEvent } from "./screen-fx";
export type { MetroRideView } from "./metro-ride";

export interface RendererOptions {
  /**
   * URL of the city kit (ADR-0022). Skinned blocks are drawn from it once it loads; until
   * then, and without it, they are plain boxes.
   */
  readonly cityKit?: string | null;
  /**
   * The game's chunk table for the dressing, the far city and the street signage (default
   * `WORLD_CHUNKS`); the map preview passes none, so only the city from map data is drawn.
   */
  readonly world?: readonly ChunkDef[];
  /** Multiplies the fog density (1 in the game; the map preview sees further, ADR-0044). */
  readonly fogScale?: number;
  /**
   * Draws the far city of the old map (stand-ins, tower rings, megabuildings on the horizon).
   * Off in Lublin (ADR-0045): the map's own city is drawn to the horizon.
   */
  readonly farCity?: boolean;
}

/** How far the crowd is drawn per quality (m): phones see the nearest residents only. */
const CROWD_DRAW_DISTANCE = { high: 90, medium: 70, low: 40 } as const;

const isCharacter = (view: ViewDescriptor): view is CharacterDescriptor => view.kind === "heroine" || view.kind === "npc" || view.kind === "enemy";

/**
 * RenderPort over Babylon.js (ADR-0031): a facade that owns the camera and the frame, and hands
 * characters to `CharacterViews`, props to `PropViews`, effects and the look to `ScreenFx`, and
 * the city kit to `CityKitLoader`.
 */
export class BabylonRenderer implements RenderPort {
  readonly materials: ToonMaterials;
  readonly rig: CameraRig;
  readonly grading: Grading;
  readonly shadow: MoonShadow;
  readonly lineArt: LineArt | null;
  readonly atmosphere: Atmosphere;
  readonly speedLines: SpeedLines;
  /** Procedural dressing of every streamed-in chunk (ADR-0027). */
  readonly dressing: WorldDressing;
  /** Stand-ins, tower rings and megabuildings beyond the streets (ADR-0027). */
  readonly farCity: FarCity;
  /** Signs, holo-ads and their street reflections, one draw call (ADR-0030). */
  readonly signage: Signage;
  private readonly characters: CharacterViews;
  /** What the characters do where they stand (ADR-0040). */
  private readonly activities: CharacterActivities;
  private readonly props: PropViews;
  /** The residents of the city, drawn in bulk (ADR-0041). */
  private readonly crowd: CrowdViews;
  /** The street's traffic and parked cars on the city kit (ADR-0050). */
  private readonly vehicles: VehicleViews;
  private readonly fx: ScreenFx;
  private readonly cityKit: CityKitLoader;
  /** The metro car between districts (ADR-0036). */
  private readonly metro: MetroRide;
  /** Static reflection probe of the wet asphalt on medium and high quality (ADR-0036). */
  private readonly wet: WetProbe | null;
  /** Buildings, terrain and ground from map data (ADR-0044), created with the first of them. */
  private mapCity: MapCity | null = null;
  /** Feet lift on the map's surfaces (ADR-0045), or on the old street's sidewalks without map data. */
  private readonly liftAt = (x: number, y: number, z: number): number => (this.mapCity ? this.mapCity.surfaceLift(x, y, z) : groundLift(x, y, z));
  private daylight = 0;
  private reduceFlashes = false;
  private kitMeshes = 0;
  private cameraTarget: EntityId | null = null;
  private resetting = false;

  /** Builds the scene pieces in a fixed order: post-processes and meshes render in creation order. */
  constructor(
    private readonly stage: Stage,
    options: RendererOptions = {},
  ) {
    const { scene } = stage;
    this.materials = new ToonMaterials(scene);
    const tier = qualityTier(stage.options.quality);
    const high = tier.shadowMap > 1024;
    // Before any material: the wet presets compile with the probe in them.
    this.wet = tier.wetProbe ? new WetProbe(scene, tier.wetProbe, () => this.reflectedMeshes()) : null;
    if (this.wet) this.materials.setEnvironment(this.wet.texture, WET_PRESETS);
    this.shadow = new MoonShadow(scene, NIGHT_RIG, 28, tier.shadowMap);
    this.materials.setShadow({
      texture: this.shadow.texture,
      matrix: this.shadow.update({ x: 0, y: 0, z: 0 }) ?? Matrix.Identity(),
      texelSize: this.shadow.texelSize,
      bias: high ? 0.0012 : 0.002,
      strength: 0.9,
    });
    this.rig = new CameraRig(scene, this.materials, (m) => this.props.isBlocker(m));
    this.rig.onBodyVisibility = (visible) => {
      if (this.cameraTarget !== null) this.characters.setBodyVisible(this.cameraTarget, visible);
    };
    this.activities = new CharacterActivities(scene, this.materials, () => this.rig.camera.position);
    this.characters = new CharacterViews({
      scene,
      materials: this.materials,
      shadow: this.shadow,
      camera: this.rig,
      cameraTarget: () => this.cameraTarget,
      pose: (id, rig, speed, dt, retarget) => this.activities.apply(id, rig, speed, dt, retarget),
      lift: this.liftAt,
    });
    const eye = this.rig.camera.position;
    this.crowd = new CrowdViews({ scene, materials: this.materials, eye: () => eye, drawDistance: CROWD_DRAW_DISTANCE[stage.options.quality ?? "high"], lift: this.liftAt });
    // Line art must be attached before the grading pipeline so the ink gets graded too.
    this.lineArt = tier.lineArt ? new LineArt(scene, this.rig.camera) : null;
    if (this.lineArt) this.lineArt.geometryBuffer.renderTransparentMeshes = false;
    this.speedLines = new SpeedLines(scene, this.rig.camera);
    this.atmosphere = new Atmosphere(scene, NIGHT_RIG);
    const world = options.world ?? WORLD_CHUNKS;
    this.farCity = new FarCity(scene, NIGHT_RIG, options.farCity === false ? [] : world);
    if (options.farCity === false) for (const m of this.farCity.meshes) m.setEnabled(false);
    this.signage = new Signage(scene, world);
    // Without a kit the dressing goes in with the first chunk; with one, once it is known whether it loaded.
    this.dressing = new WorldDressing(scene, this.materials, options.cityKit ? "pending" : "bare", { built: (m) => this.shadow.addStaticCaster(m) }, world);
    this.cityKit = new CityKitLoader({ stage, materials: this.materials, shadow: this.shadow, dressing: this.dressing, blocks: () => this.props.blockViews() });
    this.props = new PropViews({
      stage,
      materials: this.materials,
      shadow: this.shadow,
      atmosphere: this.atmosphere,
      dressing: this.dressing,
      cityKit: this.cityKit,
      groundAt: (x, z) => this.mapCity?.heightAt(x, z) ?? null,
    });
    this.vehicles = new VehicleViews({ scene, kit: () => this.cityKit.kit, glow: stage.glow, eye: () => eye, quality: stage.options.quality ?? "high" });
    this.warmUpMaterials();
    this.fx = new ScreenFx({
      stage,
      materials: this.materials,
      camera: this.rig,
      atmosphere: this.atmosphere,
      farCity: this.farCity,
      signage: this.signage,
      speedLines: this.speedLines,
      fogScale: options.fogScale ?? 1,
      roofOver: (x, y, z) => this.mapCity?.roofOver(x, y, z) ?? false,
      actors: this.characters,
      cameraTarget: () => this.cameraTarget,
      scanTargets: (visit) => {
        this.characters.scanTargets(visit);
        this.props.scanTargets(visit);
      },
    });
    this.grading = this.fx.grading;
    this.metro = new MetroRide({ scene, materials: this.materials, shadow: this.shadow, camera: this.rig, cast: this.rideCast() });
    if (options.cityKit) this.cityKit.load(options.cityKit);
  }

  /** The metro's riders are characters like any other, with their activities (ADR-0040). */
  private rideCast(): RideCast {
    const { characters, activities } = this;
    return {
      spawn: (id, view, t) => characters.spawn(id, view, t),
      setAppearance: (id, look) => characters.setAppearance(id, look),
      setActivity: (id, activity) => activities.set(id, activity, { seat: "scene" }),
      despawn: (id, fall) => {
        activities.forget(id);
        characters.despawn(id, fall);
      },
    };
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

  /** What the wet-asphalt probe mirrors: the sky, the far city, the signs and everything that glows. */
  private reflectedMeshes(): AbstractMesh[] {
    const glowing = this.stage.scene.meshes.filter((m) => m.isEnabled() && m.isVisible && this.stage.glow.hasMesh(m) && !m.name.startsWith("metro-"));
    const fixed = [this.atmosphere.skyMesh, this.signage.mesh, ...this.farCity.meshes].filter((m): m is NonNullable<typeof m> => m !== null);
    return [...new Set<AbstractMesh>([...fixed, ...glowing])];
  }

  /** Renders of the wet-asphalt probe so far, null without one (debug and tests). */
  get wetProbeRenders(): number | null {
    return this.wet?.renderCount ?? null;
  }

  /** Kit meshes built for skinned blocks (debug and tests). */
  get cityMeshes(): number {
    return this.cityKit.meshCount;
  }

  /** The map city, made on first use so scenes without map data stay exactly as they were. */
  private city(): MapCity {
    if (!this.mapCity) {
      this.mapCity = new MapCity({ scene: this.stage.scene, materials: this.materials, shadow: this.shadow, quality: this.stage.options.quality ?? "high" });
      this.mapCity.setDaylight(this.daylight);
      this.mapCity.setReduceFlashes(this.reduceFlashes);
    }
    return this.mapCity;
  }

  /** Multiplies the fog density (1 in the game; the map preview sees further, ADR-0044). */
  setFogScale(scale: number): void {
    this.fx.setFogScale(scale);
  }

  /** Terrain height of the map city at (x, z), null outside its terrain (preview camera, tests). */
  mapHeightAt(x: number, z: number): number | null {
    return this.mapCity?.heightAt(x, z) ?? null;
  }

  /** What the map city holds and draws (debug and tests); null before the first map view. */
  get mapStats(): MapCityStats | null {
    return this.mapCity?.stats ?? null;
  }

  spawn(id: EntityId, view: ViewDescriptor, t: Transform): void {
    if (this.characters.has(id) || this.props.has(id) || this.crowd.has(id) || this.vehicles.has(id) || this.mapCity?.has(id)) this.despawn(id);
    if (isMapView(view)) this.city().spawn(id, view, t.position);
    else if (isCharacter(view)) this.characters.spawn(id, view, t);
    else if (view.kind === "crowd") this.crowd.spawn(id, view, t);
    else if (view.kind === "vehicle") this.vehicles.spawn(id, view, t);
    else this.props.spawn(id, view, t);
  }

  updateTransform(id: EntityId, t: Transform): void {
    if (!this.props.move(id, t) && !this.characters.move(id, t) && !this.vehicles.move(id, t)) this.crowd.move(id, t);
  }

  despawn(id: EntityId, reason: DespawnReason = "removed"): void {
    // Enemies fall over before disappearing; a reset (load, new game) or a chunk streaming
    // out clears them at once.
    // Held things leave first: they may sit in the hand of a model that goes back to its pool.
    this.activities.forget(id);
    if (this.mapCity?.has(id)) this.mapCity.despawn(id);
    else if (this.characters.has(id)) this.characters.despawn(id, !this.resetting && reason === "removed" && id !== this.cameraTarget);
    else if (this.crowd.has(id)) this.crowd.despawn(id);
    else if (this.vehicles.has(id)) this.vehicles.despawn(id);
    else this.props.despawn(id);
  }

  setCameraMode(mode: CameraMode): void {
    this.rig.setMode(mode);
  }

  attachCamera(id: EntityId): void {
    this.cameraTarget = id;
    this.rig.setHeldWeapon(this.characters.heldOf(id));
  }

  playEffect(effect: EffectDescriptor): void {
    this.fx.play(effect);
    if (effect.kind === "time-of-day") {
      this.daylight = effect.daylight;
      this.mapCity?.setDaylight(effect.daylight);
      this.cityKit.setDaylight(effect.daylight);
      this.wet?.schedule.invalidate();
    }
  }

  /** District whose colours are on screen (debug and tests). */
  get paletteDistrict(): DistrictId | null {
    return this.fx.paletteDistrict;
  }

  /** Accessibility (ADR-0028): no aberration, glitch or flicker anywhere; slow fades only. */
  setReduceFlashes(on: boolean): void {
    this.fx.setReduceFlashes(on);
    this.metro.setCalm(on);
    this.reduceFlashes = on;
    this.mapCity?.setReduceFlashes(on);
  }

  /**
   * A metro ride (ADR-0036; proposed as an optional `RenderPort` method): the inside of a car with
   * the city sliding past and a few riders, from `MetroDeparted` until null on `MetroArrived`.
   * The world keeps streaming behind it.
   */
  setMetroRide(ride: MetroRideView | null): void {
    this.metro.set(ride);
    this.fx.setIndoor(ride !== null);
  }

  /** True while the metro car is on screen (debug, tests). */
  get metroRiding(): boolean {
    return this.metro.active;
  }

  /** A gameplay moment over the whole frame (ADR-0030): a hit, a quickhack, heat. */
  gameplayFx(e: GameplayFxEvent): void {
    this.fx.gameplayFx(e);
  }

  /** The scanner is held: scanlines and drained colour, targets outlined by kind. */
  setScanning(on: boolean): void {
    this.fx.setScanning(on);
  }

  /** What the scanner focuses (ScanFocusChanged): filled and outlined; cameras and devices in yellow. */
  setScanFocus(id: EntityId | null, kind?: HackTargetKind): void {
    this.fx.setScanFocus(id, kind);
  }

  /** Per-frame presentation update: animation, camera, VFX, rain. Call before scene.render(). */
  frame(dt: number): void {
    this.fx.beginFrame(dt);
    this.cityKit.flush();
    this.props.flush();
    if (this.dressing.flush()) {
      this.farCity.setResident(this.dressing.residentChunks());
      this.wet?.schedule.invalidate();
    }
    if (this.mapCity?.flush()) this.wet?.schedule.invalidate();
    this.metro.update(dt);
    this.characters.update(dt);
    this.crowd.update(dt);
    this.vehicles.update();
    const target = this.cameraTargetTransform;
    this.rig.update(target, dt);
    this.metro.afterCamera();
    this.mapCity?.update(dt, this.rig.camera.position, this.stage.options.reference);
    // Shadow follows what the camera looks at: the player, the metro car or the fixed reference view.
    const focus = target && !this.metro.active ? target.position : this.rig.camera.position;
    const moved = this.shadow.update(focus);
    this.materials.setLightFocus(this.rig.camera.position.x, this.rig.camera.position.z);
    if (moved) this.materials.setShadowMatrix(moved);
    this.fx.update(dt);
    this.updateWetProbe(dt);
  }

  /** Re-renders the probe on a new district or when what it mirrors changed; never in the metro. */
  private updateWetProbe(dt: number): void {
    const wet = this.wet;
    if (!wet || this.metro.active) return;
    if (this.cityKit.meshCount !== this.kitMeshes) {
      this.kitMeshes = this.cityKit.meshCount;
      wet.schedule.invalidate();
    }
    wet.schedule.setDistrict(this.fx.paletteDistrict);
    wet.update(dt, this.rig.camera.position);
  }

  clear(): void {
    this.setMetroRide(null);
    this.fx.clear();
    this.resetting = true;
    for (const id of this.props.ids()) this.despawn(id);
    for (const id of this.mapCity?.ids() ?? []) this.despawn(id);
    this.activities.clear();
    this.characters.clear();
    this.crowd.clear();
    this.vehicles.clear();
    this.resetting = false;
  }

  /**
   * Weapon models (glTF) that replace the placeholder box pistols in hands, holsters, the FPP
   * viewmodel and the hands of imported characters. Characters on screen are re-armed.
   */
  setWeaponModels(manifest: WeaponManifest): void {
    this.characters.setWeaponModels(manifest);
  }

  /** What the character does where it stands (ADR-0040); null returns it to walking and idling. */
  setActivity(id: EntityId, activity: ActivityId | null): void {
    if (this.characters.has(id)) this.activities.set(id, activity);
    else this.crowd.setActivity(id, activity);
  }

  /** Activity a character plays now (debug and tests). */
  activityOf(id: EntityId): ActivityId | null {
    return this.activities.activityOf(id);
  }

  /** What a character wears and carries (ADR-0015): weapons in hand, holster and on the back, garment add-ons. */
  setAppearance(id: EntityId, appearance: AppearanceDescriptor): void {
    this.characters.setAppearance(id, appearance);
  }

  /** Imported character models (models/manifest.json); characters on screen are dressed too. */
  setCharacterModels(manifest: CharacterModelManifest): void {
    this.characters.setCharacterModels(manifest);
  }

  /** Residents in the world and how many of them were drawn last frame (debug and tests). */
  get crowdStats(): { readonly residents: number; readonly drawn: number } {
    return { residents: this.crowd.size, drawn: this.crowd.drawn };
  }

  /** The street's vehicles: driving, drawn near and far, parked, and their meshes (debug and tests). */
  get vehicleStats(): VehicleViews["stats"] {
    return this.vehicles.stats;
  }

  get dressedCount(): number {
    return this.characters.dressedCount;
  }

  /** The map city has drawn every cell near the camera in detail (tests wait for it before a snapshot). */
  get citySettled(): boolean {
    return this.mapCity?.settled ?? true;
  }

  /**
   * Draws one frame and reads it straight from the canvas as a PNG data URL (ADR-0046): the
   * snapshot test compares these pixels instead of waiting for the browser's compositor, which
   * under SwiftShader may not settle within a test's patience.
   */
  captureFrame(): string {
    this.stage.scene.render();
    return this.stage.engine.getRenderingCanvas()?.toDataURL("image/png") ?? "";
  }

  /** Character models still loading. */
  get modelsLoading(): number {
    return this.characters.loadingCount;
  }

  /** Interpolated transform of the entity the camera follows (the player), if any. */
  get cameraTargetTransform(): Transform | null {
    return this.cameraTarget === null ? null : this.characters.transformOf(this.cameraTarget);
  }

  get entityCount(): number {
    return this.characters.size + this.props.size + this.crowd.size + this.vehicles.size + (this.mapCity?.size ?? 0);
  }
}
