import type { StreetPropKind } from "@seki/core";
import { MeshSink } from "../mesh-sink";
import { busShelter, busStop, cafeGarden, farMonument, fountainJets, kiosk, marketStall, monument, ticketMachine, vendingMachine } from "./prop-civic";
import { farTree, hangingBasket, planter, shrubs, tree } from "./prop-green";
import { glow, paint, v3 } from "./prop-kit";
import { type PropLight, type PropModel, floodlight, lampCandelabra, lampModernPole, lampPark, lampPastoral, lampRoad, lampWallLantern } from "./prop-lamps";
import { PROP_SHAPES } from "./prop-shapes";
import { aFrameSign, advertisingColumn, bench, bikeRack, bikeStation, bollard, bollardChain, cctv, flagpole, graniteBlock, manhole, streetCabinet, streetPlate, trafficSignal, trolleyPole, wasteBin } from "./prop-street";

export type { PropLight, PropModel };

const plain = (sink: MeshSink): PropModel => ({ sink, lights: [] });

/** The detailed model of every kind and shape (ADR-0047), in its own frame: front +z, foot at the origin. */
const MODELS: Readonly<Record<StreetPropKind, (shape: number) => PropModel>> = {
  "lamp-pastoral": () => lampPastoral(),
  "lamp-wall-lantern": (s) => lampWallLantern(s),
  "lamp-candelabra": () => lampCandelabra(),
  "lamp-modern-pole": () => lampModernPole(),
  "lamp-road": () => lampRoad(),
  "lamp-park": () => lampPark(),
  floodlight: () => floodlight(),
  bench: (s) => plain(bench(s)),
  bollard: () => plain(bollard()),
  tree: (s) => plain(tree(s)),
  shrubs: () => plain(shrubs()),
  planter: () => plain(planter()),
  "hanging-basket": () => plain(hangingBasket()),
  "waste-bin": (s) => plain(wasteBin(s)),
  "bike-rack": () => plain(bikeRack()),
  "bike-station": () => plain(bikeStation()),
  "advertising-column": (s) => plain(advertisingColumn(s)),
  "a-frame-sign": () => plain(aFrameSign()),
  "street-plate": () => plain(streetPlate()),
  "street-cabinet": () => plain(streetCabinet()),
  manhole: () => plain(manhole()),
  "granite-block": () => plain(graniteBlock()),
  flagpole: (s) => plain(flagpole(s)),
  "traffic-signal": () => plain(trafficSignal()),
  "bus-shelter": () => plain(busShelter()),
  "bus-stop": () => plain(busStop()),
  "ticket-machine": () => plain(ticketMachine()),
  "vending-machine": (s) => plain(vendingMachine(s)),
  kiosk: () => plain(kiosk()),
  "cafe-garden": (s) => plain(cafeGarden(s)),
  "market-stall": (s) => plain(marketStall(s)),
  "trolley-pole": () => plain(trolleyPole()),
  "fountain-jets": () => plain(fountainJets()),
  monument: (s) => plain(monument(s)),
  artwork: (s) => plain(monument(s)),
  cctv: () => plain(cctv()),
};

/** Every kind of the contract, in the order of `StreetPropKind` (the gallery's row). */
export const PROP_KINDS = Object.keys(MODELS) as StreetPropKind[];

const cache = new Map<string, PropModel>();

/** Builds a kind's shape afresh (tests: the same shape gives the same geometry). */
export const buildPropModel = (kind: StreetPropKind, shape: number): PropModel => MODELS[kind](shape % (PROP_SHAPES[kind] ?? 1));

/** The detailed model of a kind's shape; built once, the same for the same shape. */
export const propModel = (kind: StreetPropKind, shape: number): PropModel => {
  const s = shape % (PROP_SHAPES[kind] ?? 1);
  const key = `${kind}:${s}`;
  let m = cache.get(key);
  if (!m) {
    m = buildPropModel(kind, s);
    cache.set(key, m);
  }
  return m;
};

const chains = new Map<number, MeshSink>();

/** A bollard's chain ending `end` metres from the post (G-032), built once per centimetre. */
export const chainModel = (end: number): MeshSink => {
  const cm = Math.round(end * 100);
  let m = chains.get(cm);
  if (!m) {
    m = bollardChain(cm / 100);
    chains.set(cm, m);
  }
  return m;
};

/** A far lamp: a post up to its highest light and a lit block at every light. */
const farLamp = (model: PropModel, wall: boolean): MeshSink => {
  const sink = new MeshSink();
  const top = Math.max(...model.lights.map((l) => l.at.y));
  if (!wall) sink.box(v3(0, top / 2 - 0.1, 0), 0.16, top + 0.2, 0.16, paint("#1c1e22"), { bottom: false });
  for (const l of model.lights) {
    if (Math.hypot(l.at.x, l.at.z) > 0.2) sink.box(v3(l.at.x / 2, l.at.y + 0.25, l.at.z / 2), Math.abs(l.at.x) + 0.08, 0.08, Math.abs(l.at.z) + 0.08, paint("#1c1e22"));
    sink.box(l.at, 0.32, 0.36, 0.32, glow(l.color));
  }
  return sink;
};

/**
 * The simplified model of tall kinds for the far mesh (trees, lamps, monuments, masts), or null
 * for kinds that are not drawn far away.
 */
export const farModel = (kind: StreetPropKind, shape: number): MeshSink | null => {
  if (kind === "tree") return farTree(shape);
  if (kind.startsWith("lamp-")) return farLamp(propModel(kind, shape), kind === "lamp-wall-lantern");
  if (kind === "monument") return farMonument(shape);
  if (kind === "flagpole" || kind === "trolley-pole") {
    const h = kind === "flagpole" ? (shape === 1 ? 35 : 8.5) : 8;
    const sink = new MeshSink();
    sink.box(v3(0, h / 2 - 0.1, 0), 0.2, h + 0.2, 0.2, paint("#9ca1a7"), { bottom: false });
    return sink;
  }
  return null;
};
