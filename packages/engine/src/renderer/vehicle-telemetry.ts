import type { TelemetryWheel } from "@seki/core";
import { Color4, type LinesMesh, MeshBuilder, type Scene, Vector3 } from "../babylon";

/*
 * The telemetry of the car she drives (ADR-0097 §3, a developer's mode behind `?telemetry=1`, as
 * Babylon's `PhysicsViewer` draws a physics body's helpers): per wheel the suspension's ray from its
 * mount to the contact, white, and the force the ground puts on the car there, scaled to metres per
 * `NEWTONS_PER_M`, green gripping to red sliding. One line system, made on the first call and
 * rewritten in place; none in a normal game, which never calls it.
 */

export const NEWTONS_PER_M = 4000;
const RAY = new Color4(1, 1, 1, 1);

/** The lines for `wheels`: each wheel's ray and its force, the colour of each point (pure; tests). */
export const telemetryLines = (wheels: readonly TelemetryWheel[]): { lines: Vector3[][]; colors: Color4[][] } => {
  const lines: Vector3[][] = [];
  const colors: Color4[][] = [];
  for (const w of wheels) {
    const contact = w.contact ?? w.mount;
    lines.push([new Vector3(w.mount.x, w.mount.y, w.mount.z), new Vector3(contact.x, contact.y, contact.z)]);
    colors.push([RAY, RAY]);
    const tip = new Vector3(contact.x + w.force.x / NEWTONS_PER_M, contact.y + w.force.y / NEWTONS_PER_M, contact.z + w.force.z / NEWTONS_PER_M);
    const c = new Color4(Math.min(1, 2 * w.slip), Math.min(1, 2 * (1 - w.slip)), 0.1, 1);
    lines.push([new Vector3(contact.x, contact.y, contact.z), tip]);
    colors.push([c, c]);
  }
  return { lines, colors };
};

export class VehicleTelemetry {
  private mesh: LinesMesh | null = null;

  constructor(private readonly scene: Scene) {}

  /** True while it draws (tests). */
  get drawn(): boolean {
    return this.mesh?.isEnabled() ?? false;
  }

  /** The wheels to draw now, or null to hide it. */
  update(wheels: readonly TelemetryWheel[] | null): void {
    if (!wheels || wheels.length === 0) {
      this.mesh?.setEnabled(false);
      return;
    }
    const { lines, colors } = telemetryLines(wheels);
    // Rewritten in place while the wheels stay four; made anew otherwise.
    const instance = this.mesh && this.mesh.getTotalVertices() === lines.length * 2 ? this.mesh : undefined;
    if (!instance) this.mesh?.dispose();
    this.mesh = MeshBuilder.CreateLineSystem("vehicle-telemetry", { lines, colors, updatable: true, ...(instance ? { instance } : {}) }, this.scene);
    this.mesh.isPickable = false;
    // Its bounds stay those it was made with while its points move with the car: always drawn, over the scene.
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.renderingGroupId = 1;
    this.mesh.setEnabled(true);
  }
}
