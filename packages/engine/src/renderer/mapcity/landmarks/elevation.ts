import type { MeshSink, Rgba } from "../../mesh-sink";
import { type FacadeFrame, type Wall, trimMeta } from "../facade-frame";
import { onWall, panel } from "./kit";

/**
 * The kit's elements of an elevation drawn after the photograph (ADR-0062, T-032, T-033): the
 * octagon's gallery. Baked in world space into the cell's sink like the rest of the kit.
 */

/** The gallery's floor over the tier's foot (on the skirt roof under it), depth, rail and the door behind it, metres. */
export const GALLERY = { floor: 0.9, depth: 0.5, rail: 0.9, door: 0.95 } as const;

/** Turn of a box whose width runs along the wall. */
export const alongWall = (w: Wall): number => Math.atan2(-(w.b.z - w.a.z), w.b.x - w.a.x);

/** A gallery along the wall at the tier's foot: a slab, balusters under a rail, and a dark door behind it. */
export const gallery = (sink: MeshSink, f: FacadeFrame, w: Wall, white: Rgba, dark: Rgba): void => {
  const rotY = alongWall(w);
  const y = f.b.foot + GALLERY.floor;
  const d = GALLERY.depth;
  const len = w.length - 0.1;
  panel(sink, w, w.length / 2 - 0.4, w.length / 2 + 0.4, y, y + GALLERY.door, 0.02, dark, trimMeta(f.style.seed));
  sink.box(onWall(w, w.length / 2, y - 0.06, d / 2), len, 0.12, d, white, { rotY });
  sink.box(onWall(w, w.length / 2, y + GALLERY.rail, d - 0.05), len, 0.08, 0.1, white, { rotY });
  for (const u of [0.1, w.length - 0.1]) sink.box(onWall(w, u, y + GALLERY.rail, d / 2), 0.08, 0.08, d, white, { rotY });
  const n = Math.max(2, Math.floor(len / 0.22));
  for (let k = 0; k <= n; k++) sink.box(onWall(w, 0.1 + ((w.length - 0.2) * k) / n, y + GALLERY.rail / 2, d - 0.05), 0.07, GALLERY.rail - 0.04, 0.07, white, { rotY, bottom: false });
};
