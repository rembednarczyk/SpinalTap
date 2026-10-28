import { type AppearanceDescriptor, type GarmentMeshId, type WeaponLook, type WeaponSlot, sameAppearance } from "@seki/core";
import { Color4, type Engine, EngineStore, FreeCamera, MeshBuilder, Scene, TransformNode, Vector3, Viewport } from "../babylon";
import type { LightingRig } from "../npr/lighting";
import { ToonMaterials } from "../npr/toon-material";
import { type CharacterRig, animateRig, buildHeroine } from "./characters";
import { Loadouts } from "./loadout";
import { type CharacterModelManifest, type ModelInstance, ModelLibrary } from "./model-library";
import { HumanoidRetarget } from "./model-rig";
import { qualityTier } from "../npr/quality";
import type { RenderQuality } from "./stage";
import { type WeaponManifest, WeaponMounts } from "./weapon-mount";

/** Where the preview goes, in CSS pixels of the page (as the UI measured its box). */
export interface PreviewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PreviewStageOptions {
  /** "low" draws only after a change (turn, new weapon, model loaded), not every frame. */
  readonly quality?: RenderQuality;
}

/** What the preview shows right now; for tests and the debug hook. */
export interface PreviewState {
  readonly visible: boolean;
  readonly yaw: number;
  /** Weapon in the hand. */
  readonly hand: WeaponLook | null;
  /** Stowed weapons by slot. */
  readonly stowed: Readonly<Partial<Record<WeaponSlot, WeaponLook>>>;
  /** Garment add-ons on the character (helmet, visor, vest plate). */
  readonly garments: readonly GarmentMeshId[];
  /** Garment add-ons hang on the imported model's bones (not the hidden rig's). */
  readonly garmentsOnModel: boolean;
  /** Model cloth meshes recoloured by a garment tint. */
  readonly tinted: number;
  /** Times the character was drawn. */
  readonly renders: number;
  /** The imported model is on. */
  readonly dressed: boolean;
}

/** Colour of the menu behind the preview (the screen around the box is see-through). */
export const PREVIEW_BACKGROUND = new Color4(7 / 255, 11 / 255, 16 / 255, 1);

/** Slightly turned towards the camera, as on a character sheet. */
export const PREVIEW_FRONT_YAW = -0.35;

/** A studio over the night palette: brighter key light, no fog, neon rims from behind. */
const STUDIO_RIG: LightingRig = {
  sunDir: { x: 0.35, y: 0.75, z: 0.55 },
  sunColor: "#8a96bd",
  ambient: "#4a4462",
  fogColor: "#070b10",
  fogDensity: 0,
  shadeTint: "#7d7ab2",
  fillColor: "#c9d3ea",
};

const SLOTS: readonly WeaponSlot[] = ["primary", "secondary", "melee"];

/** Name prefix of everything the preview mounts on its heroine. */
const NAME = "preview-seki";

/**
 * The 3D preview of the character menu (ADR-0015, plan §8.5): its own Scene on the game's
 * Engine and canvas, so there is no second WebGL context. It has its own toon materials
 * (materials belong to a scene), camera, light rig and one heroine: the imported model when
 * the manifest has one, the procedural rig otherwise. Weapons and garments go on her through
 * the world's `Loadouts`, so the menu shows what the street shows. While the menu is open the
 * app calls `render` instead of drawing the game: it clears the whole canvas to the menu
 * colour and draws the character into the rectangle.
 */
export class PreviewStage {
  private scene: Scene | null = null;
  private camera: FreeCamera | null = null;
  private turntable: TransformNode | null = null;
  private rig: CharacterRig | null = null;
  private library: ModelLibrary | null = null;
  private mounts: WeaponMounts | null = null;
  private loadouts: Loadouts | null = null;
  private dressed: { model: ModelInstance; retarget: HumanoidRetarget } | null = null;
  private dressing = false;
  private characters: CharacterModelManifest = {};
  private weaponModels: WeaponManifest = {};
  private appearance: AppearanceDescriptor | null = null;
  private rect: PreviewRect | null = null;
  private yaw = PREVIEW_FRONT_YAW;
  private dirty = true;
  private lastFrame = -2;
  private lastSize = "";
  private renders = 0;

  constructor(
    private readonly engine: Engine,
    private readonly canvas: HTMLCanvasElement,
    private readonly options: PreviewStageOptions = {},
  ) {}

  /** Imported models, the same manifests the world renderer got. */
  setModels(characters: CharacterModelManifest, weapons: WeaponManifest = this.weaponModels): void {
    this.characters = characters;
    const weaponsChanged = weapons !== this.weaponModels;
    this.weaponModels = weapons;
    this.mounts?.setManifest(weapons);
    if (this.rig && !this.dressed) this.dress();
    if (this.rig && weaponsChanged) {
      this.loadouts?.remountAll();
      this.dirty = true;
    }
  }

  setViewport(rect: PreviewRect | null): void {
    const r = this.rect;
    if (r === rect || (r && rect && r.x === rect.x && r.y === rect.y && r.width === rect.width && r.height === rect.height)) return;
    this.rect = rect;
    this.dirty = true;
  }

  setAppearance(appearance: AppearanceDescriptor): void {
    if (sameAppearance(this.appearance, appearance)) return;
    this.appearance = appearance;
    this.wear();
  }

  rotate(deltaYaw: number): void {
    if (deltaYaw === 0) return;
    this.yaw += deltaYaw;
    this.dirty = true;
  }

  reset(): void {
    this.yaw = PREVIEW_FRONT_YAW;
    this.dirty = true;
  }

  get state(): PreviewState {
    const w = this.appearance?.weapons ?? null;
    const stowed: Partial<Record<WeaponSlot, WeaponLook>> = {};
    if (w) for (const s of SLOTS) if (s !== w.active && w[s]) stowed[s] = w[s];
    const worn = this.rig && this.loadouts ? this.loadouts.attachments(this.rig) : [];
    return {
      visible: this.rect !== null,
      yaw: this.yaw,
      hand: w ? w[w.active] : null,
      stowed,
      garments: worn.map((a) => a.id),
      garmentsOnModel: worn.length > 0 && worn.every((a) => a.onModel),
      tinted: this.rig && this.loadouts ? this.loadouts.tinted(this.rig) : 0,
      renders: this.renders,
      dressed: this.dressed !== null,
    };
  }

  /**
   * One frame of the menu. On high quality the character breathes and is drawn every frame;
   * on low only after a change, or when something else (the game) drew the last frame or
   * the canvas was resized, since the canvas keeps its last picture.
   */
  render(dt: number): void {
    const frame = this.engine.frameId;
    if (frame !== this.lastFrame + 1) this.dirty = true;
    this.lastFrame = frame;
    const size = `${this.engine.getRenderWidth()}x${this.engine.getRenderHeight()}`;
    if (size !== this.lastSize) {
      this.lastSize = size;
      this.dirty = true;
    }
    const live = qualityTier(this.options.quality).livePreview;
    if (!this.dirty && !live) return;
    this.dirty = false;
    this.engine.clear(PREVIEW_BACKGROUND, true, true, true);
    const viewport = this.viewport();
    if (!viewport) return;
    const scene = this.ensureScene();
    const rig = this.rig!;
    this.turntable!.rotation.y = this.yaw;
    animateRig(rig, 0, live ? dt : 0);
    this.dressed?.retarget.update();
    this.loadouts?.update(rig);
    this.camera!.viewport = viewport;
    scene.render();
    this.renders += 1;
  }

  dispose(): void {
    this.scene?.dispose();
    this.scene = null;
  }

  /** The rectangle as a share of the canvas, bottom-left origin; null when off the canvas. */
  private viewport(): Viewport | null {
    const r = this.rect;
    if (!r) return null;
    const c = this.canvas.getBoundingClientRect();
    if (c.width <= 0 || c.height <= 0) return null;
    const x = Math.max(0, (r.x - c.left) / c.width);
    const y = Math.max(0, 1 - (r.y - c.top + r.height) / c.height);
    const w = Math.min(1 - x, r.width / c.width);
    const h = Math.min(1 - y, r.height / c.height);
    return w > 0 && h > 0 ? new Viewport(x, y, w, h) : null;
  }

  private ensureScene(): Scene {
    if (this.scene) return this.scene;
    // A new Scene becomes Babylon's "last created" one; the game's scene stays the default.
    const previous = EngineStore.LastCreatedScene;
    const scene = new Scene(this.engine);
    EngineStore._LastCreatedScene = previous;
    scene.detachControl();
    scene.autoClear = false;
    scene.autoClearDepthAndStencil = false;
    scene.skipPointerMovePicking = true;
    scene.clearColor = PREVIEW_BACKGROUND.clone();
    this.scene = scene;
    const materials = new ToonMaterials(scene, STUDIO_RIG);
    materials.addLight("rim-magenta", { position: { x: -1.6, y: 2.2, z: -1.4 }, color: "#ff3d8b", range: 6, intensity: 1.6 });
    materials.addLight("rim-cyan", { position: { x: 1.7, y: 1.4, z: -1.2 }, color: "#5ff2ff", range: 6, intensity: 1.3 });
    const camera = new FreeCamera("preview-camera", new Vector3(0, 1.0, 3.5), scene);
    camera.fov = 0.6;
    camera.minZ = 0.1;
    camera.maxZ = 30;
    camera.setTarget(new Vector3(0, 0.9, 0));
    scene.activeCamera = camera;
    this.camera = camera;
    // A dark disc with a cyan ring to stand on.
    const floor = MeshBuilder.CreateDisc("preview-floor", { radius: 0.5, tessellation: 40 }, scene);
    floor.rotation.x = Math.PI / 2;
    floor.material = materials.get("asphalt");
    const ring = MeshBuilder.CreateTorus("preview-ring", { diameter: 1.0, thickness: 0.012, tessellation: 48 }, scene);
    ring.position.y = 0.004;
    ring.material = materials.get("heroineVisor");
    this.turntable = new TransformNode("preview-turntable", scene);
    const rig = buildHeroine(scene, materials, NAME);
    rig.root.parent = this.turntable;
    rig.drawTarget = true;
    rig.drawn = 1;
    this.rig = rig;
    this.library = new ModelLibrary(scene, materials);
    this.mounts = new WeaponMounts(this.library, this.weaponModels);
    // A weapon model that loads later needs a new picture on low quality.
    this.loadouts = new Loadouts(scene, materials, this.mounts, () => {
      this.dirty = true;
    });
    this.dress();
    this.wear();
    return scene;
  }

  /** Puts the imported heroine over the rig once it loads; the rig animates it from inside. */
  private dress(): void {
    const spec = this.characters.heroine;
    const rig = this.rig;
    if (!spec || !rig || !this.library || this.dressing || this.dressed) return;
    this.dressing = true;
    this.library
      .instantiate(spec, `${NAME}-m`)
      .then((model) => {
        this.dressing = false;
        if (!this.scene || rig.root.isDisposed()) return model.dispose();
        const retarget = HumanoidRetarget.create(rig, model.root, model.prefix);
        if (!retarget) {
          console.warn(`[preview] ${spec.url}: no humanoid bones, keeping the procedural heroine`);
          return model.dispose();
        }
        for (const m of rig.meshes) m.setEnabled(false);
        this.dressed = { model, retarget };
        this.loadouts?.setModel(rig, { retarget, meshes: model.meshes });
        this.dirty = true;
      })
      .catch((err: unknown) => {
        this.dressing = false;
        console.warn(`[preview] ${spec.url} failed to load`, err);
      });
  }

  /** Weapons and garments of the appearance, through the same loadouts as the world. */
  private wear(): void {
    if (this.rig && this.loadouts && this.appearance) this.loadouts.set(this.rig, this.appearance, NAME);
    this.dirty = true;
  }
}
