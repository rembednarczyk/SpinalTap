import { Matrix, MeshBuilder } from "../babylon";
import type { AppearanceDescriptor, CameraMode, DespawnReason, EffectDescriptor, EntityId, HackTargetKind, RenderPort, Transform, ViewDescriptor } from "@seki/core";
import type { DistrictId } from "@seki/sim";
import { CameraRig } from "../camera/camera-rig";
import type { Grading } from "../npr/grading";
import { LineArt } from "../npr/line-art";
import { SpeedLines } from "../npr/speed-lines";
import { NIGHT_RIG } from "../npr/lighting";
import { MoonShadow } from "../npr/moon-shadow";
import { ToonMaterials } from "../npr/toon-material";
import { Atmosphere } from "./atmosphere";
import { type CharacterDescriptor, CharacterViews } from "./character-views";
import { CityKitLoader } from "./city-kit-loader";
import { WorldDressing } from "./dressing";
import { FarCity } from "./far-city";
import type { CharacterModelManifest } from "./model-library";
import { PropViews } from "./prop-views";
import { type GameplayFxEvent, ScreenFx } from "./screen-fx";
import { Signage } from "./signage";
import type { Stage } from "./stage";
import type { WeaponManifest } from "./weapon-mount";

export type { GameplayFxEvent } from "./screen-fx";

export interface RendererOptions {
  /**
   * URL of the city kit (ADR-0022). Skinned blocks are drawn from it once it loads; until
   * then, and without it, they are plain boxes.
   */
  readonly cityKit?: string | null;
}

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
  private readonly props: PropViews;
  private readonly fx: ScreenFx;
  private readonly cityKit: CityKitLoader;
  private cameraTarget: EntityId | null = null;
  private resetting = false;

  /** Builds the scene pieces in a fixed order: post-processes and meshes render in creation order. */
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
    this.rig = new CameraRig(scene, this.materials, (m) => this.props.isBlocker(m));
    this.rig.onBodyVisibility = (visible) => {
      if (this.cameraTarget !== null) this.characters.setBodyVisible(this.cameraTarget, visible);
    };
    this.characters = new CharacterViews({ scene, materials: this.materials, shadow: this.shadow, camera: this.rig, cameraTarget: () => this.cameraTarget });
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
    this.cityKit = new CityKitLoader({ stage, materials: this.materials, shadow: this.shadow, dressing: this.dressing, blocks: () => this.props.blockViews() });
    this.props = new PropViews({ stage, materials: this.materials, shadow: this.shadow, atmosphere: this.atmosphere, dressing: this.dressing, cityKit: this.cityKit });
    this.warmUpMaterials();
    this.fx = new ScreenFx({
      stage,
      materials: this.materials,
      camera: this.rig,
      atmosphere: this.atmosphere,
      farCity: this.farCity,
      signage: this.signage,
      speedLines: this.speedLines,
      actors: this.characters,
      cameraTarget: () => this.cameraTarget,
      scanTargets: (visit) => {
        this.characters.scanTargets(visit);
        this.props.scanTargets(visit);
      },
    });
    this.grading = this.fx.grading;
    if (options.cityKit) this.cityKit.load(options.cityKit);
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

  /** Kit meshes built for skinned blocks (debug and tests). */
  get cityMeshes(): number {
    return this.cityKit.meshCount;
  }

  spawn(id: EntityId, view: ViewDescriptor, t: Transform): void {
    if (this.characters.has(id) || this.props.has(id)) this.despawn(id);
    if (isCharacter(view)) this.characters.spawn(id, view, t);
    else this.props.spawn(id, view, t);
  }

  updateTransform(id: EntityId, t: Transform): void {
    if (!this.props.move(id, t)) this.characters.move(id, t);
  }

  despawn(id: EntityId, reason: DespawnReason = "removed"): void {
    // Enemies fall over before disappearing; a reset (load, new game) or a chunk streaming
    // out clears them at once.
    if (this.characters.has(id)) this.characters.despawn(id, !this.resetting && reason === "removed" && id !== this.cameraTarget);
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
    if (effect.kind === "time-of-day") this.cityKit.setDaylight(effect.daylight);
  }

  /** District whose colours are on screen (debug and tests). */
  get paletteDistrict(): DistrictId | null {
    return this.fx.paletteDistrict;
  }

  /** Accessibility (ADR-0028): no aberration, glitch or flicker anywhere; slow fades only. */
  setReduceFlashes(on: boolean): void {
    this.fx.setReduceFlashes(on);
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
    if (this.dressing.flush()) this.farCity.setResident(this.dressing.residentChunks());
    this.characters.update(dt);
    const target = this.cameraTargetTransform;
    this.rig.update(target, dt);
    // Shadow follows what the camera looks at: the player, or the fixed reference view.
    const focus = target ? target.position : this.rig.camera.position;
    const moved = this.shadow.update(focus);
    this.materials.setLightFocus(this.rig.camera.position.x, this.rig.camera.position.z);
    if (moved) this.materials.setShadowMatrix(moved);
    this.fx.update(dt);
  }

  clear(): void {
    this.fx.clear();
    this.resetting = true;
    for (const id of this.props.ids()) this.despawn(id);
    this.characters.clear();
    this.resetting = false;
  }

  /**
   * Weapon models (glTF) that replace the placeholder box pistols in hands, holsters, the FPP
   * viewmodel and the hands of imported characters. Characters on screen are re-armed.
   */
  setWeaponModels(manifest: WeaponManifest): void {
    this.characters.setWeaponModels(manifest);
  }

  /** What a character wears and carries (ADR-0015): weapons in hand, holster and on the back, garment add-ons. */
  setAppearance(id: EntityId, appearance: AppearanceDescriptor): void {
    this.characters.setAppearance(id, appearance);
  }

  /** Imported character models (models/manifest.json); characters on screen are dressed too. */
  setCharacterModels(manifest: CharacterModelManifest): void {
    this.characters.setCharacterModels(manifest);
  }

  get dressedCount(): number {
    return this.characters.dressedCount;
  }

  /** Interpolated transform of the entity the camera follows (the player), if any. */
  get cameraTargetTransform(): Transform | null {
    return this.cameraTarget === null ? null : this.characters.transformOf(this.cameraTarget);
  }

  get entityCount(): number {
    return this.characters.size + this.props.size;
  }
}
