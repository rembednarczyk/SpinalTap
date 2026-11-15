import { type AbstractMesh, type Camera, Color4, Constants, RenderTargetTexture, type Scene, ShaderMaterial } from "../babylon";
import { SHADOW_DEPTH_FRAGMENT, SHADOW_DEPTH_VERTEX } from "./toon-shader";

/**
 * Frames the square must stay put before the statics are kept. Walking moves it nearly every
 * frame (a texel is 6 to 27 mm): there every caster goes into one map as before, and the moving
 * ones get their own pass only once the player stands (aims, talks, looks round).
 */
export const SETTLE_FRAMES = 3;

/**
 * The moon shadow's two depth maps (plan 14.11, step 6). Receivers take the nearer of the two,
 * which is what one map with every caster holds. While the square moves, `statics` gets every
 * caster each frame and `moving` stays clear. Once it has stood `SETTLE_FRAMES`, `statics` is drawn
 * once with the static casters alone (the merged proxy and the fixed meshes) and kept; only
 * `moving` (characters, cars) redraws each frame. A static caster built, released, shown or hidden,
 * or a moved square, draws the statics again.
 */
export class ShadowMaps {
  readonly statics: RenderTargetTexture;
  readonly moving: RenderTargetTexture;
  private readonly depthMaterial: ShaderMaterial;
  private readonly casters: AbstractMesh[] = [];
  private readonly fixed: AbstractMesh[] = [];
  private proxy: AbstractMesh | null = null;
  private split = false;
  private still = 0;
  /** Kept statics not drawn since they were laid out or changed: the next frame draws them. */
  private pending = false;

  constructor(scene: Scene, size: number, camera: Camera) {
    this.statics = depthMap("moon-shadow", scene, size, camera);
    this.moving = depthMap("moon-shadow-moving", scene, size, camera);
    // One depth buffer for both: each pass clears it, and they never draw at once.
    if (this.statics.renderTarget && this.moving.renderTarget) this.statics.renderTarget.shareDepth(this.moving.renderTarget);
    this.depthMaterial = new ShaderMaterial(
      "moon-shadow-depth",
      scene,
      { vertexSource: SHADOW_DEPTH_VERTEX, fragmentSource: SHADOW_DEPTH_FRAGMENT },
      { attributes: ["position"], uniforms: ["world", "viewProjection"] },
    );
    // The moving map starts clear: drawn once with nothing in it.
    this.moving.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    this.statics.onAfterRenderObservable.add(() => (this.pending = false));
    scene.customRenderTargets.push(this.statics, this.moving);
  }

  addMoving(mesh: AbstractMesh): void {
    this.casters.push(mesh);
    this.statics.setMaterialForRendering(mesh, this.depthMaterial);
    this.moving.setMaterialForRendering(mesh, this.depthMaterial);
    this.fill();
  }

  removeMoving(mesh: AbstractMesh): void {
    const i = this.casters.indexOf(mesh);
    if (i >= 0) this.casters.splice(i, 1);
    this.fill();
  }

  /** The merged static casters changed (or are gone): kept statics are drawn again. */
  setProxy(mesh: AbstractMesh | null): void {
    this.proxy = mesh;
    if (mesh) this.statics.setMaterialForRendering(mesh, this.depthMaterial);
    this.staticsChanged();
  }

  /** A never-moving mesh drawn as itself among the statics; shown or hidden, the statics redraw. */
  addFixed(mesh: AbstractMesh): void {
    if (this.fixed.includes(mesh)) return;
    this.fixed.push(mesh);
    this.statics.setMaterialForRendering(mesh, this.depthMaterial);
    const shown = mesh.onEnabledStateChangedObservable.add(() => this.staticsChanged(false));
    mesh.onDisposeObservable.addOnce(() => {
      mesh.onEnabledStateChangedObservable.remove(shown);
      const i = this.fixed.indexOf(mesh);
      if (i >= 0) this.fixed.splice(i, 1);
      this.staticsChanged();
    });
    this.staticsChanged();
  }

  /** One frame: `moved` when the light matrix changed since the last one. */
  frame(moved: boolean): void {
    if (moved) {
      this.still = 0;
      if (this.split) this.layout(false);
    } else if (!this.split && ++this.still >= SETTLE_FRAMES) this.layout(true);
  }

  /** Meshes the shadow draws per frame: the kept statics are not among them. */
  get passMeshes(): number {
    return this.casters.length + (this.split ? 0 : this.fixed.length + (this.proxy ? 1 : 0));
  }

  /** Statics kept between frames (only the moving casters redraw). */
  get kept(): boolean {
    return this.split;
  }

  /**
   * The statics are kept and drawn: every frame on costs what this one did while the square stands.
   * Not while it settles (every caster in one map) nor on the frame the kept statics are drawn
   * again, `passMeshes` more calls than the frames after.
   */
  get settled(): boolean {
    return this.split && !this.pending;
  }

  private layout(split: boolean): void {
    this.split = split;
    this.pending = split;
    this.fill();
    // Merged: every caster each frame, the moving map cleared once. Split: statics once, then kept.
    this.statics.refreshRate = split ? RenderTargetTexture.REFRESHRATE_RENDER_ONCE : RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
    this.moving.refreshRate = split ? RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME : RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  }

  /** Kept statics are drawn again on the next frame (the lists change only with `refill`). */
  private staticsChanged(refill = true): void {
    if (refill) this.fill();
    if (!this.split) return;
    this.statics.resetRefreshCounter();
    this.pending = true;
  }

  private fill(): void {
    const statics = (this.proxy ? [this.proxy] : []).concat(this.fixed);
    this.statics.renderList = this.split ? statics : statics.concat(this.casters);
    this.moving.renderList = this.split ? this.casters.slice() : [];
  }
}

/** Nearest-sampled light depth in one float channel, cleared to the far plane. */
const depthMap = (name: string, scene: Scene, size: number, camera: Camera): RenderTargetTexture => {
  const caps = scene.getEngine().getCaps();
  const t = new RenderTargetTexture(name, size, scene, {
    generateMipMaps: false,
    type: caps.textureFloatRender ? Constants.TEXTURETYPE_FLOAT : Constants.TEXTURETYPE_HALF_FLOAT,
    format: Constants.TEXTUREFORMAT_R,
    samplingMode: Constants.TEXTURE_NEAREST_SAMPLINGMODE,
    generateDepthBuffer: true,
  });
  t.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE;
  t.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
  t.clearColor = new Color4(1, 1, 1, 1);
  t.renderList = [];
  t.enableOutlineRendering = false;
  t.renderParticles = false;
  t.renderSprites = false;
  t.activeCamera = camera;
  return t;
};
