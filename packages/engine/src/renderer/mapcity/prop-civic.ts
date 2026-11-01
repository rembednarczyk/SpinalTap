import { MeshSink, type Rgba } from "../mesh-sink";
import { blob, block, frustum, glow, paint, path, pyramid, ring, tube, v3 } from "./prop-kit";
import { MONUMENT_SHAPE } from "./prop-shapes";

/**
 * Bigger street furniture (ADR-0047), front +z: the glass bus shelter with an ad screen, stop
 * posts, ticket and vending machines (rows of them like in Kabuki), the 24H kiosk, café gardens
 * with a parasol, market stalls, the jets of the dry fountains, and monuments: the Union
 * obelisk with holo-rings, a figure on a plinth, the Koziołek, an abstract sculpture, a stele
 * with a tablet and a wayside shrine.
 */

const DARK = paint("#24272d");
const STEEL = paint("#5f656d");
const GLASS = paint("#5d7f8f");
const HOLO = glow("#38e4ff");
const GRANITE = paint("#8e8d88");
const BRONZE = paint("#5b6a52");

export const busShelter = (): MeshSink => {
  const sink = new MeshSink();
  for (const x of [-1.7, 1.7]) for (const z of [-0.65, 0.55]) block(sink, x, -0.1, z, 0.08, 2.55, 0.08, STEEL);
  sink.box(v3(0, 2.5, -0.05), 3.8, 0.12, 1.6, DARK);
  sink.box(v3(0, 2.565, -0.05), 3.7, 0.01, 1.5, glow("#9cf2ff"));
  sink.box(v3(0, 1.25, -0.66), 3.3, 2.1, 0.03, GLASS);
  sink.box(v3(-1.7, 1.25, -0.05), 0.03, 2.1, 1.1, GLASS);
  // The ad screen at the side and the bench.
  sink.box(v3(1.72, 1.3, -0.05), 0.05, 1.7, 1.05, glow("#ff4fb8"));
  block(sink, 0, 0.0, -0.4, 2.2, 0.48, 0.38, paint("#7a5236"));
  return sink;
};

/** The stop post with the green-yellow sign and a timetable display. */
export const busStop = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.1, 0), 0.05, 2.9, 6, STEEL);
  sink.box(v3(0, 2.6, 0), 0.5, 0.5, 0.04, paint("#1d7a3f"));
  sink.box(v3(0, 2.6, 0.022), 0.34, 0.34, 0.005, paint("#f2d22e"));
  sink.box(v3(0, 1.5, 0.05), 0.42, 0.55, 0.06, DARK);
  sink.box(v3(0, 1.5, 0.082), 0.36, 0.45, 0.005, glow("#ffb347"));
  return sink;
};

export const ticketMachine = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.1, 0, 0.55, 1.75, 0.4, paint("#d0b52c"));
  sink.box(v3(0, 1.2, 0.205), 0.34, 0.26, 0.01, glow("#8ff0ff"));
  sink.box(v3(0, 0.85, 0.21), 0.3, 0.14, 0.02, DARK);
  return sink;
};

const VENDING: readonly [string, string][] = [
  ["#c4202f", "#fff2d8"],
  ["#1f5fbf", "#e4f6ff"],
  ["#e6e6e2", "#ffe9f6"],
];

/** A Japanese-style drinks machine: lit front with rows of cans, shape picks the livery. */
export const vendingMachine = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const [body, light] = VENDING[shape] ?? VENDING[0]!;
  block(sink, 0, -0.05, 0, 1.0, 1.95, 0.75, paint(body));
  sink.box(v3(-0.1, 1.25, 0.38), 0.68, 0.95, 0.01, glow(light));
  for (let r = 0; r < 3; r++) sink.box(v3(-0.1, 0.9 + r * 0.3, 0.39), 0.62, 0.1, 0.02, paint(["#d43d3d", "#3d7ad4", "#e2b23a"][r]!));
  sink.box(v3(0.38, 1.1, 0.385), 0.12, 0.3, 0.01, glow("#7cffb2"));
  sink.box(v3(-0.1, 0.35, 0.385), 0.6, 0.18, 0.02, DARK);
  return sink;
};

/** The kiosk with a lit window band and a 24H sign. */
export const kiosk = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.1, 0, 2.6, 2.6, 2.0, paint("#8b9a9c"));
  sink.box(v3(0, 2.6, 0), 3.0, 0.14, 2.4, DARK);
  sink.box(v3(0, 1.55, 1.005), 2.3, 0.8, 0.01, glow("#ffe2a6"));
  sink.box(v3(0, 2.9, 0.6), 1.0, 0.36, 0.08, DARK);
  sink.box(v3(0, 2.9, 0.645), 0.86, 0.24, 0.01, glow("#ff3a8c"));
  return sink;
};

const PARASOLS = ["#b8242f", "#1d6f43", "#e9e1cf"];

/** A café garden: a low deck, a fence on the street side, two tables and a big parasol lit from below. */
export const cafeGarden = (shape: number): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.1, 0, 4.2, 0.22, 3.0, paint("#6e4d34"));
  const fence = paint("#2b2e33");
  sink.box(v3(0, 0.55, 1.45), 4.1, 0.05, 0.05, fence);
  for (let i = 0; i < 6; i++) block(sink, -2.0 + i * 0.8, 0.1, 1.45, 0.04, 0.5, 0.04, fence);
  sink.box(v3(0, 0.35, 1.47), 3.9, 0.35, 0.02, paint(PARASOLS[shape] ?? PARASOLS[0]!));
  for (const x of [-1.0, 1.0]) {
    sink.prism(v3(x, 0.1, -0.2), 0.04, 0.65, 5, fence);
    sink.prism(v3(x, 0.75, -0.2), 0.36, 0.04, 8, paint("#d8d4ca"));
    for (const dz of [-0.55, 0.55]) block(sink, x, 0.1, -0.2 + dz, 0.4, 0.42, 0.4, paint("#3a3d42"));
  }
  sink.prism(v3(0, 0.1, -0.2), 0.04, 2.45, 6, fence);
  const canopy = paint(PARASOLS[shape] ?? PARASOLS[0]!);
  sink.prism(v3(0, 2.25, -0.2), 1.9, 0.12, 8, canopy, false, 1.9);
  sink.prism(v3(0, 2.37, -0.2), 1.9, 0.38, 8, canopy, true, 0.05);
  ring(sink, v3(0, 2.22, -0.2), 1.8, 0.02, glow("#ffcf7a"), 16);
  return sink;
};

const CANVAS = ["#c8452f", "#2c6d8a", "#d9a12e"];

/** A wooden market stall with a canvas roof, a counter and a string of lights. */
export const marketStall = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const wood = paint("#7b5537");
  for (const x of [-1.0, 1.0]) for (const z of [-0.7, 0.7]) block(sink, x, -0.1, z, 0.08, 2.3, 0.08, wood);
  block(sink, 0, -0.1, 0.55, 2.1, 1.05, 0.5, wood);
  sink.box(v3(0, 1.0, 0.55), 2.2, 0.06, 0.6, paint("#a07b55"));
  sink.box(v3(0, 2.35, 0), 2.4, 0.06, 1.8, paint(CANVAS[shape] ?? CANVAS[0]!), { tilt: 0 });
  pyramid(sink, v3(0, 2.38, 0), 2.4, 1.8, 0.45, paint(CANVAS[shape] ?? CANVAS[0]!));
  for (let i = 0; i < 6; i++) blob(sink, v3(-1.0 + i * 0.4, 2.2 - Math.sin((i / 5) * Math.PI) * 0.12, 0.92), 0.05, 0.05, 0.05, glow("#ffd27a"), 4, 2);
  for (let i = 0; i < 4; i++) block(sink, -0.6 + i * 0.4, 1.03, 0.55, 0.3, 0.18, 0.3, paint(["#d9a33a", "#a8c94a", "#c84a3a", "#e8e0c8"][i]!));
  return sink;
};

/** A grate in the paving and a column of lit mist (the dry fountains of Plac Litewski). */
export const fountainJets = (): MeshSink => {
  const sink = new MeshSink();
  sink.disc(v3(0, 0.1, 0), 0.32, 0.32, 8, paint("#3a3d42"));
  tube(sink, v3(0, 0.1, 0), v3(0, 1.1, 0), 0.03, glow("#5fc6dc"), 5, 0.07);
  blob(sink, v3(0, 1.15, 0), 0.16, 0.12, 0.16, glow("#9fe2ee"), 6, 3);
  return sink;
};

const plinth = (sink: MeshSink, w: number, h: number, color: Rgba = GRANITE): void => {
  block(sink, 0, -0.2, 0, w + 0.4, 0.4, w + 0.4, paint("#76756f"));
  block(sink, 0, 0.2, 0, w, h - 0.2, w, color);
  sink.box(v3(0, h + 0.05, 0), w + 0.15, 0.1, w + 0.15, paint("#76756f"));
};

/** A standing figure (bronze), its base at y. */
const figure = (sink: MeshSink, y: number, s: number): void => {
  for (const sx of [-1, 1]) tube(sink, v3(sx * 0.12 * s, y, 0), v3(sx * 0.1 * s, y + 0.9 * s, 0), 0.09 * s, BRONZE, 6);
  tube(sink, v3(0, y + 0.85 * s, 0), v3(0, y + 1.5 * s, 0), 0.22 * s, BRONZE, 7, 0.19 * s);
  blob(sink, v3(0, y + 1.5 * s, 0), 0.3 * s, 0.12 * s, 0.2 * s, BRONZE, 6, 3);
  tube(sink, v3(0.26 * s, y + 1.45 * s, 0), v3(0.32 * s, y + 0.95 * s, 0.12 * s), 0.07 * s, BRONZE, 5);
  tube(sink, v3(-0.26 * s, y + 1.45 * s, 0), v3(-0.38 * s, y + 1.75 * s, 0.25 * s), 0.07 * s, BRONZE, 5);
  blob(sink, v3(0, y + 1.75 * s, 0), 0.13 * s, 0.16 * s, 0.14 * s, BRONZE, 6, 4);
};

/** The Koziołek of Lublin's coat of arms: a bronze goat rearing on a low plinth. */
const koziolek = (sink: MeshSink): void => {
  block(sink, 0, -0.2, 0, 0.9, 0.6, 0.6, GRANITE);
  const b = paint("#7c6a3e");
  blob(sink, v3(0, 0.75, 0), 0.32, 0.17, 0.15, b, 7, 4);
  for (const [x, z] of [
    [-0.2, -0.07],
    [-0.2, 0.07],
  ] as const) {
    tube(sink, v3(x, 0.66, z), v3(x - 0.05, 0.4, z), 0.035, b, 4);
  }
  for (const z of [-0.07, 0.07]) tube(sink, v3(0.2, 0.75, z), v3(0.38, 0.95, z), 0.03, b, 4);
  blob(sink, v3(0.33, 1.02, 0), 0.1, 0.09, 0.07, b, 6, 3);
  for (const z of [-0.04, 0.04]) path(sink, [v3(0.32, 1.1, z), v3(0.26, 1.24, z * 2), v3(0.16, 1.26, z * 3), v3(0.12, 1.16, z * 3)], 0.016, b, 4);
};

const WHITEWASH = paint("#d8d2c4");

/**
 * The neutral memorial for one whose tags name no figure (G-149): a granite stele on a low base
 * with a bronze tablet on its front and a thin holo line under it.
 */
const stele = (sink: MeshSink): void => {
  block(sink, 0, -0.2, 0, 1.3, 0.4, 0.7, paint("#76756f"));
  block(sink, 0, 0.2, 0, 0.9, 1.35, 0.4, GRANITE);
  sink.box(v3(0, 1.59, 0), 1.0, 0.08, 0.5, paint("#76756f"));
  sink.box(v3(0, 1.05, 0.205), 0.6, 0.45, 0.02, BRONZE);
  sink.box(v3(0, 0.74, 0.205), 0.6, 0.03, 0.01, HOLO);
};

/** A wayside shrine: a whitewashed pillar, a niche lit by a candle, a tin roof and a cross. */
const shrine = (sink: MeshSink): void => {
  block(sink, 0, -0.2, 0, 0.9, 0.5, 0.9, paint("#76756f"));
  block(sink, 0, 0.3, 0, 0.6, 1.6, 0.6, WHITEWASH);
  block(sink, 0, 1.9, 0, 0.75, 0.75, 0.75, WHITEWASH);
  sink.box(v3(0, 2.27, 0.38), 0.4, 0.5, 0.01, glow("#ffcf7a"));
  pyramid(sink, v3(0, 2.65, 0), 0.95, 0.95, 0.45, paint("#3a3d42"));
  const iron = paint("#2a2c2e");
  sink.box(v3(0, 3.3, 0), 0.05, 0.4, 0.05, iron);
  sink.box(v3(0, 3.38, 0), 0.24, 0.05, 0.05, iron);
};

/** Monuments and artworks by shape: obelisk, figure on a plinth, Koziołek, abstract, stele, shrine. */
export const monument = (shape: number): MeshSink => {
  const sink = new MeshSink();
  if (shape === MONUMENT_SHAPE.stele) {
    stele(sink);
  } else if (shape === MONUMENT_SHAPE.shrine) {
    shrine(sink);
  } else if (shape === MONUMENT_SHAPE.obelisk) {
    plinth(sink, 2.4, 2.0);
    const iron = paint("#2a2c2e");
    frustum(sink, v3(0, 2.1, 0), 1.05, 0.54, 9.5, iron);
    pyramid(sink, v3(0, 11.6, 0), 0.54, 0.54, 0.9, iron);
    ring(sink, v3(0, 6.0, 0), 1.25, 0.03, HOLO, 20);
    ring(sink, v3(0, 8.6, 0), 0.95, 0.025, glow("#ff4fc8"), 18);
    blob(sink, v3(0, 12.6, 0), 0.08, 0.08, 0.08, glow("#ff2a3a"), 5, 3);
  } else if (shape === MONUMENT_SHAPE.figure) {
    plinth(sink, 1.4, 1.8);
    figure(sink, 1.9, 1.15);
  } else if (shape === MONUMENT_SHAPE.koziolek) {
    koziolek(sink);
  } else {
    block(sink, 0, -0.2, 0, 1.0, 0.5, 1.0, GRANITE);
    for (let i = 0; i < 4; i++) sink.box(v3(0, 0.6 + i * 0.55, 0), 0.7 - i * 0.1, 0.5, 0.3, paint("#9aa0a6"), { rotY: i * 0.45 });
    sink.box(v3(0, 1.4, 0), 0.03, 2.2, 0.03, glow("#ff4fc8"), { rotY: 0.6 });
  }
  return sink;
};

/** The far monument: the obelisk as a column with its lower ring, the shrine as its pillar, the rest as a plinth block. */
export const farMonument = (shape: number): MeshSink => {
  const sink = new MeshSink();
  if (shape === MONUMENT_SHAPE.obelisk) {
    block(sink, 0, -0.2, 0, 2.6, 2.2, 2.6, GRANITE);
    frustum(sink, v3(0, 2.0, 0), 1.05, 0.3, 10.5, paint("#2a2c2e"));
    ring(sink, v3(0, 6.0, 0), 1.25, 0.05, HOLO, 10);
  } else if (shape === MONUMENT_SHAPE.shrine) {
    block(sink, 0, -0.2, 0, 0.75, 3.3, 0.75, WHITEWASH);
  } else if (shape === MONUMENT_SHAPE.stele) {
    block(sink, 0, -0.2, 0, 1.0, 1.8, 0.5, GRANITE);
  } else {
    block(sink, 0, -0.2, 0, 1.4, shape === MONUMENT_SHAPE.figure ? 3.8 : 1.2, 1.4, GRANITE);
  }
  return sink;
};
