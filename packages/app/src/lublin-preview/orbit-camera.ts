import type { Vec3 } from "@seki/core";

/**
 * Camera of the map preview (ADR-0044): an orbit around a target on the ground. Drag turns it,
 * the wheel moves in and out, the keys (WASD or arrows) slide the target, Q and E lower and
 * raise it. Pure state; `bindOrbitInput` wires it to the canvas.
 */
export class OrbitCamera {
  target: Vec3;
  /** Heading from the target to the camera, radians (0 = camera south of the target). */
  yaw: number;
  /** Elevation of the camera seen from the target, radians. */
  pitch: number;
  distance: number;

  constructor(view: { position: Vec3; target: Vec3 }) {
    this.target = { ...view.target };
    this.yaw = 0;
    this.pitch = 0.3;
    this.distance = 20;
    this.look(view.position, view.target);
  }

  /** Puts the camera at `position` looking at `target`. */
  look(position: Vec3, target: Vec3): void {
    this.target = { ...target };
    const dx = position.x - target.x;
    const dy = position.y - target.y;
    const dz = position.z - target.z;
    this.distance = Math.max(Math.hypot(dx, dy, dz), 0.5);
    this.pitch = Math.asin(Math.max(-1, Math.min(1, dy / this.distance)));
    this.yaw = Math.atan2(dx, -dz);
  }

  get position(): Vec3 {
    const flat = Math.cos(this.pitch) * this.distance;
    return { x: this.target.x + Math.sin(this.yaw) * flat, y: this.target.y + Math.sin(this.pitch) * this.distance, z: this.target.z - Math.cos(this.yaw) * flat };
  }

  rotate(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch = Math.max(-0.2, Math.min(1.55, this.pitch + dPitch));
  }

  zoom(factor: number): void {
    this.distance = Math.max(1, Math.min(900, this.distance * factor));
  }

  /** Slides the target: `forward` along the view on the ground, `right` across it, `up` straight up (metres). */
  move(forward: number, right: number, up = 0): void {
    const fx = -Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.target = { x: this.target.x + fx * forward + fz * right, y: this.target.y + up, z: this.target.z + fz * forward - fx * right };
  }
}

const KEYS: Readonly<Record<string, readonly [number, number, number]>> = {
  KeyW: [1, 0, 0],
  ArrowUp: [1, 0, 0],
  KeyS: [-1, 0, 0],
  ArrowDown: [-1, 0, 0],
  KeyA: [0, -1, 0],
  ArrowLeft: [0, -1, 0],
  KeyD: [0, 1, 0],
  ArrowRight: [0, 1, 0],
  KeyQ: [0, 0, -1],
  KeyE: [0, 0, 1],
};

/** Mouse, wheel and keys on the canvas; returns the per-frame step for held keys. */
export const bindOrbitInput = (canvas: HTMLCanvasElement, cam: OrbitCamera): ((dt: number) => void) => {
  const held = new Set<string>();
  let drag: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    cam.rotate((e.clientX - drag.x) * 0.005, (e.clientY - drag.y) * 0.005);
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", () => {
    drag = null;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      cam.zoom(Math.exp(e.deltaY * 0.001));
    },
    { passive: false },
  );
  window.addEventListener("keydown", (e) => held.add(e.code));
  window.addEventListener("keyup", (e) => held.delete(e.code));
  return (dt) => {
    const speed = Math.max(8, cam.distance * 0.8) * dt * (held.has("ShiftLeft") ? 3 : 1);
    for (const code of held) {
      const k = KEYS[code];
      if (k) cam.move(k[0] * speed, k[1] * speed, k[2] * speed * 0.5);
    }
  };
};
