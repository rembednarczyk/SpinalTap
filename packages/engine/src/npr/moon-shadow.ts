import {
  type AbstractMesh,
  type Camera,
  CameraClass,
  FreeCamera,
  type Matrix,
  MeshClass,
  type RenderTargetTexture,
  type Scene,
  Vector3,
  VertexBuffer,
  VertexData,
} from "../babylon";
import { halfTangents } from "./contact-shade";
import type { LightingRig } from "./lighting";
import { type ShadowView, nextExtent, viewReach } from "./shadow-fit";
import { ShadowMaps } from "./shadow-maps";

/** Layer only the moon camera sees: the merged static shadow proxy lives here. */
const SHADOW_ONLY_LAYER = 0x10000000;

/**
 * Hard moon shadow. An orthographic camera along the moon direction follows the focus point
 * (the player), snapped to whole shadow texels so edges do not crawl while walking. Static
 * casters are merged into one shadow-only proxy mesh; moving characters render as they are.
 * Given the view, the square shrinks to what the screen shows (a few fixed sizes, `shadow-fit`):
 * looking down at the player, one texel covers under a centimetre instead of nearly three.
 * While the square stands still the statics are drawn once and kept (`ShadowMaps`).
 */
export class MoonShadow {
  readonly texelSize: number;
  private readonly camera: FreeCamera;
  private readonly maps: ShadowMaps;
  private readonly dir: Vector3;
  private readonly right: Vector3;
  private readonly up: Vector3;
  private texelWorld: number;
  private extent: number;
  private readonly dynamic = new Set<AbstractMesh>();
  private readonly statics = new Set<AbstractMesh>();
  private staticProxy: MeshClass | null = null;
  private staticDirty = false;
  private lastSnap = "";

  constructor(
    private readonly scene: Scene,
    rig: LightingRig,
    private readonly halfExtent: number,
    private readonly size = 2048,
  ) {
    this.dir = new Vector3(rig.sunDir.x, rig.sunDir.y, rig.sunDir.z).normalize();
    const cam = new FreeCamera("moon-camera", this.dir.scale(90), scene, false);
    cam.mode = CameraClass.ORTHOGRAPHIC_CAMERA;
    cam.minZ = 1;
    cam.maxZ = 200;
    cam.layerMask = 0xffffffff;
    cam.setTarget(Vector3.Zero());
    cam.inputs.clear();
    this.camera = cam;
    this.maps = new ShadowMaps(scene, size, cam);
    this.right = cam.getDirection(Vector3.Right());
    this.up = cam.getDirection(Vector3.Up());
    this.texelSize = 1 / size;
    this.extent = halfExtent;
    this.texelWorld = 0;
    this.setExtent(halfExtent);
  }

  /** The static casters' depth (with every caster while the square moves). */
  get texture(): RenderTargetTexture {
    return this.maps.statics;
  }

  /** The moving casters' depth while the statics are kept; clear otherwise. */
  get movingTexture(): RenderTargetTexture {
    return this.maps.moving;
  }

  /** Moving caster (characters). Rendered every frame as is. */
  addCaster(mesh: AbstractMesh): void {
    if (this.dynamic.has(mesh)) return;
    this.dynamic.add(mesh);
    this.maps.addMoving(mesh);
    mesh.onDisposeObservable.addOnce(() => {
      this.dynamic.delete(mesh);
      this.maps.removeMoving(mesh);
    });
  }

  /** Never-moving caster (buildings, crates, poles). Merged into one proxy on the next update. */
  addStaticCaster(mesh: AbstractMesh): void {
    if (this.statics.has(mesh)) return;
    this.statics.add(mesh);
    this.staticDirty = true;
    mesh.onDisposeObservable.addOnce(() => {
      if (this.statics.delete(mesh)) this.staticDirty = true;
    });
  }

  /**
   * Never-moving caster drawn as itself, not merged: big meshes streamed in and out with the view
   * (the map's detailed buildings), which re-merging on every change would cost more than drawing.
   * Kept with the statics; shown, hidden or released, they are drawn again.
   */
  addFixedCaster(mesh: AbstractMesh): void {
    this.maps.addFixed(mesh);
  }

  /** A static caster changed shape: the merged proxy is rebuilt on the next update. */
  invalidateStatics(): void {
    this.staticDirty = true;
  }

  /**
   * Recentres the shadow on the focus point and, given the camera, fits its size to the view.
   * Returns the light matrix when it changed (the caller pushes it to the receiving materials),
   * otherwise null.
   */
  update(focus: { x: number; y: number; z: number }, view?: Camera): Matrix | null {
    if (this.staticDirty) this.rebuildStaticProxy();
    const reach = view ? viewReach(this.viewOf(view), focus, this.right, this.up, this.halfExtent) : this.halfExtent;
    const extent = nextExtent(this.extent, reach, this.halfExtent);
    if (extent !== this.extent) this.setExtent(extent);
    const c = new Vector3(focus.x, focus.y, focus.z);
    const cx = Vector3.Dot(c, this.right);
    const cy = Vector3.Dot(c, this.up);
    const sx = Math.round(cx / this.texelWorld) * this.texelWorld;
    const sy = Math.round(cy / this.texelWorld) * this.texelWorld;
    const key = `${extent}:${sx.toFixed(4)}:${sy.toFixed(4)}`;
    const moved = key !== this.lastSnap;
    this.maps.frame(moved);
    if (!moved) return null;
    this.lastSnap = key;
    const snapped = c.add(this.right.scale(sx - cx)).add(this.up.scale(sy - cy));
    this.camera.position.copyFrom(snapped.add(this.dir.scale(90)));
    return this.camera.getViewMatrix(true).multiply(this.camera.getProjectionMatrix(true));
  }

  /** Draw calls the shadow pass costs per frame (none for the statics while they are kept). */
  get passMeshes(): number {
    return this.maps.passMeshes;
  }

  /** The kept statics are drawn and stay so while the square stands (`ShadowMaps.settled`). */
  get settled(): boolean {
    return this.maps.settled;
  }

  /** Side of the square the shadow covers now (m). */
  get coverage(): number {
    return this.extent * 2;
  }

  /** One shadow texel across, in metres in the light's plane. */
  get texelMetres(): number {
    return this.texelWorld;
  }

  private setExtent(extent: number): void {
    this.extent = extent;
    this.texelWorld = (2 * extent) / this.size;
    this.camera.orthoLeft = -extent;
    this.camera.orthoRight = extent;
    this.camera.orthoTop = extent;
    this.camera.orthoBottom = -extent;
  }

  /** The camera's eye and the world directions through the corners of its screen. */
  private viewOf(view: Camera): ShadowView {
    const engine = this.scene.getEngine();
    const [tx, ty] = halfTangents(view.fov, view.fovMode === CameraClass.FOVMODE_HORIZONTAL_FIXED, engine.getRenderWidth(), engine.getRenderHeight());
    const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => view.getDirection(new Vector3(sx * tx, sy * ty, 1))));
    return { eye: view.globalPosition, corners };
  }

  private rebuildStaticProxy(): void {
    this.staticDirty = false;
    if (this.staticProxy) {
      this.staticProxy.dispose();
      this.staticProxy = null;
    }
    const sources = [...this.statics].filter((m): m is MeshClass => m instanceof MeshClass && !m.isDisposed());
    if (sources.length === 0) return this.maps.setProxy(null);
    // Depth only needs positions: rebuild each caster as bare world-space geometry so meshes
    // with different attribute sets (colours, UVs) can be merged.
    const clones = sources.map((m) => {
      m.computeWorldMatrix(true);
      const positions = m.getVerticesData(VertexBuffer.PositionKind) ?? [];
      const world = m.getWorldMatrix();
      const out = new Float32Array(positions.length);
      const v = new Vector3();
      for (let i = 0; i < positions.length; i += 3) {
        Vector3.TransformCoordinatesFromFloatsToRef(positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0, world, v);
        out[i] = v.x;
        out[i + 1] = v.y;
        out[i + 2] = v.z;
      }
      const data = new VertexData();
      data.positions = out;
      data.indices = m.getIndices() ?? [];
      const c = new MeshClass(`${m.name}-shadow`, this.scene);
      data.applyToMesh(c);
      return c;
    });
    const merged = MeshClass.MergeMeshes(clones, true, true);
    if (!merged) return this.maps.setProxy(null);
    merged.name = "moon-static-casters";
    merged.layerMask = SHADOW_ONLY_LAYER;
    merged.isPickable = false;
    merged.freezeWorldMatrix();
    this.staticProxy = merged;
    this.maps.setProxy(merged);
  }
}
