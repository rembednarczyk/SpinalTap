import { type AbstractMesh, FreeCamera, MeshBuilder, Ray, type Scene, TransformNode, Vector3 } from "../babylon";
import { type CameraMode, type Transform, type Vec3, directionFromAngles } from "@seki/core";
import { EYE_HEIGHT, TPP_HEIGHT_OFFSET, TPP_SHOULDER_OFFSET } from "@seki/sim";
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
    const sleeve = MeshBuilder.CreateBox("vm-sleeve", { width: 0.07, height: 0.07, depth: 0.14 }, scene);
    sleeve.material = materials.get("heroineCoat");
    sleeve.parent = this.viewmodel;
    sleeve.position.set(0, -0.015, -0.1);
    const hand = MeshBuilder.CreateSphere("vm-hand", { diameter: 0.07, segments: 10 }, scene);
    hand.material = materials.get("skin");
    hand.parent = this.viewmodel;
    hand.position.set(0, 0, 0);
    const gun = MeshBuilder.CreateBox("vm-gun", { width: 0.035, height: 0.065, depth: 0.19 }, scene);
    gun.material = materials.get("gun");
    gun.parent = this.viewmodel;
    gun.position.set(0, 0.04, 0.07);
    for (const m of [sleeve, hand, gun]) {
      m.isPickable = false;
      applyOutline(m, 0.004);
    }
    this.viewmodel.position.set(VIEWMODEL.x, VIEWMODEL.y, VIEWMODEL.z);
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
    const eye = new Vector3(p.x, p.y + EYE_HEIGHT, p.z);
    const shoulder = eye.add(new Vector3(Math.cos(yaw) * TPP_SHOULDER_OFFSET, TPP_HEIGHT_OFFSET, -Math.sin(yaw) * TPP_SHOULDER_OFFSET).scale(this.blend));
    const back = new Vector3(-dir.x, -dir.y, -dir.z);

    let distance = TPP_DISTANCE * this.blend;
    if (distance > 0.01) {
      const hit = this.scene.pickWithRay(new Ray(shoulder, back, distance + WALL_MARGIN), this.isBlocker);
      if (hit?.hit) distance = Math.max(0.2, Math.min(distance, hit.distance - WALL_MARGIN));
    }
    // Pull in immediately, ease back out.
    this.currentDistance = distance < this.currentDistance ? distance : this.currentDistance + (distance - this.currentDistance) * Math.min(1, dt * 8);

    this.camera.position.copyFrom(shoulder.add(back.scale(this.currentDistance)));
    this.camera.rotation.set(pitch - this.recoil * 0.025, yaw, 0);

    const fpp = this.blend < 0.35;
    this.viewmodel.setEnabled(fpp);
    this.viewmodel.position.z = VIEWMODEL.z - this.recoil * 0.035;
    this.viewmodel.rotation.x = -this.recoil * 0.25;
    this.onBodyVisibility(!fpp);
  }
}
