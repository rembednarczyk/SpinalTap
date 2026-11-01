import { type StreetPropItem, type ViewDescriptor, doorLayout } from "../../../packages/core/src";
import { type FacadeFrame, type Wall, frameWallMeta, hiddenWall } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { S7_DOORS } from "../../../packages/sim/src/content/interiors";
import { shaderGlass } from "../../../packages/engine/test/facade-glass-mask";
import { PASSAGES } from "../../../packages/sim/src/content/lublin/sites";
import { surfaceY } from "../../../packages/sim/src/content/lublin/terrain";
import type { BoardSpan } from "../../osm-import/src/props-boards.ts";
import { type DrawnView, cityFrames } from "../../osm-import/src/venue-boards.ts";

/**
 * The doors on the facades of ADR-0058 stage 9 checked against what the game draws, not against the
 * generator's rules (`props-doors.ts`) or the renderer's slots (`door-slots.ts`): the building walls
 * as the renderer frames them, the panes the facade shader paints (its glass mask as
 * `packages/engine/test/facade-glass-mask.ts` ports it from `npr/toon-city.ts`, the GLSL's text pinned
 * in `facade-glass-pin.test.ts`), the venues' boards, the passages and the game's doors, and the paving
 * the renderer draws. A rule that drifts from the drawing shows here.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** How far a door's back may stand off the wall's face (m), and its facing off the wall's normal (rad). */
const OFF_FACE = 0.06;
const OFF_NORMAL = 0.05;
/** How far its foot may stand off the paving under its middle (m), and a jamb's foot (on a slope's fall). */
const OFF_FOOT = 0.05;
const OFF_JAMB = 0.15;
/** How close to a game's door, and to a passage's side, a door may come (m). */
const GAME_DOOR = 2;
const PASSAGE = 0.3;

const near = (p: Pt): string => `${p.x.toFixed(0)},${p.z.toFixed(0)}`;
interface DoorOnWall {
  readonly item: StreetPropItem;
  readonly frame: FacadeFrame;
  readonly wall: Wall;
  /** Along the wall from `a` to the door's middle, its half width, its foot and top over the ground floor. */
  readonly u: number;
  readonly half: number;
  readonly foot: number;
  readonly top: number;
}

const segGap = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
};

/** The drawn wall a door stands on: its back's middle and both jambs within `OFF_FACE` of the wall's face, facing out along its normal; or null. */
export const wallOf = (frames: readonly FacadeFrame[], i: StreetPropItem): DoorOnWall | null => {
  const d = doorLayout(i.variant);
  const half = d.width / 2;
  for (const f of frames) {
    for (const w of f.walls) {
      if (w.blind || hiddenWall(f, w)) continue;
      const dx = (w.b.x - w.a.x) / w.length;
      const dz = (w.b.z - w.a.z) / w.length;
      const u = (i.x - w.a.x) * dx + (i.z - w.a.z) * dz;
      const off = (i.x - w.a.x) * w.nx + (i.z - w.a.z) * w.nz;
      const turn = Math.abs(Math.atan2(Math.sin(i.yaw - Math.atan2(w.nx, w.nz)), Math.cos(i.yaw - Math.atan2(w.nx, w.nz))));
      if (Math.abs(off) <= OFF_FACE && u - half >= -1e-6 && u + half <= w.length + 1e-6 && turn <= OFF_NORMAL) return { item: i, frame: f, wall: w, u, half, foot: i.y - f.b.base, top: i.y + d.height - f.b.base };
    }
  }
  return null;
};

/** World point on a wall `u` along it and `out` in front. */
const pointOn = (w: Wall, u: number, out = 0): Pt => ({ x: w.a.x + ((w.b.x - w.a.x) * u) / w.length + w.nx * out, z: w.a.z + ((w.b.z - w.a.z) * u) / w.length + w.nz * out });

/** What the shader paints right beside a door's jambs at its height, and right over its top along it. */
export const glassAround = (d: DoorOnWall): ("pane" | "gate")[] => {
  const meta = frameWallMeta(d.frame, d.wall);
  const out: ("pane" | "gate")[] = [];
  for (let y = Math.max(d.foot, 0) + 0.05; y < d.top - 0.01; y += 0.05) {
    for (const x of [d.u - d.half - 0.02, d.u + d.half + 0.02]) {
      const g = shaderGlass({ x, y }, meta);
      if (g) out.push(g);
    }
  }
  for (let x = d.u - d.half + 0.02; x < d.u + d.half - 0.01; x += 0.05) {
    const over = shaderGlass({ x, y: d.top + 0.02 }, meta);
    const under = shaderGlass({ x, y: d.top - 0.02 }, meta);
    // A pane, or the gate's passage, running on over the door's top (the door covers its lower part only).
    if (over && under) out.push(over);
  }
  return out;
};

/** The doors among the city's street furniture and the checks on them, baseline 0. */
export const doorChecks = (views: readonly DrawnView[], all: readonly StreetPropItem[], boards: readonly BoardSpan[]): Record<string, () => Finding[]> => {
  let memo: { doors: StreetPropItem[]; on: Map<StreetPropItem, DoorOnWall | null> } | null = null;
  const data = () => {
    if (memo) return memo;
    const frames = cityFrames(views)
      .filter((b) => !b.landmark)
      .map((b) => b.frame);
    const doors = all.filter((i) => i.prop === "door");
    memo = { doors, on: new Map(doors.map((i) => [i, wallOf(frames, i)])) };
    return memo;
  };
  const each = (test: (i: StreetPropItem, on: DoorOnWall | null) => string | null): Finding[] =>
    data().doors.flatMap((i) => {
      const what = test(i, data().on.get(i) ?? null);
      return what ? [{ at: near(i), what: `door ${what}` }] : [];
    });
  const gameDoors: [Pt, Pt][] = [
    ...S7_DOORS.map((d) => (d.along === "x" ? [{ x: d.at.x - d.width / 2, z: d.at.z }, { x: d.at.x + d.width / 2, z: d.at.z }] : [{ x: d.at.x, z: d.at.z - d.width / 2 }, { x: d.at.x, z: d.at.z + d.width / 2 }]) as [Pt, Pt]),
    ...views.flatMap(({ view, at }) => (view.kind === "building" ? (view as Extract<ViewDescriptor, { kind: "building" }>).doorways ?? [] : []).map((d) => [{ x: d.at.x + at.x, z: d.at.z + at.z }, { x: d.at.x + at.x, z: d.at.z + at.z }] as [Pt, Pt])),
  ];
  return {
    /** A door not on a drawn wall: its back off the face, a jamb past the wall's end, or turned off its normal. */
    "door-off-wall": () => each((_, on) => (on ? null : "not flat on a drawn wall")),
    /** A door whose foot is off the paving drawn under it (in the air or sunk), at its middle or a jamb. */
    "door-floating": () =>
      each((i, on) => {
        if (!on) return null;
        const at = (u: number, out: number) => {
          const q = pointOn(on.wall, u, out);
          return surfaceY(q.x, q.z);
        };
        const under = at(on.u, 0.1);
        const jambs = [-1, 1].map((s) => at(on.u + s * on.half, 0.1));
        if (Math.abs(i.y - under) > OFF_FOOT) return `foot ${i.y.toFixed(2)} over the paving under it ${under.toFixed(2)}`;
        const worst = Math.max(...jambs.map((y) => Math.abs(y - i.y)));
        return worst > OFF_JAMB ? `a jamb ${worst.toFixed(2)} m off the paving` : null;
      }),
    /** A door half over a pane the shader paints: a pane beside it at its height or running on over its top. */
    "door-in-window": () =>
      each((_, on) => {
        const g = on ? glassAround(on).filter((x) => x === "pane").length : 0;
        return g > 0 ? `${g} samples of a pane round it` : null;
      }),
    /** A door reaching into a venue's board over it (ADR-0064 stage 4). */
    "door-in-board": () =>
      each((i, on) => {
        if (!on) return null;
        const top = i.y + doorLayout(i.variant).height;
        const a = pointOn(on.wall, on.u - on.half);
        const b = pointOn(on.wall, on.u + on.half);
        const w = on.wall;
        const hit = boards.find((s) => s.nx * w.nx + s.nz * w.nz > 0.9 && Math.abs((s.a.x - a.x) * w.nx + (s.a.z - a.z) * w.nz) < 0.3 && overlaps(a, b, s.a, s.b) && top > s.bottom + 1e-3);
        return hit ? `top ${top.toFixed(2)} over the board "${hit.text}" from ${hit.bottom.toFixed(2)}` : null;
      }),
    /** A door in a passage through a building (ADR-0048) or over the gate a tenement's facade may paint. */
    "door-in-passage": () =>
      each((i, on) => {
        const p = PASSAGES.find((x) => segGap(i, x.from, x.to) < x.width / 2 + doorLayout(i.variant).width / 2 + PASSAGE);
        if (p) return `in the passage of ${p.building}`;
        return on && glassAround(on).includes("gate") ? "over a tenement's gate" : null;
      }),
    /** A door within 2 m of the game's own doors (ADR-0038, the interiors' doorways): it would double one. */
    "door-on-game-door": () =>
      each((i) => {
        const g = gameDoors.find(([a, b]) => segGap(i, a, b) < GAME_DOOR);
        return g ? `beside the game's door at ${near(g[0])}` : null;
      }),
  };
};

/** Do the spans a..b and c..d of one wall line overlap? */
const overlaps = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const t = (p: Pt) => ((p.x - a.x) * dx + (p.z - a.z) * dz) / len;
  const [c0, c1] = [t(c), t(d)].sort((x, y) => x - y) as [number, number];
  return c0 < len && c1 > 0;
};
