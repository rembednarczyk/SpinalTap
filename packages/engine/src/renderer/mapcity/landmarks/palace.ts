import { groundY } from "@seki/sim";
import type { MeshSink, Rgba } from "../../mesh-sink";
import { type Wall, trimMeta } from "../facade-frame";
import { type Uv } from "../sink-ops";
import { courseAndKeystones, rustication } from "./classicist";
import { alongWall } from "./elevation";
import { SWATCH, archPanel, onWall, panel, shownWalls, solid } from "./kit";
import type { LandmarkFrame } from "./landmark-frame";
import { type PorticoOn, porticoOn, risalitOf } from "./portico";
import type { PalaceFront, WindowHead } from "./recipes";

/**
 * A palace front from the landmark kit (ADR-0062, G-119, Nowy Ratusz): storeys of windows on every
 * shown wall, one row a storey, the ground floor rusticated up to a string course, the windows'
 * heads by storey (square with a sill, round-headed in an arched panel, square under a cornice).
 * On the wall of the data's portico a risalit as wide as the portico, framed by lesenes, its
 * windows in the portico's bays and the main door in the middle bay of the ground floor (a landmark
 * draws its own doors: the street furniture's doors keep off it).
 */

/** A window's width, and its height as a share of its storey (at most `max`), metres. */
export const PALACE_WINDOW = { width: 1.15, share: 0.7, max: 2.3 } as const;

/** Storeys of a palace front: bottom and top of each row (world y), the string course over the ground floor (null without rustication). */
export interface PalaceRows {
  readonly rows: readonly (readonly [number, number])[];
  readonly course: number | null;
}

/**
 * The rows over the walls: from the ground floor (or 1.2 m over a lifted part's foot, over the
 * roof it stands on) to under the frieze, a rusticated ground floor 1.2 times as tall as the others.
 */
export const palaceRows = (f: LandmarkFrame, pf: PalaceFront): PalaceRows => {
  const y0 = f.b.lifted ? f.b.foot + 1.2 : f.b.base;
  const y1 = f.top - (f.b.lifted ? 0.7 : 1.0);
  const shares = pf.rows.map((_, k) => (k === 0 && pf.rusticated ? 1.2 : 1));
  const unit = (y1 - y0) / shares.reduce((a, b) => a + b, 0);
  let y = y0;
  const rows = shares.map((s): [number, number] => {
    const r: [number, number] = [y, y + s * unit];
    y += s * unit;
    return r;
  });
  return { rows, course: pf.rusticated && rows.length > 1 ? (rows[0] as [number, number])[1] : null };
};

/** The portico's balcony floor (world y): the top of the last storey its giant order spans. */
export const balconyFloor = (f: LandmarkFrame, pf: PalaceFront): number => {
  const { rows } = palaceRows(f, pf);
  return (rows[Math.min(pf.giant ?? 1, rows.length) - 1] as [number, number])[1];
};

/** Window axes evenly over [a, b], at most `pitch` apart; none on a stretch under 1.6 m. */
const axesOver = (a: number, b: number, pitch: number): number[] => {
  if (b - a < 1.6) return [];
  const n = Math.max(1, Math.round((b - a) / pitch));
  return Array.from({ length: n }, (_, k) => a + ((b - a) / n) * (k + 0.5));
};

/** The window axes of a wall by row: in the portico's bays on its wall (the door's bay left out on the ground floor), evenly elsewhere. */
export const palaceAxes = (w: Wall, po: PorticoOn | null, pitch: number, row: number): number[] => {
  if (!po || po.w !== w) return axesOver(0.9, w.length - 0.9, pitch);
  const [r0, r1] = risalitOf(po);
  const us = [...po.us].sort((a, b) => a - b);
  const bays = us.slice(1).map((u, k) => (u + (us[k] as number)) / 2);
  const door = doorBay(po);
  return [...axesOver(0.9, r0 - 0.5, pitch), ...bays.filter((u) => row > 0 || u !== door), ...axesOver(r1 + 0.5, w.length - 0.9, pitch)];
};

/** A window at u from y0 to y1 with its head: surround, glass with a mullion and a transom, sill, and the head's panel or cornice. */
const window = (sink: MeshSink, w: Wall, u: number, y0: number, y1: number, head: WindowHead, trim: Rgba, shade: Rgba, dark: Rgba, meta: Uv): void => {
  const hw = PALACE_WINDOW.width / 2;
  if (head === "arched") {
    // The arched panel round the window, a shade darker, down to the sill.
    archPanel(sink, w, u, PALACE_WINDOW.width + 0.7, y0 - 0.2, y1 + 0.35, 0.01, shade, meta, false);
    archPanel(sink, w, u, PALACE_WINDOW.width + 0.24, y0 - 0.1, y1 + 0.12, 0.03, trim, meta, false);
    archPanel(sink, w, u, PALACE_WINDOW.width, y0, y1, 0.06, dark, meta, false);
  } else {
    panel(sink, w, u - hw - 0.14, u + hw + 0.14, y0 - 0.1, y1 + 0.14, 0.03, trim, meta);
    panel(sink, w, u - hw, u + hw, y0, y1, 0.06, dark, meta);
  }
  const transom = head === "arched" ? y1 - hw - 0.02 : y0 + (y1 - y0) * 0.68;
  panel(sink, w, u - 0.03, u + 0.03, y0, transom, 0.09, trim, meta);
  panel(sink, w, u - hw, u + hw, transom - 0.03, transom + 0.03, 0.09, trim, meta);
  panel(sink, w, u - hw - 0.24, u + hw + 0.24, y0 - 0.22, y0 - 0.1, 0.1, trim, meta);
  if (head === "pediment") panel(sink, w, u - hw - 0.3, u + hw + 0.3, y1 + 0.2, y1 + 0.36, 0.13, trim, meta);
};

/** The main door's width and height over the ground under it, metres (Lublin360 2017: a tall double door). */
export const MAIN_DOOR = { width: 1.9, height: 3.3 } as const;

/** The main door in the door's bay: a cream surround, two dark leaves, a fanlight over them (a landmark draws its own doors). */
const mainDoor = (sink: MeshSink, w: Wall, u: number, foot: number, trim: Rgba, meta: Uv): void => {
  const hw = MAIN_DOOR.width / 2;
  const top = foot + MAIN_DOOR.height;
  panel(sink, w, u - hw - 0.25, u + hw + 0.25, foot - 0.2, top + 0.3, 0.03, trim, meta);
  panel(sink, w, u - hw, u + hw, foot - 0.2, top - 0.75, 0.05, solid(SWATCH.door), meta);
  panel(sink, w, u - 0.025, u + 0.025, foot - 0.2, top - 0.75, 0.07, solid(SWATCH.opening), meta);
  panel(sink, w, u - hw, u + hw, top - 0.7, top, 0.05, solid(SWATCH.opening), meta);
  panel(sink, w, u - hw, u + hw, top - 0.75, top - 0.7, 0.07, trim, meta);
};

/** The door's bay on the portico's wall: the bay nearest the risalit's middle. */
export const doorBay = (po: PorticoOn): number => {
  const us = [...po.us].sort((a, b) => a - b);
  const bays = us.slice(1).map((u, k) => (u + (us[k] as number)) / 2);
  const [r0, r1] = risalitOf(po);
  const mid = (r0 + r1) / 2;
  return bays.reduce((best, u) => (Math.abs(u - mid) < Math.abs(best - mid) ? u : best), bays[0] ?? mid);
};

/** Lesenes framing the risalit on the portico's wall, from y0 to y1. */
const lesenes = (sink: MeshSink, po: PorticoOn, y0: number, y1: number, color: Rgba): void => {
  for (const u of risalitOf(po)) {
    const c = onWall(po.w, u, (y0 + y1) / 2, 0.1);
    sink.box(c, 0.7, y1 - y0, 0.2, color, { rotY: alongWall(po.w), bottom: false });
  }
};

/**
 * The palace front of a tier: rustication up to the string course, the rows of windows on the
 * shown walls clear of the neighbours (`clear`), the risalit's lesenes on the portico's wall.
 * Returns the string course's world y (null without one): the portico's balcony stands on it.
 */
export const palaceFront = (sink: MeshSink, f: LandmarkFrame, pf: PalaceFront, clear: (w: Wall, u0: number, u1: number) => boolean): number | null => {
  const meta = trimMeta(f.style.seed);
  const trim = solid(SWATCH.cream);
  const { rows, course } = palaceRows(f, pf);
  if (course !== null) {
    rustication(sink, f, course, solid(SWATCH.sandJoint));
    courseAndKeystones(sink, f, course, trim);
  }
  const po = porticoOn(f);
  const shade = solid(SWATCH.sandPanel);
  const dark = solid(SWATCH.opening);
  const hw = PALACE_WINDOW.width / 2 + 0.4;
  for (const w of shownWalls(f)) {
    rows.forEach(([r0, r1], k) => {
      const height = Math.min(PALACE_WINDOW.max, (r1 - r0) * PALACE_WINDOW.share);
      const y0 = (r0 + r1) / 2 - height / 2 - (k === 0 ? 0.15 : 0);
      if (height < 0.8) return;
      for (const u of palaceAxes(w, po, pf.pitch, k)) if (clear(w, u - hw, u + hw)) window(sink, w, u, y0, y0 + height, pf.rows[k] as WindowHead, trim, shade, dark, meta);
    });
  }
  if (po) {
    lesenes(sink, po, course ?? f.b.base, f.top - 0.55, trim);
    const u = doorBay(po);
    const at = onWall(po.w, u, 0, 0.3);
    mainDoor(sink, po.w, u, groundY(at.x, at.z), trim, meta);
  }
  return course;
};
