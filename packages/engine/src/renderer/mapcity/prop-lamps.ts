import { MeshSink, type Vec } from "../mesh-sink";
import { arc, blob, block, glow, paint, path, pyramid, ring, tube, v3 } from "./prop-kit";

/**
 * The five Lublin lamps (ADR-0047, photos in docs/world/lublin-street-plan.md §5) and the park
 * lamp and floodlight, as NPR models in their own frame (front +z, towards the street):
 * - pastoral: black cast-iron post with a shepherd's-crook arm and a hanging four-sided lantern
 *   (Krakowskie, Łokietka, Zamkowa); 2077: a holo-ring under the lantern, a camera in the arm;
 * - wall lantern: the same lantern on a wrought bracket from a facade (Old Town), warm or cold LED;
 * - candelabrum: fluted column with four curled arms and globes (Plac Zamkowy), globes in neon colours;
 * - modern pole: slim graphite pole with a crossbar and flat LED heads (Plac Litewski), an LED strip;
 * - road lamp: tall steel pole with an outreach arm, sodium light, a banner and an ANPR camera.
 */

/** A light of a model: where the halo sits, its colour and size, and whether it pools on the ground. */
export interface PropLight {
  readonly at: Vec;
  readonly color: string;
  readonly size: number;
  readonly pool: boolean;
}

export interface PropModel {
  readonly sink: MeshSink;
  readonly lights: readonly PropLight[];
}

const IRON = paint("#17191d");
const IRON_HI = paint("#2a2d33");
const GRAPHITE = paint("#3a3f47");
const STEEL = paint("#5f656d");
const WARM = glow("#ffd48a");
const COLD = glow("#d8f2ff");
const SODIUM = glow("#ffad55");
const HOLO = glow("#38e4ff");
const MAGENTA = glow("#ff3fb0");
const RED = glow("#ff2a3a");

/** The four-sided "gas" lantern of the pastoral lamp and the wall lantern, hanging from `top`. */
const lantern = (sink: MeshSink, top: Vec, size: number, glass: ReturnType<typeof glow>): Vec => {
  const w = 0.3 * size;
  const h = 0.42 * size;
  tube(sink, top, v3(top.x, top.y - 0.1, top.z), 0.015, IRON, 4);
  const capY = top.y - 0.1 - 0.13 * size;
  pyramid(sink, v3(top.x, capY, top.z), w * 1.3, w * 1.3, 0.13 * size, IRON);
  sink.box(v3(top.x, capY - 0.02, top.z), w * 1.32, 0.04, w * 1.32, IRON);
  const cy = capY - 0.04 - h / 2;
  sink.box(v3(top.x, cy, top.z), w, h, w, glass);
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    sink.box(v3(top.x + (sx * w) / 2, cy, top.z + (sz * w) / 2), 0.03, h + 0.02, 0.03, IRON);
  }
  sink.box(v3(top.x, cy - h / 2 - 0.03, top.z), w * 0.9, 0.06, w * 0.9, IRON);
  pyramid(sink, v3(top.x, cy - h / 2 - 0.12, top.z), 0.06, 0.06, 0.06, IRON);
  return v3(top.x, cy, top.z);
};

/** An octagonal cast-iron foot, a collar and a tapered shaft up to `top`. */
const castPost = (sink: MeshSink, top: number, color = IRON): void => {
  sink.prism(v3(0, -0.2, 0), 0.24, 0.75, 8, color, true, 0.2);
  sink.prism(v3(0, 0.55, 0), 0.16, 0.12, 8, IRON_HI);
  sink.prism(v3(0, 0.67, 0), 0.09, top - 0.67, 8, color, true, 0.06);
  for (const y of [1.25, top - 0.7]) sink.prism(v3(0, y, 0), 0.12, 0.07, 8, IRON_HI);
};

export const lampPastoral = (): PropModel => {
  const sink = new MeshSink();
  castPost(sink, 3.75);
  // The crook: up, over towards the street and down to the lantern's hook.
  const crook = [v3(0, 3.7, 0), v3(0, 4.05, 0.04), v3(0, 4.32, 0.2), v3(0, 4.45, 0.46), v3(0, 4.42, 0.74), v3(0, 4.28, 0.95), v3(0, 4.12, 1.05)];
  path(sink, crook, 0.035, IRON, 6);
  // The small scroll inside the crook.
  path(sink, arc(v3(0, 4.12, 0.36), v3(0, 1, 0), v3(0, 0, 1), 0.16, -Math.PI * 0.9, Math.PI * 0.5, 6), 0.018, IRON, 4);
  finial(sink, 4.05);
  const c = lantern(sink, v3(0, 4.12, 1.05), 1, WARM);
  ring(sink, v3(0, c.y - 0.42, 1.05), 0.34, 0.014, HOLO, 14);
  // A camera and a speaker under the arm, a red dot facing the street.
  sink.box(v3(0, 3.62, 0.16), 0.12, 0.1, 0.16, IRON_HI);
  sink.box(v3(0, 3.62, 0.25), 0.03, 0.03, 0.02, RED);
  return { sink, lights: [{ at: c, color: "#ffc978", size: 1.8, pool: true }] };
};

const finial = (sink: MeshSink, y: number): void => {
  blob(sink, v3(0, y, 0), 0.06, 0.06, 0.06, IRON, 5, 3);
  pyramid(sink, v3(0, y + 0.04, 0), 0.05, 0.05, 0.16, IRON);
};

/** Shape 0 warm, 1 a cold LED in the old lantern. */
export const lampWallLantern = (shape: number): PropModel => {
  const sink = new MeshSink();
  sink.box(v3(0, 4.05, 0.02), 0.16, 0.34, 0.04, IRON);
  tube(sink, v3(0, 4.12, 0), v3(0, 4.12, 0.78), 0.022, IRON, 5);
  // The wrought brace under the arm, ending in a curl.
  path(sink, [v3(0, 3.78, 0.02), v3(0, 3.86, 0.2), v3(0, 3.98, 0.38), v3(0, 4.1, 0.5)], 0.016, IRON, 4);
  path(sink, arc(v3(0, 4.02, 0.6), v3(0, 0, -1), v3(0, -1, 0), 0.09, 0, Math.PI * 1.5, 6), 0.012, IRON, 4);
  pyramid(sink, v3(0, 4.12, 0.78), 0.05, 0.05, 0.1, IRON);
  const c = lantern(sink, v3(0, 4.1, 0.72), 1, shape === 1 ? COLD : WARM);
  return { sink, lights: [{ at: c, color: shape === 1 ? "#bfe9ff" : "#ffc978", size: 1.5, pool: true }] };
};

const CANDELABRA_GLOBES = ["#ff4fd2", "#45e3ff", "#ffc35a", "#a47bff"];

export const lampCandelabra = (): PropModel => {
  const sink = new MeshSink();
  const iron = paint("#1d221e");
  sink.box(v3(0, 0.15, 0), 0.62, 0.7, 0.62, iron);
  sink.box(v3(0, 0.52, 0), 0.5, 0.08, 0.5, IRON_HI);
  sink.prism(v3(0, 0.56, 0), 0.13, 2.8, 8, iron, true, 0.09);
  sink.prism(v3(0, 3.3, 0), 0.15, 0.1, 8, IRON_HI);
  const lights: { at: Vec; color: string; size: number; pool: boolean }[] = [];
  CANDELABRA_GLOBES.forEach((color, k) => {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    const pt = (r: number, y: number) => v3(dx * r, y, dz * r);
    path(sink, [pt(0.05, 3.32), pt(0.28, 3.24), pt(0.48, 3.3), pt(0.6, 3.48), pt(0.58, 3.58)], 0.03, iron, 5);
    path(sink, arc(pt(0.2, 3.42), v3(dx, 0, dz), v3(0, 1, 0), 0.1, 0, Math.PI * 1.6, 5), 0.014, iron, 4);
    sink.prism(pt(0.58, 3.56), 0.07, 0.05, 6, IRON_HI);
    const at = pt(0.58, 3.78);
    blob(sink, at, 0.17, 0.19, 0.17, glow(color), 7, 4);
    lights.push({ at, color, size: 0.9, pool: k === 0 });
  });
  sink.prism(v3(0, 3.4, 0), 0.06, 0.55, 6, iron);
  const top = v3(0, 4.15, 0);
  blob(sink, top, 0.2, 0.23, 0.2, WARM, 8, 4);
  finialAt(sink, 4.38);
  lights.push({ at: top, color: "#ffe2a8", size: 1.0, pool: false });
  return { sink, lights };
};

const finialAt = (sink: MeshSink, y: number): void => pyramid(sink, v3(0, y, 0), 0.08, 0.08, 0.14, IRON);

export const lampModernPole = (): PropModel => {
  const sink = new MeshSink();
  block(sink, 0, -0.2, 0, 0.32, 0.6, 0.32, GRAPHITE);
  block(sink, 0, 0.4, 0, 0.14, 7.35, 0.14, GRAPHITE);
  sink.box(v3(0, 7.65, 0), 1.7, 0.08, 0.08, GRAPHITE);
  const lights: PropLight[] = [];
  for (const sx of [-1, 1]) {
    sink.box(v3(sx * 0.8, 7.58, 0), 0.6, 0.07, 0.24, GRAPHITE);
    sink.box(v3(sx * 0.8, 7.535, 0), 0.52, 0.02, 0.18, COLD);
    lights.push({ at: v3(sx * 0.8, 7.45, 0), color: "#e2f3ff", size: 2.1, pool: true });
  }
  // 2077: an LED strip up the street side of the pole.
  sink.box(v3(0, 3.9, 0.075), 0.035, 4.6, 0.02, HOLO);
  return { sink, lights };
};

export const lampRoad = (): PropModel => {
  const sink = new MeshSink();
  block(sink, 0, -0.2, 0, 0.36, 0.55, 0.36, STEEL);
  sink.prism(v3(0, 0.3, 0), 0.11, 8.2, 8, STEEL, true, 0.07);
  path(sink, [v3(0, 8.4, 0), v3(0, 8.75, 0.35), v3(0, 8.95, 1.0), v3(0, 9.02, 2.1)], 0.045, STEEL, 6);
  sink.box(v3(0, 8.98, 2.35), 0.32, 0.12, 0.8, STEEL);
  sink.box(v3(0, 8.915, 2.38), 0.24, 0.02, 0.62, SODIUM);
  // A city banner and an ANPR camera.
  sink.box(v3(0.32, 5.4, 0), 0.03, 1.5, 0.52, paint("#9c2340"));
  sink.box(v3(0.335, 5.4, 0.27), 0.02, 1.5, 0.02, MAGENTA);
  tube(sink, v3(0, 5.95, 0), v3(0.32, 5.95, 0), 0.015, STEEL, 4);
  tube(sink, v3(0, 4.85, 0), v3(0.32, 4.85, 0), 0.015, STEEL, 4);
  sink.box(v3(0, 6.6, 0.18), 0.12, 0.12, 0.26, IRON_HI);
  sink.box(v3(0, 6.6, 0.32), 0.05, 0.05, 0.02, RED);
  return { sink, lights: [{ at: v3(0, 8.8, 2.38), color: "#ffa64d", size: 2.6, pool: true }] };
};

export const lampPark = (): PropModel => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.2, 0), 0.12, 0.6, 8, IRON);
  sink.prism(v3(0, 0.4, 0), 0.055, 3.25, 8, IRON);
  sink.prism(v3(0, 3.6, 0), 0.1, 0.1, 8, IRON_HI);
  const at = v3(0, 3.92, 0);
  blob(sink, at, 0.2, 0.24, 0.2, WARM, 8, 4);
  pyramid(sink, v3(0, 4.12, 0), 0.34, 0.34, 0.12, IRON);
  return { sink, lights: [{ at, color: "#ffd08a", size: 1.3, pool: true }] };
};

/** A ground floodlight lighting a facade (iluminacja zabytków): its lit face up and forward. */
export const floodlight = (): PropModel => {
  const sink = new MeshSink();
  block(sink, 0, -0.1, 0, 0.42, 0.3, 0.32, GRAPHITE);
  sink.box(v3(0, 0.34, 0.05), 0.4, 0.28, 0.12, GRAPHITE, { tilt: 0 });
  sink.box(v3(0, 0.35, 0.12), 0.32, 0.2, 0.02, glow("#ffe6b8"));
  return { sink, lights: [{ at: v3(0, 0.5, 0.25), color: "#ffd9a0", size: 0.9, pool: false }] };
};
