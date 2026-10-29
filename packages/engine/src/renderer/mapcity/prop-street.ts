import { MeshSink } from "../mesh-sink";
import { blob, block, glow, paint, path, pyramid, ring, tube, v3 } from "./prop-kit";

/**
 * Small street furniture (ADR-0047), front +z: the slatted benches of Plac Litewski, granite
 * bollards with a chain, bins, bike racks and the city bike totem, advertising columns, boards,
 * street name plates, cabinets, manholes, granite seats, flagpoles with the red city banners,
 * signals, cameras and the trolleybus poles with their hangers.
 */

const WOOD = paint("#8a5a36");
const WOOD_DARK = paint("#6d4527");
const GRANITE = paint("#8e8d88");
const GRANITE_DARK = paint("#6f6e6a");
const STEEL = paint("#5f656d");
const DARK = paint("#24272d");
const HOLO = glow("#38e4ff");
const RED = glow("#ff2a3a");

/** Shape 0: a long slatted bench without a back (ławy of the squares), 1: with a back. */
export const bench = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const w = shape === 0 ? 2.2 : 1.8;
  for (const sx of [-1, 1]) block(sink, sx * (w / 2 - 0.25), -0.15, 0, 0.12, 0.55, 0.5, GRANITE_DARK);
  for (let i = 0; i < 5; i++) sink.box(v3(0, 0.43, -0.2 + i * 0.1), w, 0.04, 0.075, i % 2 ? WOOD : WOOD_DARK);
  // 2077: a neon strip under the seat.
  sink.box(v3(0, 0.37, 0.2), w - 0.3, 0.02, 0.02, HOLO);
  if (shape === 1) {
    for (const sx of [-1, 1]) sink.box(v3(sx * (w / 2 - 0.25), 0.7, -0.26), 0.1, 0.6, 0.06, DARK, { tilt: 0 });
    for (let i = 0; i < 3; i++) sink.box(v3(0, 0.62 + i * 0.13, -0.27 - i * 0.02), w, 0.08, 0.03, WOOD);
  }
  return sink;
};

/** A granite post with a pyramid top and chain stubs to its neighbours (Plac Łokietka). */
export const bollard = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.2, 0, 0.26, 0.95, 0.26, GRANITE);
  pyramid(sink, v3(0, 0.75, 0), 0.26, 0.26, 0.12, GRANITE_DARK);
  const iron = paint("#1b1d21");
  ring(sink, v3(0, 0.62, 0), 0.14, 0.012, iron, 8);
  sink.cable(v3(0.14, 0.6, 0), v3(1.0, 0.6, 0), 0.12, iron, 0.025);
  sink.cable(v3(-0.14, 0.6, 0), v3(-1.0, 0.6, 0), 0.12, iron, 0.025);
  sink.box(v3(0, 0.66, 0.135), 0.1, 0.02, 0.01, glow("#ff3355"));
  return sink;
};

/** Shape 0 graphite, 1 the old green; a small screen for the 2077 deposit. */
export const wasteBin = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const body = paint(shape === 0 ? "#3a3f46" : "#2f4a37");
  sink.prism(v3(0, -0.1, 0), 0.24, 0.95, 8, body, true, 0.26);
  sink.prism(v3(0, 0.85, 0), 0.28, 0.06, 8, DARK);
  sink.box(v3(0, 0.55, 0.255), 0.14, 0.08, 0.01, glow("#5cffb0"));
  return sink;
};

export const bikeRack = (): MeshSink => {
  const sink = new MeshSink();
  for (const x of [-0.8, 0, 0.8]) path(sink, [v3(x, -0.1, -0.3), v3(x, 0.75, -0.3), v3(x, 0.85, -0.15), v3(x, 0.85, 0.15), v3(x, 0.75, 0.3), v3(x, -0.1, 0.3)], 0.025, STEEL, 5);
  return sink;
};

/** The city bike totem with its screen and four hoops. */
export const bikeStation = (): MeshSink => {
  const sink = bikeRack();
  block(sink, -1.6, -0.1, 0, 0.42, 2.3, 0.3, paint("#2b6e4a"));
  sink.box(v3(-1.6, 1.5, 0.155), 0.3, 0.42, 0.01, glow("#9ff7c8"));
  return sink;
};

/** Shape 0 graphite with posters, 1 the yellow column with a dome (Plac Zamkowy); 2077: a screen ring. */
export const advertisingColumn = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const base = paint(shape === 1 ? "#d8b23a" : "#3b4048");
  sink.prism(v3(0, -0.2, 0), 0.68, 0.5, 12, DARK);
  sink.prism(v3(0, 0.3, 0), 0.6, 0.9, 12, paint("#c9c2b0"));
  sink.prism(v3(0, 1.2, 0), 0.6, 0.55, 12, paint("#a8483d"));
  // 2077: a ring of screen between the posters.
  sink.prism(v3(0, 1.75, 0), 0.61, 0.45, 12, glow("#4fd2ff"));
  sink.prism(v3(0, 2.2, 0), 0.6, 0.45, 12, paint("#d9cfb4"));
  sink.prism(v3(0, 2.65, 0), 0.7, 0.12, 12, base);
  if (shape === 1) blob(sink, v3(0, 2.8, 0), 0.62, 0.45, 0.62, base, 10, 4);
  else sink.prism(v3(0, 2.77, 0), 0.62, 0.25, 12, base, true, 0.2);
  pyramid(sink, v3(0, shape === 1 ? 3.2 : 3.0, 0), 0.12, 0.12, 0.3, DARK);
  return sink;
};

export const aFrameSign = (): MeshSink => {
  const sink = new MeshSink();
  sink.box(v3(0, 0.45, 0.12), 0.55, 0.9, 0.03, DARK, { tilt: 0 });
  sink.box(v3(0, 0.45, -0.12), 0.55, 0.9, 0.03, DARK);
  sink.box(v3(0, 0.5, 0.14), 0.45, 0.6, 0.01, glow("#f2f0e6"));
  return sink;
};

/** A post with Lublin's blue name plate (also the info boards). */
export const streetPlate = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.1, 0), 0.04, 2.8, 6, STEEL);
  sink.box(v3(0, 2.55, 0), 0.75, 0.24, 0.04, paint("#1f4f9a"));
  sink.box(v3(0, 2.55, 0.022), 0.62, 0.08, 0.005, glow("#e8f2ff"));
  return sink;
};

export const streetCabinet = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.1, 0, 0.8, 1.25, 0.36, paint("#7d827f"));
  sink.box(v3(0, 1.17, 0), 0.86, 0.04, 0.42, paint("#5d625f"));
  sink.box(v3(0.25, 0.9, 0.185), 0.08, 0.04, 0.01, glow("#ffb000"));
  return sink;
};

/** A cast-iron cover lying 2 cm above the carriageway's surface (which sits 6 cm above the terrain). */
export const manhole = (): MeshSink => {
  const sink = new MeshSink();
  sink.disc(v3(0, 0.085, 0), 0.34, 0.34, 10, paint("#2b2b2c"));
  sink.disc(v3(0, 0.087, 0), 0.24, 0.24, 10, paint("#3a3936"));
  return sink;
};

/** The granite cube seats of Plac Litewski; 2077: a light panel on top. */
export const graniteBlock = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.15, 0, 0.55, 0.6, 0.55, GRANITE);
  sink.box(v3(0, 0.455, 0), 0.3, 0.01, 0.3, glow("#7fe9ff"));
  return sink;
};

/** Shape 0: an 8 m mast with a long red city banner; 1: the 35 m Maszt Niepodległości with an aviation light. */
export const flagpole = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const h = shape === 1 ? 35 : 8.5;
  sink.prism(v3(0, -0.2, 0), shape === 1 ? 0.35 : 0.1, h + 0.2, 8, paint("#c9ccd0"), true, shape === 1 ? 0.12 : 0.05);
  const flagH = shape === 1 ? 6 : 4.2;
  const flagW = shape === 1 ? 10 : 0.9;
  sink.box(v3(flagW / 2 + 0.08, h - 0.3 - flagH / 2, 0), flagW, flagH, 0.03, paint("#c8102e"));
  if (shape === 1) sink.box(v3(flagW / 2 + 0.08, h - 0.3 - flagH * 0.25, 0), flagW, flagH / 2, 0.035, paint("#f2f2f2"));
  else sink.box(v3(0.08 + flagW, h - 0.3 - flagH / 2, 0), 0.03, flagH, 0.035, glow("#ff4060"));
  blob(sink, v3(0, h + 0.05, 0), 0.08, 0.08, 0.08, shape === 1 ? RED : paint("#d8c070"), 5, 3);
  return sink;
};

export const trafficSignal = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.1, 0), 0.07, 3.4, 8, DARK);
  sink.box(v3(0, 2.75, 0.12), 0.3, 0.9, 0.22, DARK);
  ["#ff2a2a", "#ffb000", "#28ff7a"].forEach((c, i) => sink.box(v3(0, 3.03 - i * 0.28, 0.235), 0.17, 0.17, 0.01, glow(c)));
  sink.box(v3(0, 1.25, 0.09), 0.18, 0.22, 0.12, DARK);
  sink.box(v3(0, 1.25, 0.152), 0.1, 0.1, 0.005, glow("#ffffff"));
  return sink;
};

export const cctv = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.1, 0), 0.06, 4.3, 6, DARK);
  tube(sink, v3(0, 4.1, 0), v3(0, 4.1, 0.45), 0.025, DARK, 4);
  sink.box(v3(0, 4.0, 0.5), 0.16, 0.16, 0.34, paint("#d9dbdc"), { tilt: 0 });
  sink.box(v3(0, 4.0, 0.675), 0.07, 0.07, 0.01, RED);
  return sink;
};

/**
 * A trolleybus pole: steel mast, a bracket over the road towards +z with a hanger, and stubs of
 * the two contact wires along the street (x), lit by sparks of neon markers in 2077.
 */
export const trolleyPole = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.2, 0), 0.14, 8.0, 8, STEEL, true, 0.1);
  tube(sink, v3(0, 7.2, 0), v3(0, 6.9, 4.2), 0.04, STEEL, 5);
  tube(sink, v3(0, 7.8, 0), v3(0, 6.95, 3.4), 0.02, STEEL, 4);
  const wire = paint("#1a1a1c");
  for (const z of [3.9, 4.5]) {
    tube(sink, v3(0, 6.9, z - 0.3), v3(0, 6.55, z), 0.01, wire, 3);
    sink.box(v3(0, 6.5, z), 14, 0.025, 0.025, wire);
  }
  sink.box(v3(0, 6.85, 4.2), 0.08, 0.08, 0.08, glow("#3cf0ff"));
  return sink;
};
