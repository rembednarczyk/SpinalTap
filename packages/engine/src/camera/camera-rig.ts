import { type AbstractMesh, FreeCamera, MeshBuilder, Ray, type Scene, TransformNode, Vector3 } from "../babylon";
import { type CameraMode, type Transform, type Vec3, directionFromAngles } from "@seki/core";
import { TPP_HEIGHT_OFFSET, TPP_SHOULDER_OFFSET, eyeHeightAt } from "@seki/sim";
import { applyOutline } from "../npr/outline";
import type { ToonMaterials } from "../npr/toon-material";

const TPP_DISTANCE = 2.7;
const WALL_MARGIN = 0.25;
const BLEND_SPEED = 6;
const VIEWMODEL = { x: 0.2, y: -0.22, z: 0.62 } as const;

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
  private fov = 1.08;
  private reference: { position: Vector3; target: Vector3 } | null = null;
  onBodyVisibility: (visible: boolean) => void = () => {};

  constructor(
    private readonly scene: Scene,
    materials: ToonMaterials,
    private readonly isBlocker: (mesh: AbstractMesh) => boolean,
  ) {
    this.camera = new FreeCamera("main-camera", new Vector3(0, 1.6, 0), scene);
    this.camera.minZ = 0.04;
    this.camera.maxZ = 320;
    this.camera.fov = 1.08;
    this.camera.inputs.clear();
    scene.activeCamera = this.camera;

    this.viewmodel = new TransformNode("viewmodel", scene);
    this.viewmodel.parent = this.camera;
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
    gun.parent = this.viewmodel;
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
    return this.viewmodel;
  }

  /** Drops the box pistol once a weapon model is mounted. */
  hidePlaceholderGun(): void {
    this.placeholderGun?.dispose();
    this.placeholderGun = null;
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

    let distance = TPP_DISTANCE * this.blend;
    if (distance > 0.01) {
      const hit = this.scene.pickWithRay(new Ray(shoulder, back, distance + WALL_MARGIN), this.isBlocker);
      if (hit?.hit) distance = Math.max(0.2, Math.min(distance, hit.distance - WALL_MARGIN));
    }
    // Pull in immediately, ease back out.
    this.currentDistance = distance < this.currentDistance ? distance : this.currentDistance + (distance - this.currentDistance) * Math.min(1, dt * 8);

    // Walking bob (FPP only), sprint FOV widening, hit shake.
    const moving = Math.min(1, target.speed / 4.2);
    this.bobPhase += dt * (6 + target.speed * 1.6) * (moving > 0.05 ? 1 : 0);
    const bob = (1 - this.blend) * moving;
    const sprinting = target.speed > 5.2 ? 1 : 0;
    this.fov += (1.08 + 0.12 * sprinting - this.fov) * Math.min(1, dt * 6);
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
    // Weapon sways with the walk, sinks and tips down when put away.
    this.viewmodel.position.x = VIEWMODEL.x + Math.sin(t) * 0.012 * bob;
    this.viewmodel.position.y = VIEWMODEL.y - Math.abs(Math.cos(t)) * 0.01 * bob - away * 0.32;
    this.viewmodel.position.z = VIEWMODEL.z - this.recoil * 0.035;
    this.viewmodel.rotation.x = -this.recoil * 0.25 + away * 0.9;
    this.viewmodel.rotation.z = Math.sin(t) * 0.02 * bob + reloading * 0.7;
    this.onBodyVisibility(!fpp);
  }
}
