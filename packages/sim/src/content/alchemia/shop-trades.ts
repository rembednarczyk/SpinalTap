import { type Fit, type Layout, type Slot, block, cartons, cup, detail, draw, glassCase, litter, model, rail, screen, shelves, shopHash } from "./shop-fittings";

/*
 * Each trade's fittings on its shop's layout (ADR-0093 O2): what stands on the wall racks' places, the
 * island, the window display and behind the counter, which models of the game's it takes (drinks
 * machines, cash machines, street cabinets as servers and safes, ticket machines as a crypto
 * exchange's terminals, shrubs as plastic flowers) and the mark of somebody just gone
 * (`docs/zasady-lokacji.md` §5). Technique next to poverty (§3): a lit glass case beside cartons.
 */

const slot = (u0: number, u1: number, v0: number, v1: number): Slot => ({ u0, u1, v0, v1 });
const mid = (s: Slot) => ({ u: (s.u0 + s.u1) / 2, v: (s.v0 + s.v1) / 2 });

/** A small terminal on a top: its screen lit, red with an error when `error` (somebody walked off from it). */
const terminal = (k: Fit, u: number, v: number, top: number, error: boolean): void => {
  draw(k, slot(u - 0.18, u + 0.18, v - 0.12, v + 0.12), top, top + 0.03, "machine");
  draw(k, slot(u - 0.17, u + 0.17, v - 0.03, v + 0.03), top + 0.03, top + 0.3, error ? "error" : "display");
  if (error) k.traces.push("terminal left on an error");
};

/** A cable from the ceiling down to a point on a top: the services' kit taped on (§3). */
const drop = (k: Fit, u: number, v: number, from: number): void => draw(k, slot(u - 0.015, u + 0.015, v - 0.015, v + 0.015), from, k.c - k.y - 0.1, "cable");

/** The counter with the till on it, a cable down to it, a cup by it; bars over it for the trades that keep money or guns. */
const counter = (k: Fit, L: Layout, trace: string, grille: boolean): void => {
  const c = L.counter;
  draw(k, c, 0, 1.0, "counter", true);
  const along = L.side ? { u: (c.u0 + c.u1) / 2, v: c.v0 + 0.45 } : { u: c.u1 - 0.45, v: (c.v0 + c.v1) / 2 };
  terminal(k, along.u, along.v, 1.0, trace === "error");
  drop(k, along.u, along.v, 1.3);
  const cupAt = L.side ? { u: (c.u0 + c.u1) / 2, v: c.v1 - 0.3 } : { u: c.u0 + 0.35, v: (c.v0 + c.v1) / 2 };
  cup(k, cupAt, 1.0, trace === "cup");
  if (trace === "meal") {
    draw(k, slot(cupAt.u + 0.12, cupAt.u + 0.34, cupAt.v - 0.1, cupAt.v + 0.1), 1.0, 1.07, "goods");
    draw(k, slot(cupAt.u + 0.14, cupAt.u + 0.4, cupAt.v + 0.11, cupAt.v + 0.13), 1.0, 1.01, "rack");
    k.traces.push("unfinished meal");
  }
  if (trace === "clothes") {
    draw(k, slot(c.u0 + 0.7, c.u0 + 1.3, c.v0 + 0.05, c.v1 - 0.05), 1.0, 1.06, "goods");
    k.traces.push("clothes left on the counter");
  }
  if (grille) {
    const bars = L.side ? slot(c.u0, c.u0 + 0.06, c.v0, c.v1) : slot(c.u0, c.u1, c.v0, c.v0 + 0.06);
    draw(k, bars, 1.0, 2.3, "grille", true);
  }
};

/** Wall screens over a rack's place, `n` of them along it, on its partition. */
const wallScreens = (k: Fit, s: Slot, n: number): void => {
  const alongU = s.u1 - s.u0 >= s.v1 - s.v0;
  const len = alongU ? s.u1 - s.u0 : s.v1 - s.v0;
  const wall = alongU ? (s.v0 < 1 ? slot(s.u0, s.u1, s.v0, s.v0 + 0.05) : slot(s.u0, s.u1, s.v1 - 0.05, s.v1)) : s.u0 < 1 ? slot(s.u0, s.u0 + 0.05, s.v0, s.v1) : slot(s.u1 - 0.05, s.u1, s.v0, s.v1);
  for (let i = 0; i < n; i++) {
    const a = (len * (i + 0.12)) / n;
    const b = (len * (i + 0.88)) / n;
    screen(k, alongU ? { ...wall, u0: s.u0 + a, u1: s.u0 + b } : { ...wall, v0: s.v0 + a, v1: s.v0 + b }, 2.15, 2.75);
  }
};

/** A tattoo chair: its seat a solid, its back up, the lamp's arm over it. */
const tattooChair = (k: Fit, s: Slot): void => {
  draw(k, slot(s.u0 + 0.2, s.u1 - 0.2, s.v0, s.v1), 0, 0.6, "bench", true);
  draw(k, slot(s.u0 + 0.2, s.u1 - 0.2, s.v1 - 0.25, s.v1), 0.6, 1.15, "bench", true);
  draw(k, slot(s.u1 - 0.1, s.u1 - 0.05, s.v0 + 0.1, s.v0 + 0.15), 0, 1.9, "rack");
  draw(k, slot((s.u0 + s.u1) / 2 - 0.15, s.u1 - 0.05, s.v0 + 0.1, s.v0 + 0.15), 1.85, 1.9, "rack");
  draw(k, slot((s.u0 + s.u1) / 2 - 0.15, (s.u0 + s.u1) / 2 + 0.05, s.v0 + 0.05, s.v0 + 0.2), 1.72, 1.85, "lamp");
};

/** A VR booth: a cabin 1.1 m square, its screen lit through the open front, a headset on the hook. */
const vrBooth = (k: Fit, s: Slot): void => {
  draw(k, s, 0, 2.3, "machine", true);
  draw(k, slot(s.u0 + 0.1, s.u1 - 0.1, s.v0 - 0.02, s.v0), 0.6, 2.0, "display");
  draw(k, slot(s.u0, s.u1, s.v0 - 0.03, s.v0), 2.15, 2.25, "lamp");
};

/** A workbench of the repair trade: a table, an open terminal in pieces on it, a lamp, cables. */
const workbench = (k: Fit, s: Slot): void => {
  draw(k, s, 0, 0.9, "table", true);
  const m = mid(s);
  terminal(k, m.u - 0.3, m.v, 0.9, false);
  draw(k, slot(m.u + 0.1, m.u + 0.45, m.v - 0.2, m.v + 0.15), 0.9, 0.98, "machine");
  draw(k, slot(m.u + 0.15, m.u + 0.4, m.v - 0.15, m.v + 0.1), 0.98, 1.0, "goods");
  drop(k, m.u, m.v, 0.95);
};

/** Mannequins in a window, dressed, facing the gallery (Blender's, drawn), each its stand's box a solid. */
const mannequins = (k: Fit, s: Slot): void => {
  for (let u = s.u0 + 0.45; u < s.u1 - 0.3; u += 0.95) {
    const v = (s.v0 + s.v1) / 2;
    block(k, slot(u - 0.18, u + 0.18, v - 0.15, v + 0.15), 1.8);
    detail(k, "rd-gl-mannequin", u, v, 0, "out");
  }
};

/** Shrubs of the game's as plastic flowers on a plinth (the plinth solid), buckets of them on the floor. */
const flowers = (k: Fit, s: Slot, key: number): void => {
  draw(k, s, 0, 0.45, "counter", true);
  const alongU = s.u1 - s.u0 >= s.v1 - s.v0;
  const len = alongU ? s.u1 - s.u0 : s.v1 - s.v0;
  for (let a = 0.3; a < len - 0.2; a += 0.55) {
    const g = shopHash(k.shop.id, key, a * 10);
    const p = alongU ? { u: s.u0 + a, v: (s.v0 + s.v1) / 2 } : { u: (s.u0 + s.u1) / 2, v: s.v0 + a };
    model(k, "shrubs", p.u, p.v, "out", (Math.floor(g * 4096) & 0x0f0f) | 0x10, 0.45);
  }
};

/** A row of the game's models along a slot, `step` apart. */
const row = (k: Fit, s: Slot, prop: Parameters<typeof model>[1], step: number, to: Parameters<typeof model>[4], variant: (i: number) => number): void => {
  const alongU = s.u1 - s.u0 >= s.v1 - s.v0;
  const len = alongU ? s.u1 - s.u0 : s.v1 - s.v0;
  const n = Math.max(1, Math.floor(len / step));
  for (let i = 0; i < n; i++) {
    const a = (len * (i + 0.5)) / n;
    const p = alongU ? { u: s.u0 + a, v: (s.v0 + s.v1) / 2 } : { u: (s.u0 + s.u1) / 2, v: s.v0 + a };
    model(k, prop, p.u, p.v, to, variant(i));
  }
};

/** Which mark of somebody just gone each trade leaves (§5): it fits who works there. */
const TRACE: Readonly<Record<Fit["shop"]["trade"], string>> = {
  implants: "error",
  electronics: "error",
  clothing: "clothes",
  pharmacy: "spill",
  arms: "cup",
  repair: "error",
  pawn: "meal",
  tattoo: "cup",
  "synth-food": "spill",
  vr: "error",
  crypto: "error",
  florist: "cup",
};

/** The fittings of a shop's sales floor by its trade (open or shut alike: a shut one is dark). */
export const fitTrade = (k: Fit, L: Layout, w: number, s: number): void => {
  const t = k.shop.trade;
  const trace = k.shop.state === "open" || k.shop.state === "grille" ? TRACE[t] : "none";
  counter(k, L, trace, t === "arms" || t === "pawn" || t === "crypto");
  const wallRack = (r: Slot | null, backAt: "u0" | "u1", key: number) => {
    if (!r) return;
    if (t === "clothing") rail(k, r, key);
    else if (t === "crypto") row(k, r, "ticket-machine", 1.0, backAt === "u0" ? "+u" : "-u", () => 0);
    else shelves(k, r, t === "tattoo" ? 1.2 : 2.0, backAt, key);
    if (t === "electronics" || t === "implants" || t === "tattoo" || t === "vr" || t === "arms") wallScreens(k, r, Math.max(1, Math.round((r.v1 - r.v0) / 1.3)));
  };
  wallRack(L.leftRack, "u0", 1);
  wallRack(L.rightRack, "u1", 2);
  L.islands.forEach((i, n) => {
    if (t === "clothing") rail(k, i, 10 + n);
    else if (t === "tattoo") tattooChair(k, i);
    else if (t === "vr") for (let u = i.u0; u + 1.1 <= i.u1 + 0.05; u += 1.25) vrBooth(k, slot(u, u + 1.1, i.v0, i.v0 + 1.1));
    else if (t === "repair") workbench(k, i);
    else if (t === "florist") flowers(k, i, 10 + n);
    else if (t === "implants" || t === "pawn" || t === "arms" || t === "pharmacy" || t === "crypto") glassCase(k, i, 10 + n);
    else shelves(k, i, 1.4, "v1", 10 + n);
  });
  if (L.window) {
    const wd = L.window;
    if (t === "clothing") mannequins(k, wd);
    else if (t === "florist") flowers(k, wd, 20);
    else if (t === "synth-food" && wd.u1 - wd.u0 >= 1.0) row(k, slot(wd.u0, wd.u1, 0.2, 0.96), "vending-machine", 1.05, "in", (i) => i);
    // A screen on a stand in the window, its back to the gallery: the studio's flash, the booths' worlds.
    else if (t === "vr" || t === "tattoo") {
      const m = (wd.u0 + wd.u1) / 2;
      draw(k, slot(m - 0.04, m + 0.04, 0.34, 0.42), 0, 1.15, "rack", true);
      draw(k, slot(m - 0.3, m + 0.3, 0.2, 0.56), 0, 0.05, "rack");
      screen(k, slot(m - 0.55, m + 0.55, 0.3, 0.34), 1.15, 1.85);
    }
    // The exchange's cash machines in its window, their fronts to the customers inside.
    else if (t === "crypto") row(k, slot(wd.u0, wd.u1, 0.15, 0.75), "atm", 0.9, "in", () => 0);
    else glassCase(k, wd, 20);
  }
  if (L.back) {
    if (t === "implants" || t === "repair" || t === "vr" || t === "arms" || t === "electronics") row(k, slot(L.back.u0, L.back.u1, s - 0.38, s - 0.02), "street-cabinet", 0.9, "out", () => 0);
    else shelves(k, L.back, 2.2, "v1", 30);
  } else if (!L.side) {
    // A shallow shop: cabinets high on the back wall over the seller's head (drawn only), a light under them, cartons at the counter's ends.
    const top = slot(L.counter.u0, L.counter.u1, s - 0.35, s);
    // Lower under a low ceiling (L1's under L2's slab, ADR-0093 O5): the goods on them a hand under it.
    const room = k.c - k.y;
    const cab = Math.min(2.75, room - 0.45);
    draw(k, top, 1.95, cab, "rack");
    draw(k, { ...top, v0: s - 0.33, v1: s - 0.27 }, 1.92, 1.95, "lamp");
    for (let u = top.u0 + 0.1, i = 0; u < top.u1 - 0.3; u += 0.45, i++) if (shopHash(k.shop.id, 45, i) > 0.3) draw(k, slot(u, u + 0.3, s - 0.3, s - 0.05), cab, Math.min(cab + 0.15 + shopHash(k.shop.id, i, 45) * 0.2, room - 0.05), "goods");
    for (const [i, u] of [L.counter.u0 + 0.35, L.counter.u1 - 0.35].entries()) cartons(k, { u, v: s - 0.3 }, 2, 40 + i);
  }
  if (trace === "spill") {
    const at = { u: (L.aisle.u0 + L.aisle.u1) / 2 + 0.4, v: L.counter.v0 - 0.4 };
    draw(k, slot(at.u - 0.25, at.u + 0.15, at.v - 0.2, at.v + 0.2), 0, 0.12, "carton");
    for (let i = 0; i < 6; i++) {
      const g = shopHash(k.shop.id, 50, i);
      draw(k, slot(at.u + 0.15 + g * 0.5, at.u + 0.22 + g * 0.5, at.v - 0.3 + i * 0.1, at.v - 0.25 + i * 0.1), 0, 0.04, "goods");
    }
    k.traces.push("a carton dropped and spilled");
  }
  litter(k, { u: (L.door.u0 + L.door.u1) / 2, v: 0.6 }, 3, 60);
};
