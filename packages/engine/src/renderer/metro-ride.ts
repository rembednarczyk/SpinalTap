import type { ActivityId, AppearanceDescriptor, EntityId, Transform } from "@seki/core";
import type { Mesh, Scene } from "../babylon";
import type { CameraRig } from "../camera/camera-rig";
import type { MoonShadow } from "../npr/moon-shadow";
import type { ToonMaterials } from "../npr/toon-material";
import type { CharacterDescriptor } from "./character-views";
import { sinkToMesh } from "./dressing";
import { LAYERS, type LayerKind, RIDER_EYE, RIDER_LOOK, type Rider, TRAIN_SPEED, carSway, parallaxOffset, planCar, planLayer, ridersFor } from "./metro-plan";

/**
 * A metro ride on screen (ADR-0036), proposed for `RenderPort.setMetroRide?(ride | null)`. The
 * app sends it on `MetroDeparted` and clears it on `MetroArrived`.
 */
export interface MetroRideView {
  readonly from: string;
  readonly to: string;
  /** Length of the ride in seconds (the streaming time of the destination). */
  readonly seconds: number;
}

/** Where the car stands: far from every district, so the city stays out of the far plane. */
export const CAR_ORIGIN = { x: 0, y: 0, z: -2600 } as const;

/** Entity ids of the riders; the simulation only hands out positive ids. */
const RIDER_ID_BASE = -9000;

const NO_WEAPONS: AppearanceDescriptor = { weapons: { primary: null, secondary: null, melee: null, active: "secondary" }, garments: {}, implants: [] };

const viewOf = (r: Rider): CharacterDescriptor =>
  r.preset === "ganger" || r.preset === "corpo" ? { kind: "enemy", preset: r.preset } : { kind: "npc", preset: r.preset };

/** The characters a ride borrows: spawned like any other, gone when the ride ends. */
export interface RideCast {
  spawn(id: EntityId, view: CharacterDescriptor, t: Transform): void;
  setAppearance(id: EntityId, appearance: AppearanceDescriptor): void;
  /** What a rider does on the way (ADR-0040): sits on the bench, looks at a phone. */
  setActivity?(id: EntityId, activity: ActivityId | null): void;
  despawn(id: EntityId, fall: boolean): void;
}

export interface MetroRideDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow;
  readonly camera: CameraRig;
  readonly cast: RideCast;
}

const at = (p: { x: number; y: number; z: number }) => ({ x: CAR_ORIGIN.x + p.x, y: CAR_ORIGIN.y + p.y, z: CAR_ORIGIN.z + p.z });

/**
 * The inside of a metro car with the night city sliding past its windows: one merged car mesh,
 * three parallax layers, two to four riders from the existing presets and two ceiling lights.
 * Built on the first ride and kept (disabled) afterwards. While it runs the camera sits on the
 * bench with a gentle sway, and the world keeps streaming behind it.
 */
export class MetroRide {
  private car: Mesh | null = null;
  private readonly layers = new Map<LayerKind, Mesh>();
  private ride: MetroRideView | null = null;
  private riders: EntityId[] = [];
  private time = 0;
  private calm = false;

  constructor(private readonly deps: MetroRideDeps) {}

  get active(): boolean {
    return this.ride !== null;
  }

  /** Meshes of the car and its layers (debug, tests). */
  get meshCount(): number {
    return (this.car ? 1 : 0) + this.layers.size;
  }

  get riderCount(): number {
    return this.riders.length;
  }

  /** Reduced motion: the car stops swaying. */
  setCalm(on: boolean): void {
    this.calm = on;
  }

  set(ride: MetroRideView | null): void {
    if (ride === null) return this.stop();
    if (this.ride) this.stop();
    this.ride = ride;
    this.time = 0;
    this.build();
    this.show(true);
    this.spawnRiders(ridersFor(ride.from, ride.to));
    const { materials } = this.deps;
    for (const [i, z] of [-3.5, 3.5].entries()) materials.addLight(`metro-${i}`, { position: at({ x: 0, y: 2.15, z }), color: "#dceaff", range: 7.5, intensity: 1.15 });
  }

  /** Moves the city past the windows and seats the camera; call before the camera rig updates. */
  update(dt: number): void {
    if (!this.ride) return;
    this.time += dt;
    for (const [kind, mesh] of this.layers) mesh.position.z = CAR_ORIGIN.z + parallaxOffset(this.time, TRAIN_SPEED, LAYERS[kind].period);
    const sway = carSway(this.time, this.calm);
    const eye = at({ x: RIDER_EYE.x + sway.dx, y: RIDER_EYE.y + sway.dy, z: RIDER_EYE.z });
    this.deps.camera.setReferenceView(eye, at(RIDER_LOOK));
  }

  /** After the camera rig: the car's roll on top of the seated view. */
  afterCamera(): void {
    if (!this.ride) return;
    this.deps.camera.camera.rotation.z += carSway(this.time, this.calm).roll;
  }

  private stop(): void {
    if (!this.ride) return;
    this.ride = null;
    this.show(false);
    for (const id of this.riders) this.deps.cast.despawn(id, false);
    this.riders = [];
    for (const i of [0, 1]) this.deps.materials.removeLight(`metro-${i}`);
    this.deps.camera.setReferenceView(null);
  }

  private build(): void {
    if (this.car) return;
    const { scene, materials, shadow } = this.deps;
    const dressing = materials.get("dressing");
    const car = sinkToMesh(scene, "metro-car", planCar());
    car.unfreezeWorldMatrix();
    car.position.set(CAR_ORIGIN.x, CAR_ORIGIN.y, CAR_ORIGIN.z);
    car.material = dressing;
    // The roof keeps the moon out: inside, only the ceiling strips light the car.
    shadow.addCaster(car);
    this.car = car;
    for (const kind of ["near", "mid", "far"] as const) {
      const layer = sinkToMesh(scene, `metro-${kind}`, planLayer(kind));
      layer.unfreezeWorldMatrix();
      layer.position.set(CAR_ORIGIN.x, CAR_ORIGIN.y, CAR_ORIGIN.z);
      layer.material = dressing;
      this.layers.set(kind, layer);
    }
    this.show(false);
  }

  private show(on: boolean): void {
    this.car?.setEnabled(on);
    for (const m of this.layers.values()) m.setEnabled(on);
  }

  private spawnRiders(riders: readonly Rider[]): void {
    const { cast } = this.deps;
    riders.forEach((r, i) => {
      const id = RIDER_ID_BASE - i;
      cast.spawn(id, viewOf(r), { position: at(r.at), yaw: r.yaw, pitch: 0, speed: 0 });
      // Nobody rides with a gun out: the armed presets get an empty loadout.
      cast.setAppearance(id, NO_WEAPONS);
      if (r.activity) cast.setActivity?.(id, r.activity);
      this.riders.push(id);
    });
  }
}
