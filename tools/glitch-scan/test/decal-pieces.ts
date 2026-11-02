import { DECAL_KINDS, DRAIN_GRATE, HOUSE_PLATE, doorLayout, STICKER_HOSTS, type StreetPropItem, WALL_DECALS, grateLayout, graffitiLayout, hostFaces, plateLayout, stickerLayout } from "../../../packages/core/src";
import { type Wall, frameWallMeta, hiddenWall, plinthBand } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { shaderGlass } from "../../../packages/engine/test/facade-glass-mask";
import { holoMayHang, shopBoardHeight, shopBoardOn } from "../../../packages/engine/src/renderer/mapcity/sign-plan";
import { type CrossingBand, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands";
import type { BoardSpan } from "../../osm-import/src/props-boards.ts";
import { type DrawnView, type FramedBuilding, cityFrames } from "../../osm-import/src/venue-boards.ts";

/**
 * The decals of ADR-0058 stage 6 checked against what the game draws, not against the generator's
 * rules (`props-decals.ts`, `props-decals-street.ts`): the building walls as the renderer frames
 * them, whether the facade shader paints glass on a wall at all (its `facadeGlass` returns nothing
 * for a wall whose storey decodes under 0.05, and nothing under the ground floor's line), the
 * venues' boards, shop boards and holo-ads, the passages, the hosts among the furniture, the drawn
 * carriageways, sidewalks and crossings and the ground. A rule that drifts from the drawing shows here.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** How far a wall decal's foot may stand off the wall's face (m), and its facing off the wall's normal (rad). */
const OFF_FACE = 0.03;
const OFF_NORMAL = 0.02;
/** How far over a grate's corners the terrain may run off its plane (m): its underside stays under the road, its top over it. */
const OFF_PLANE = 0.012;
/** How far the corners look out of the wall for a neighbour (m), and a passage's reach past its half width. */
const LOOK_OUT = 0.05;
const PASSAGE_ROOM = 1;
/** A grate's kerb side must meet the road's edge within this (m). */
const KERB_REACH = 0.12;

const near = (p: Pt): string => `${p.x.toFixed(1)},${p.z.toFixed(1)}`;

/** What the checks need besides the pieces: the ground and the map round them. */
export interface DecalWorld {
  readonly views: readonly DrawnView[];
  readonly boards: readonly BoardSpan[];
  readonly passages: readonly {
    readonly from: Pt;
    readonly to: Pt;
    readonly width: number;
  }[];
  /** Outlines of the drawn carriageways, sidewalks and crossings. */
  readonly roads: readonly (readonly Pt[])[];
  readonly sidewalks: readonly (readonly Pt[])[];
  readonly crossings: readonly CrossingBand[];
  /** The ground the game puts the furniture on, and the paving drawn. */
  readonly groundY: (x: number, z: number) => number;
  readonly surfaceY: (x: number, z: number) => number;
  /** The district of a point, the map's tags of the building at its entity's place, a road lamp drawn as a utility pole there. */
  readonly districtAt: (p: Pt) => string;
  readonly tagsAt: (at: Pt) => Readonly<Record<string, string>>;
  readonly poleLamp: (p: Pt) => boolean;
  /** The renderer's block of the street furniture a point is in (one mesh each). */
  readonly blockOf: (p: Pt) => string;
}

const inRing = (p: Pt, ring: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

const segGap = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
};

/** A wall decal on its wall: the building, the wall, its middle along it, its half width, its bottom and top (world y). */
interface OnWall {
  readonly b: FramedBuilding;
  readonly wall: Wall;
  readonly u: number;
  readonly half: number;
  readonly bottom: number;
  readonly top: number;
}

/** A wall decal's span: its width, bottom and top (world y) from its layout. */
export const wallSpan = (i: StreetPropItem): { half: number; bottom: number; top: number } => {
  if (i.prop === "graffiti") {
    const g = graffitiLayout(i.variant);
    return {
      half: g.width / 2,
      bottom: i.y + g.lift,
      top: i.y + g.lift + g.height,
    };
  }
  const p = plateLayout(i.variant);
  return {
    half: HOUSE_PLATE.width / 2,
    bottom: i.y + p.lift,
    top: i.y + p.lift + HOUSE_PLATE.height,
  };
};

const pointOn = (w: Wall, u: number, out = 0): Pt => ({
  x: w.a.x + ((w.b.x - w.a.x) * u) / w.length + w.nx * out,
  z: w.a.z + ((w.b.z - w.a.z) * u) / w.length + w.nz * out,
});

/** The drawn wall a decal stands on: its foot within `OFF_FACE` of the face, inside its ends, facing out along its normal; or null. */
export const decalWall = (frames: readonly FramedBuilding[], i: StreetPropItem): OnWall | null => {
  const s = wallSpan(i);
  for (const b of frames) {
    for (const w of b.frame.walls) {
      if (hiddenWall(b.frame, w)) continue;
      const dx = (w.b.x - w.a.x) / w.length;
      const dz = (w.b.z - w.a.z) / w.length;
      const u = (i.x - w.a.x) * dx + (i.z - w.a.z) * dz;
      const off = (i.x - w.a.x) * w.nx + (i.z - w.a.z) * w.nz;
      const turn = Math.abs(Math.atan2(Math.sin(i.yaw - Math.atan2(w.nx, w.nz)), Math.cos(i.yaw - Math.atan2(w.nx, w.nz))));
      if (u >= -1e-6 && u <= w.length + 1e-6 && Math.abs(off) <= OFF_FACE && turn <= OFF_NORMAL) return { b, wall: w, u, ...s };
    }
  }
  return null;
};

/**
 * The panes the facade shader paints under a wall decal (`shaderGlass`, the shared port of its glass
 * mask, ADR-0058 stage 9): sampled every 5 cm over the decal, in metres along the wall and over the
 * ground floor's line, as the wall's UVs give them to the shader.
 */
const panesUnder = (on: OnWall): number => {
  const meta = frameWallMeta(on.b.frame, on.wall);
  let n = 0;
  for (let x = on.u - on.half; x <= on.u + on.half + 1e-6; x += 0.05) {
    for (let y = on.bottom; y <= on.top + 1e-6; y += 0.05) if (shaderGlass({ x, y: y - on.b.frame.b.base }, meta)) n++;
  }
  return n;
};

const PROTECTED_USE: ReadonlySet<string> = new Set(["historic", "church", "civic"]);

/** The glitch scan's checks of the decals: by name, each a list of findings. */
export const decalChecks = (all: readonly StreetPropItem[], world: DecalWorld): Record<string, () => Finding[]> => {
  let frames: FramedBuilding[] | null = null;
  const framed = () => (frames ??= cityFrames(world.views).filter((b) => b.view.soffit === undefined));
  const onWalls = () => all.filter((i) => WALL_DECALS.has(i.prop)).map((i) => ({ i, on: decalWall(framed(), i) }));
  const placed = (fn: (i: StreetPropItem, on: OnWall) => string | null) => (): Finding[] =>
    onWalls().flatMap(({ i, on }) => {
      if (!on) return [];
      const what = fn(i, on);
      return what ? [{ at: near(i), what: `${i.prop} ${what}` }] : [];
    });
  const grates = () => all.filter((i) => i.prop === "drain-grate");
  const corners = (i: StreetPropItem): (Pt & { lx: number; lz: number })[] => {
    const [c, s] = [Math.cos(i.yaw), Math.sin(i.yaw)];
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, b]) => {
      const lx = (a! * DRAIN_GRATE.length) / 2;
      const lz = (b! * DRAIN_GRATE.width) / 2;
      return { x: i.x + lx * c + lz * s, z: i.z - lx * s + lz * c, lx, lz };
    });
  };
  const onRoad = (p: Pt) => world.roads.some((r) => inRing(p, r)) && !world.sidewalks.some((r) => inRing(p, r));
  return {
    /** A wall decal off every drawn wall's face, past its ends, over its top, or under the wall in view or the paving in front of it. */
    "decal-off-wall": () =>
      onWalls().flatMap(({ i, on }) => {
        if (!on)
          return [
            {
              at: near(i),
              what: `${i.prop} on no drawn wall (yaw ${i.yaw.toFixed(2)})`,
            },
          ];
        const { b, wall: w, u, half, bottom, top } = on;
        const from = w.blind ? Math.max(w.coveredTo, b.frame.b.foot) : b.frame.b.foot;
        const paving = Math.max(...[u - half, u + half].map((k) => pointOn(w, k, 0.15)).map((p) => world.surfaceY(p.x, p.z)));
        if (u - half < -1e-6 || u + half > w.length + 1e-6)
          return [
            {
              at: near(i),
              what: `${i.prop} past the wall's ends (${(u - half).toFixed(2)}..${(u + half).toFixed(2)} of ${w.length.toFixed(2)} m)`,
            },
          ];
        if (top > b.frame.top + 1e-6)
          return [
            {
              at: near(i),
              what: `${i.prop} over the wall's top by ${(top - b.frame.top).toFixed(2)} m`,
            },
          ];
        if (bottom < from - 1e-6 || bottom < paving)
          return [
            {
              at: near(i),
              what: `${i.prop} under the wall in view or the paving (${bottom.toFixed(2)} < ${Math.max(from, paving).toFixed(2)})`,
            },
          ];
        return [];
      }),
    /** A wall decal over the ground floor's line of a wall the facade shader glazes. */
    "decal-in-window": placed((i, on) => {
      // Graffiti on the plinth band's face lies over the band, whose stone hides the wall behind it.
      if (i.prop === "graffiti" && graffitiLayout(i.variant).band) return null;
      const n = panesUnder(on);
      return n > 0 ? `over the facade's panes (${n} samples of 5 cm)` : null;
    }),
    /** A decal on a landmark; graffiti on a building of historic, sacred or civic use, one the map tags historic or heritage, or in the Old Town. */
    "decal-on-landmark": placed((i, on) => {
      if (on.b.landmark) return "on a landmark";
      if (i.prop !== "graffiti") return null;
      const t = world.tagsAt(on.b.at);
      if (PROTECTED_USE.has(on.b.view.use) || t.historic !== undefined || t.heritage !== undefined)
        return `on a protected building (${on.b.view.use}${t.historic ? `, historic=${t.historic}` : ""}${t.heritage ? `, heritage=${t.heritage}` : ""})`;
      return world.districtAt(i) === "kanal" ? "in the Old Town" : null;
    }),
    /** A wall decal whose corner is inside a neighbouring building taller than it. */
    "decal-in-neighbour": placed((_i, on) => {
      for (const k of [on.u - on.half, on.u + on.half]) {
        const p = pointOn(on.wall, k, LOOK_OUT);
        const top = on.b.frame.neighbour(p.x, p.z, on.b.frame.b.id);
        if (top !== null && top > on.bottom + 1e-6) return `in a neighbour ${(top - on.bottom).toFixed(2)} m over its bottom`;
      }
      return null;
    }),
    /**
     * A wall decal the plinth band round the building's foot hides (`plinthBand`: the renderer's
     * dark stone 6 cm off the wall), or one painted on the band's face reaching past the band or
     * on a band the building does not have.
     */
    "decal-under-plinth": placed((i, on) => {
      const band = plinthBand(on.b.frame.b);
      const onBand = i.prop === "graffiti" && graffitiLayout(i.variant).band === true;
      if (onBand) {
        if (!band) return "on a plinth band the building has not";
        return on.top > band.top + 1e-6 || on.bottom < band.bottom - 1e-6 ? `on the plinth band reaching past it (${on.bottom.toFixed(2)}..${on.top.toFixed(2)} of ${band.bottom.toFixed(2)}..${band.top.toFixed(2)})` : null;
      }
      return band && on.bottom < band.top - 1e-6 ? `behind the plinth band up to ${(band.top - on.bottom).toFixed(2)} m over its bottom` : null;
    }),
    /** A wall decal under a venue's board, in a shop board's band or on a wall a holo-ad may cover. */
    "decal-on-sign": placed((_i, on) => {
      const { b, wall: w, u, half, bottom, top } = on;
      const a = pointOn(w, u - half);
      const c = pointOn(w, u + half);
      for (const s of world.boards) {
        if (segGap(s.a, w.a, w.b) > 0.2 || segGap(s.b, w.a, w.b) > 0.2) continue;
        const along = (p: Pt) => ((p.x - w.a.x) * (w.b.x - w.a.x) + (p.z - w.a.z) * (w.b.z - w.a.z)) / w.length;
        const [s0, s1] = [along(s.a), along(s.b)].sort((x, y) => x - y);
        if (s0! < along(c) && s1! > along(a) && s.bottom < top && s.top > bottom) return "under a venue's board";
      }
      if (holoMayHang(b.frame, w)) return "on a wall a holo-ad may cover";
      const board = shopBoardOn(b.frame, w);
      if (board !== null) {
        const y = b.frame.b.base + b.frame.ground - 0.45;
        const h = shopBoardHeight(w);
        if (bottom < y + h / 2 && top > y - h / 2) return "in a shop board's band";
      }
      return null;
    }),
    /** A wall decal on a building with the game's doorways or passages, or near a passage's axis. */
    "decal-in-passage": placed((i, on) => {
      const f = on.b.frame.b;
      if ((f.passages?.length ?? 0) + (f.doorways?.length ?? 0) > 0) return "on a building with the game's passages or doorways";
      const p = world.passages.find((q) => segGap(i, q.from, q.to) < q.width / 2 + PASSAGE_ROOM);
      return p ? `by a passage ${segGap(i, p.from, p.to).toFixed(2)} m from its axis` : null;
    }),
    /** A sticker off its host (none of its kind at its foot with its yaw, a pole lamp's model, a face or height the host has not); a grate off the road's fall. */
    "decal-floating": () => [
      ...all
        .filter((i) => i.prop === "sticker")
        .flatMap((i) => {
          const s = stickerLayout(i.variant);
          const h = STICKER_HOSTS[s.host];
          const host = h ? all.find((o) => o.prop === h.kind && Math.abs(o.x - i.x) < 0.005 && Math.abs(o.z - i.z) < 0.005 && Math.abs(o.yaw - i.yaw) < 1e-4) : undefined;
          if (!h || !host)
            return [
              {
                at: near(i),
                what: `sticker with no ${h?.kind ?? "host"} under it`,
              },
            ];
          if (h.kind === "lamp-road" && world.poleLamp(i))
            return [
              {
                at: near(i),
                what: "sticker on a lamp drawn as a utility pole",
              },
            ];
          if (!hostFaces(h).includes(s.face) || s.lift < h.low - 1e-6 || s.lift > h.high + 1e-6)
            return [
              {
                at: near(i),
                what: `sticker on face ${s.face} at ${s.lift} m of a ${h.kind}`,
              },
            ];
          return [];
        }),
      ...grates().flatMap((i) => {
        const g = grateLayout(i.variant);
        const off = Math.max(Math.abs(i.y - world.groundY(i.x, i.z)), ...corners(i).map((q) => Math.abs(world.groundY(q.x, q.z) - (i.y + g.slopeX * q.lx + g.slopeZ * q.lz))));
        return off > OFF_PLANE
          ? [
              {
                at: near(i),
                what: `drain-grate ${off.toFixed(3)} m off the road under it`,
              },
            ]
          : [];
      }),
    ],
    /** A grate off the carriageway (a corner on no drawn road or under a sidewalk), or with road between it and the edge on its kerb side. */
    "decal-off-kerb": () =>
      grates().flatMap((i) => {
        if (!corners(i).every(onRoad))
          return [
            {
              at: near(i),
              what: "drain-grate with a corner off the carriageway",
            },
          ];
        const kerb = {
          x: i.x + Math.sin(i.yaw) * (DRAIN_GRATE.width / 2 + KERB_REACH),
          z: i.z + Math.cos(i.yaw) * (DRAIN_GRATE.width / 2 + KERB_REACH),
        };
        return onRoad(kerb) ? [{ at: near(i), what: "drain-grate not at the road's edge" }] : [];
      }),
    /** A grate on a zebra crossing or its band. */
    "decal-on-crossing": () => grates().flatMap((i) => (corners(i).some((q) => world.crossings.some((b) => inCrossingBand(b, q))) ? [{ at: near(i), what: "drain-grate on a crossing" }] : [])),
    /** A wall decal over another one on the same wall (a plate under graffiti, two pieces of graffiti in one another) or over a door of the facade (ADR-0058 stage 9). */
    "decal-on-decal": () => {
      const placed = onWalls().flatMap(({ i, on }) => (on ? [{ i, on }] : []));
      const doors = all.filter((d) => d.prop === "door");
      return placed.flatMap(({ i, on }, k) => {
        const other = placed.slice(0, k).find((o) => o.on.wall === on.wall && o.on.u - o.on.half < on.u + on.half && o.on.u + o.on.half > on.u - on.half && o.on.bottom < on.top && o.on.top > on.bottom);
        if (other) return [{ at: near(i), what: `${i.prop} over a ${other.i.prop} on its wall` }];
        const w = on.wall;
        const door = doors.find((d) => {
          const u = ((d.x - w.a.x) * (w.b.x - w.a.x) + (d.z - w.a.z) * (w.b.z - w.a.z)) / w.length;
          const off = (d.x - w.a.x) * w.nx + (d.z - w.a.z) * w.nz;
          const l = doorLayout(d.variant);
          return Math.abs(off) <= OFF_FACE * 2 && Math.abs(u - on.u) < l.width / 2 + on.half && d.y < on.top && d.y + l.height > on.bottom;
        });
        return door ? [{ at: near(i), what: `${i.prop} over a door of its wall` }] : [];
      });
    },
    /** A decal in a block of the renderer's furniture no other piece is in: its mesh a mesh more for decals alone. */
    "decal-alone-in-block": () => {
      const filled = new Set(all.filter((i) => !DECAL_KINDS.has(i.prop)).map(world.blockOf));
      return all.filter((i) => DECAL_KINDS.has(i.prop) && !filled.has(world.blockOf(i))).map((i) => ({ at: near(i), what: `${i.prop} alone in block ${world.blockOf(i)}` }));
    },
  };
};
