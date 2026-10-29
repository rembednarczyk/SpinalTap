import { type AbstractMesh, FreeCamera, MeshBuilder, Ray, type Scene, TransformNode, Vector3 } from "../babylon";
import { type CameraMode, type Transform, type Vec3, type WeaponLook, directionFromAngles } from "@seki/core";
import { TPP_HEIGHT_OFFSET, TPP_SHOULDER_OFFSET, eyeHeightAt } from "@seki/sim";
import { applyOutline } from "../npr/outline";
import type { ToonMaterials } from "../npr/toon-material";

const TPP_DISTANCE = 2.7;
const WALL_MARGIN = 0.25;
const BLEND_SPEED = 6;
const VIEWMODEL = { x: 0.2, y: -0.22, z: 0.62 } as const;
/** Vertical field of view from the hip (the HUD calibrates the crosshair against it). */
export const BASE_FOV = 1.08;
/** Viewmodel aimed down sights: centred, the sights on the eye line, pulled in (ADR-0019). */
const VIEWMODEL_ADS = { x: 0, y: -0.078, z: 0.4 } as const;
/** How much closer the TPP camera comes over the shoulder at full aim. */
const TPP_ADS_PULL = 0.45;
/** FPP melee guard: the weapon across the view, a little left of centre. */
const VIEWMODEL_GUARD = { x: 0.08, y: -0.12, z: 0.5 } as const;
/** Seconds from the end of a windup to the end of the follow-through (matches the rig). */
const VIEW_STRIKE = 0.09;

/** Field of view for an aim of 0..1 with a weapon zooming by `zoom` at full aim. */
export const aimedFov = (aim: number, zoom: number, base: number = BASE_FOV): number => base * (1 + (zoom - 1) * Math.min(1, Math.max(0, aim)));

/**
 * Look speed multiplier for a field of view: zoomed in, the same hand movement turns the view
 * less, so the crosshair moves as far across the screen as from the hip.
 */
export const lookScaleFor = (fov: number, base: number = BASE_FOV): number => Math.tan(fov / 2) / Math.tan(base / 2);

/**
 * Distance along a ray to the first static geometry of the world (ADR-0045), or null within
 * `maxDist`: the camera's view of what the scene's meshes do not stand for (the map's buildings
 * and the terrain live in the simulation). The app supplies it; the camera only asks.
 */
export type CameraOccluder = (origin: Vec3, dir: Vec3, maxDist: number) => number | null;

interface ViewOffset {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Wound-up and follow-through offsets of the FPP melee viewmodel per strike of the combo. */
const VIEW_SWINGS: readonly { readonly cocked: ViewOffset; readonly through: ViewOffset }[] = [
  // Forehand: from the right shoulder across to the left.
  { cocked: { x: 0.14, y: 0.08, z: -0.08, rx: -0.4, ry: 0.5, rz: -0.9 }, through: { x: -0.42, y: -0.02, z: 0.06, rx: 0.2, ry: -0.7, rz: 0.9 } },
  // Backhand: from the left back to the right.
  { cocked: { x: -0.3, y: 0.04, z: -0.06, rx: -0.3, ry: -0.6, rz: 0.8 }, through: { x: 0.18, y: -0.04, z: 0.08, rx: 0.2, ry: 0.6, rz: -0.9 } },
  // Overhead: up over the head, then down through the centre.
  { cocked: { x: -0.06, y: 0.24, z: -0.12, rx: -1.1, ry: 0, rz: -0.1 }, through: { x: -0.1, y: -0.2, z: 0.08, rx: 1.0, ry: 0, rz: 0 } },
];

/** Offset of the FPP melee viewmodel `elapsed` seconds into a swing (zero before and after). */
export const viewSwingOffset = (strike: number, elapsed: number, windup: number, recovery: number): ViewOffset => {
  const poses = VIEW_SWINGS[((strike % VIEW_SWINGS.length) + VIEW_SWINGS.length) % VIEW_SWINGS.length] ?? VIEW_SWINGS[0]!;
  let cock: number;
  let through: number;
  if (elapsed < windup) {
    cock = smooth(elapsed / Math.max(1e-3, windup));
    through = 0;
  } else if (elapsed < windup + VIEW_STRIKE) {
    cock = 1;
    through = smooth((elapsed - windup) / VIEW_STRIKE);
  } else {
    cock = through = 1 - smooth(Math.min(1, (elapsed - windup - VIEW_STRIKE) / Math.max(1e-3, recovery - VIEW_STRIKE)));
  }
  const mix = (k: keyof ViewOffset) => poses.cocked[k] * cock + (poses.through[k] - poses.cocked[k]) * through;
  return { x: mix("x"), y: mix("y"), z: mix("z"), rx: mix("rx"), ry: mix("ry"), rz: mix("rz") };
};

/**
 * One camera over one character rig, in two modes. FPP sits in the head and shows a weapon
 * viewmodel; TPP orbits behind the shoulder on the aim ray and is pulled in when a wall is
 * between the shoulder and the desired camera position.
 */
export class CameraRig {
  readonly camera: FreeCamera;
  private readonly viewmodel: TransformNode;
  private mode: CameraMode = "FPP";
  /** 0 = FPP, 1 = TPP; animated for a smooth switch. */
  private blend = 0;
  private currentDistance = 0;
  private recoil = 0;
  private shakeAmount = 0;
  private bobPhase = 0;
  /** Sprint widening of the FOV, eased; the aim zoom on top follows the simulation exactly. */
  private sprintFov = 0;
  private fov = BASE_FOV;
  /** Hip field of view from the settings (vertical, radians); aiming and sprint work from it. */
  baseFov = BASE_FOV;
  /** Eased 0..1 guard of the FPP melee viewmodel. */
  private guard = 0;
  private swing: { strike: number; windup: number; recovery: number; elapsed: number } | null = null;
  private melee = false;
  private readonly gunHolder: TransformNode;
  private readonly meleeHolder: TransformNode;
  private meleeLook: WeaponLook | null = null;
  private meleeMesh: AbstractMesh | null = null;
  private readonly materials: ToonMaterials;
  private reference: { position: Vector3; target: Vector3 } | null = null;
  private occluder: CameraOccluder | null = null;
  onBodyVisibility: (visible: boolean) => void = () => {};

  constructor(
    private readonly scene: Scene,
    materials: ToonMaterials,
    private readonly isBlocker: (mesh: AbstractMesh) => boolean,
  ) {
    this.camera = new FreeCamera("main-camera", new Vector3(0, 1.6, 0), scene);
    this.camera.minZ = 0.04;
    this.camera.maxZ = 320;
    this.camera.fov = BASE_FOV;
    this.materials = materials;
    this.camera.inputs.clear();
    scene.activeCamera = this.camera;

    this.viewmodel = new TransformNode("viewmodel", scene);
    this.viewmodel.parent = this.camera;
    // The gun (box or model) and the melee weapon hang under their own holders, one shown at a time.
    this.gunHolder = new TransformNode("vm-gun-holder", scene);
    this.gunHolder.parent = this.viewmodel;
    this.meleeHolder = new TransformNode("vm-melee-holder", scene);
    this.meleeHolder.parent = this.viewmodel;
    this.meleeHolder.setEnabled(false);
    // Kept compact and at least ~25 cm from the eye so perspective does not blow it up.
    // Seki's cybernetic forearm: ivory shell, copper wrist ring, ivory hand.
    const sleeve = MeshBuilder.CreateCylinder("vm-sleeve", { height: 0.2, diameterTop: 0.052, diameterBottom: 0.066, tessellation: 12 }, scene);
    sleeve.material = materials.get("cyberIvory");
    sleeve.parent = this.viewmodel;
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(0, -0.02, -0.11);
    const wrist = MeshBuilder.CreateTorus("vm-wrist", { diameter: 0.054, thickness: 0.012, tessellation: 16 }, scene);
    wrist.material = materials.get("cyberCopper");
    wrist.parent = this.viewmodel;
    wrist.rotation.x = Math.PI / 2;
    wrist.position.set(0, -0.015, -0.01);
    const hand = MeshBuilder.CreateSphere("vm-hand", { diameter: 0.06, segments: 10 }, scene);
    hand.material = materials.get("cyberIvory");
    hand.parent = this.viewmodel;
    hand.scaling.set(0.85, 1, 1.15);
    hand.position.set(0, 0, 0.02);
    const gun = MeshBuilder.CreateBox("vm-gun", { width: 0.035, height: 0.065, depth: 0.19 }, scene);
    gun.material = materials.get("gun");
    gun.parent = this.gunHolder;
    gun.position.set(0, 0.04, 0.07);
    this.placeholderGun = gun;
    for (const m of [sleeve, wrist, hand, gun]) {
      m.isPickable = false;
      applyOutline(m, 0.004);
    }
    this.viewmodel.position.set(VIEWMODEL.x, VIEWMODEL.y, VIEWMODEL.z);
  }

  private placeholderGun: AbstractMesh | null = null;

  /** Node a weapon model is mounted under in the FPP viewmodel. */
  get weaponMount(): TransformNode {
    return this.gunHolder;
  }

  /** Current look speed multiplier from the aim zoom (ADR-0019); 1 from the hip. */
  get lookScale(): number {
    return lookScaleFor(this.camera.fov, this.baseFov);
  }

  /**
   * The weapon in the player's hand: a melee look shows the baton or blade in the viewmodel
   * instead of the gun; anything else shows the gun.
   */
  setHeldWeapon(look: WeaponLook | null): void {
    const melee = look === "baton" || look === "blade";
    this.melee = melee;
    this.gunHolder.setEnabled(!melee);
    this.meleeHolder.setEnabled(melee);
    if (!melee || look === this.meleeLook) return;
    this.meleeLook = look;
    this.meleeMesh?.dispose();
    // The weapon rises from the fist, tip up and forward.
    const length = look === "blade" ? 0.58 : 0.42;
    const mesh = MeshBuilder.CreateBox(`vm-${look}`, { width: look === "blade" ? 0.012 : 0.026, height: length, depth: look === "blade" ? 0.04 : 0.026 }, this.scene);
    mesh.material = this.materials.get("gun");
    mesh.parent = this.meleeHolder;
    mesh.position.set(0, length / 2 - 0.02, 0.02);
    mesh.rotation.x = 0.55;
    mesh.isPickable = false;
    applyOutline(mesh, 0.004);
    this.meleeMesh = mesh;
  }

  /** Plays the FPP melee swing, timed like the simulation's (ADR-0019). */
  startSwing(strike: number, windup: number, recovery: number): void {
    this.swing = { strike, windup, recovery, elapsed: 0 };
  }

  /** Drops the box pistol once a weapon model is mounted. */
  hidePlaceholderGun(): void {
    this.placeholderGun?.dispose();
    this.placeholderGun = null;
  }

  /** What else stops the TPP camera besides the scene's blockers (null: the blockers alone). */
  setOccluder(occluder: CameraOccluder | null): void {
    this.occluder = occluder;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  getMode(): CameraMode {
    return this.mode;
  }

  /** Fixed camera for the title backdrop and reference snapshots; null returns to the character. */
  setReferenceView(position: Vec3 | null, target?: Vec3): void {
    this.reference =
      position && target ? { position: new Vector3(position.x, position.y, position.z), target: new Vector3(target.x, target.y, target.z) } : null;
  }

  /** World position of the viewmodel muzzle, used as the tracer start in FPP. */
  muzzlePosition(): Vector3 | null {
    if (this.blend > 0.5 || this.reference) return null;
    this.viewmodel.computeWorldMatrix(true);
    return Vector3.TransformCoordinates(new Vector3(0, 0.04, 0.17), this.viewmodel.getWorldMatrix());
  }

  kick(): void {
    this.recoil = 1;
  }

  private weaponDrawn = true;
  /** 0 holstered (viewmodel out of view) .. 1 drawn; eased towards `weaponDrawn`. */
  private draw = 1;

  private reload = 0;
  private reloadTotal = 0;

  /** Plays the FPP reload: the weapon dips and rolls in for `seconds`. */
  startReload(seconds: number): void {
    this.reload = this.reloadTotal = Math.max(0.1, seconds);
  }

  /** Holster or draw the FPP weapon; the viewmodel drops out of view or comes back up. */
  setWeaponDrawn(drawn: boolean): void {
    this.weaponDrawn = drawn;
  }

  /** Short camera shake, e.g. when the player is hit. */
  shake(amount: number): void {
    this.shakeAmount = Math.min(1, this.shakeAmount + amount);
  }

  private updateGuard(guard: number, dt: number): number {
    const want = this.melee && guard > 0.5 && !this.swing ? 1 : 0;
    this.guard += (want - this.guard) * Math.min(1, dt * (want > this.guard ? 16 : 8));
    return smooth(this.guard);
  }

  private updateSwing(dt: number): ViewOffset {
    const sw = this.swing;
    if (!sw || !this.melee) {
      this.swing = null;
      return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
    }
    sw.elapsed += dt;
    if (sw.elapsed >= sw.windup + Math.max(VIEW_STRIKE, sw.recovery)) this.swing = null;
    return viewSwingOffset(sw.strike, sw.elapsed, sw.windup, sw.recovery);
  }

  update(target: Transform | null, dt: number): void {
    if (this.reference) {
      this.camera.position.copyFrom(this.reference.position);
      this.camera.setTarget(this.reference.target);
      this.viewmodel.setEnabled(false);
      this.onBodyVisibility(true);
      return;
    }
    if (!target) return;
    const goal = this.mode === "TPP" ? 1 : 0;
    this.blend += Math.sign(goal - this.blend) * Math.min(Math.abs(goal - this.blend), dt * BLEND_SPEED);
    this.recoil = Math.max(0, this.recoil - dt * 9);

    const { position: p, yaw, pitch } = target;
    const dir = directionFromAngles(yaw, pitch);
    // Same curve as the simulation's aim origin, so the crosshair stays exact while crouching.
    const eye = new Vector3(p.x, p.y + eyeHeightAt(target.crouch ?? 0), p.z);
    const shoulder = eye.add(new Vector3(Math.cos(yaw) * TPP_SHOULDER_OFFSET, TPP_HEIGHT_OFFSET, -Math.sin(yaw) * TPP_SHOULDER_OFFSET).scale(this.blend));
    const back = new Vector3(-dir.x, -dir.y, -dir.z);

    // Aiming down sights (ADR-0019): the zoom follows the simulation's eased aim exactly, so the
    // HUD crosshair (which uses the same numbers) stays calibrated.
    const aim = Math.min(1, Math.max(0, target.aim ?? 0));
    const adsFov = aimedFov(aim, target.aimZoom ?? 1, this.baseFov);
    let distance = TPP_DISTANCE * this.blend * (1 - TPP_ADS_PULL * smooth(aim));
    if (distance > 0.01) {
      const hit = this.scene.pickWithRay(new Ray(shoulder, back, distance + WALL_MARGIN), this.isBlocker);
      if (hit?.hit) distance = Math.max(0.2, Math.min(distance, hit.distance - WALL_MARGIN));
      // Buildings and the terrain of the map (ADR-0045): the simulation's own ray.
      const t = this.occluder?.({ x: shoulder.x, y: shoulder.y, z: shoulder.z }, { x: back.x, y: back.y, z: back.z }, distance + WALL_MARGIN) ?? null;
      if (t !== null) distance = Math.max(0.2, Math.min(distance, t - WALL_MARGIN));
    }
    // Pull in immediately, ease back out.
    this.currentDistance = distance < this.currentDistance ? distance : this.currentDistance + (distance - this.currentDistance) * Math.min(1, dt * 8);

    // Walking bob (FPP only), sprint FOV widening, hit shake.
    const moving = Math.min(1, target.speed / 4.2);
    this.bobPhase += dt * (6 + target.speed * 1.6) * (moving > 0.05 ? 1 : 0);
    // Aimed in, the walk barely moves the view.
    const bob = (1 - this.blend) * moving * (1 - 0.8 * aim);
    const sprinting = target.speed > 5.2 ? 1 : 0;
    this.sprintFov += (0.12 * sprinting - this.sprintFov) * Math.min(1, dt * 6);
    this.fov = adsFov + this.sprintFov;
    this.camera.fov = this.fov;
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 3);
    const sh = this.shakeAmount * this.shakeAmount;
    const t = this.bobPhase;

    const pos = shoulder.add(back.scale(this.currentDistance));
    pos.y += Math.abs(Math.sin(t)) * 0.035 * bob;
    this.camera.position.copyFrom(pos);
    this.camera.rotation.set(
      pitch - this.recoil * 0.025 + Math.sin(t * 2) * 0.004 * bob + Math.sin(t * 37) * 0.03 * sh,
      yaw + Math.cos(t) * 0.005 * bob + Math.sin(t * 29 + 1.3) * 0.03 * sh,
      Math.sin(t * 23) * 0.02 * sh,
    );

    const fpp = this.blend < 0.35;
    this.draw += Math.sign((this.weaponDrawn ? 1 : 0) - this.draw) * Math.min(Math.abs((this.weaponDrawn ? 1 : 0) - this.draw), dt / 0.35);
    this.reload = Math.max(0, this.reload - dt);
    const reloading = this.reloadTotal > 0 && this.reload > 0 ? Math.sin(Math.PI * (1 - this.reload / this.reloadTotal)) : 0;
    const away = 1 - this.draw * this.draw * (3 - 2 * this.draw) + reloading * 0.35;
    this.viewmodel.setEnabled(fpp && this.draw > 0.02);
    // Aiming down sights brings the gun to the centre with the sights on the eye line.
    const ads = this.melee ? 0 : smooth(aim);
    const guard = this.updateGuard(target.guard ?? 0, dt);
    const sw = this.updateSwing(dt);
    const base = {
      x: VIEWMODEL.x + (VIEWMODEL_ADS.x - VIEWMODEL.x) * ads + (VIEWMODEL_GUARD.x - VIEWMODEL.x) * guard,
      y: VIEWMODEL.y + (VIEWMODEL_ADS.y - VIEWMODEL.y) * ads + (VIEWMODEL_GUARD.y - VIEWMODEL.y) * guard,
      z: VIEWMODEL.z + (VIEWMODEL_ADS.z - VIEWMODEL.z) * ads + (VIEWMODEL_GUARD.z - VIEWMODEL.z) * guard,
    };
    // Weapon sways with the walk, sinks and tips down when put away.
    this.viewmodel.position.x = base.x + Math.sin(t) * 0.012 * bob + sw.x;
    this.viewmodel.position.y = base.y - Math.abs(Math.cos(t)) * 0.01 * bob - away * 0.32 + sw.y;
    this.viewmodel.position.z = base.z - this.recoil * 0.035 * (1 - 0.5 * ads) + sw.z;
    this.viewmodel.rotation.x = -this.recoil * 0.25 * (1 - 0.5 * ads) + away * 0.9 + sw.rx;
    this.viewmodel.rotation.y = sw.ry;
    // The guard turns the weapon flat across the view.
    this.viewmodel.rotation.z = Math.sin(t) * 0.02 * bob + reloading * 0.7 + guard * 1.25 + sw.rz;
    this.onBodyVisibility(!fpp);
  }
}
