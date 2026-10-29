import type { Vec3 } from "@seki/core";
import { type ChunkDef, WORLD_CHUNKS, groundY } from "@seki/sim";
import { SIGN_COLORS, prng, seedOf } from "./city-kit-data";
import { type DressBlock, type Face, SIDES, faceOf, faceOpen, isBuilding } from "./dressing-plan";
import { MeshSink, type Rgba, type Vec } from "./mesh-sink";

/**
 * Signage of the streets (ADR-0030): blade signs at building corners and boards over shop
 * fronts drawn from one atlas, holo-ads floating off the upper floors, and the neon they throw on
 * the wet asphalt. Every district in one mesh and one material, so all of it is one draw call.
 *
 * Encoding (signage shader): colour rgb = tint, colour a = brightness; uv = position on the quad
 * (0..1, v up; for reflections v runs from the wall outwards); uv2.x = atlas cell or seed,
 * uv2.y = kind (SIGNAGE_KIND).
 */
export const SIGNAGE_KIND = { sign: 0, holo: 1, reflection: 2 } as const;

/** Atlas layout (1024 square): eight upright blades (1:4) across the top half, eight boards (4:1, two columns, four rows) below. */
export const ATLAS_BLADES = 8;
export const ATLAS_BOARDS = 8;

export const SIGNAGE_BLADES = ["RAMEN", "HOTEL", "BAR", "SUSHI", "24H", "KISSA", "@", "#"] as const;
export const SIGNAGE_BOARDS = ["PACHINKO", "KARAOKE", "ARCADE", "NOODLES", "OPEN 24H", "CYBER CAFE", "LOVE", "@"] as const;

/** Holo-ads per chunk at most, on its tallest buildings. */
export const HOLO_PER_CHUNK = 3;

/** A neon sign of the content: generated signs keep clear of it. */
interface Keepout {
  readonly center: Vec3;
  readonly size: Vec3;
}

const tint = (hex: string, brightness: number): Rgba => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, brightness];
};

const along = (f: Face): { x: number; z: number } => ({ x: Math.cos(f.rot), z: -Math.sin(f.rot) });

const UV_FLAT: readonly [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const UV_MIRROR: readonly [number, number][] = [
  [1, 0],
  [0, 0],
  [0, 1],
  [1, 1],
];

/** A quad flat on the face, centred at (u, y) above the block's bottom, `out` off the wall. */
const flatQuad = (sink: MeshSink, f: Face, u: number, y: number, out: number, w: number, h: number, color: Rgba, uv2: [number, number]) => {
  const n = { x: f.n.x, y: 0, z: f.n.z };
  sink.quad([f.at(u - w / 2, y - h / 2, out), f.at(u + w / 2, y - h / 2, out), f.at(u + w / 2, y + h / 2, out), f.at(u - w / 2, y + h / 2, out)], n, color, UV_FLAT, uv2);
};

/** A blade sign sticking straight out of the wall at `u`: two faces back to back, both readable. */
const bladeQuads = (sink: MeshSink, f: Face, u: number, y: number, out0: number, depth: number, h: number, color: Rgba, uv2: [number, number]) => {
  const a = along(f);
  const p = (o: number, dy: number, side: number): Vec => {
    const q = f.at(u, y + dy, o);
    return { x: q.x + a.x * 0.03 * side, y: q.y, z: q.z + a.z * 0.03 * side };
  };
  for (const side of [1, -1]) {
    const n = { x: a.x * side, y: 0, z: a.z * side };
    sink.quad([p(out0, -h / 2, side), p(out0 + depth, -h / 2, side), p(out0 + depth, h / 2, side), p(out0, h / 2, side)], n, color, side > 0 ? UV_FLAT : UV_MIRROR, uv2);
  }
};

/** Height of the ground under a point (Lublin's terrain, ADR-0045). */
export type SignGround = (x: number, z: number) => number;

/** Neon thrown on the wet street in front of a sign: a strip from the wall foot outwards, on the ground. */
const reflection = (sink: MeshSink, f: Face, u: number, w: number, length: number, color: Rgba, seed: number, ground: SignGround) => {
  const c = [f.at(u - w / 2, 0, 0.3), f.at(u + w / 2, 0, 0.3), f.at(u + w / 2, 0, 0.3 + length), f.at(u - w / 2, 0, 0.3 + length)].map((p) => ({ x: p.x, y: ground(p.x, p.z) + 0.035, z: p.z })) as [Vec, Vec, Vec, Vec];
  sink.quad(c, { x: 0, y: 1, z: 0 }, color, UV_FLAT, [seed, SIGNAGE_KIND.reflection]);
};

const blockOf = (p: ChunkDef["props"][number]): DressBlock | null => {
  const v = p.view;
  if (v.kind !== "block") return null;
  return { center: p.center, size: v.size, material: v.material, ...(v.skin ? { skin: v.skin } : {}), ...(v.rungs ? { rungs: v.rungs } : {}), ...(v.slope ? { slope: v.slope } : {}) };
};

/**
 * Plans the signage of every chunk from the chunk table: deterministic per building, nothing
 * placed by hand, so a district the content adds gets its signs too.
 */
export const planSignage = (chunks: readonly ChunkDef[] = WORLD_CHUNKS, ground: SignGround = groundY): MeshSink => {
  const sink = new MeshSink();
  const world = chunks.flatMap((c) => c.props.map(blockOf).filter((b): b is DressBlock => b !== null));
  const keepout: Keepout[] = chunks.flatMap((c) => c.props.flatMap((p) => (p.view.kind === "neon" ? [{ center: p.center, size: p.view.size }] : [])));
  const clear = (p: Vec3, pad: number) =>
    !keepout.some((s) => Math.abs(s.center.x - p.x) < s.size.x / 2 + pad && Math.abs(s.center.y - p.y) < s.size.y / 2 + pad && Math.abs(s.center.z - p.z) < s.size.z / 2 + pad);
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const buildings: { b: DressBlock; f: Face }[] = [];
    for (const prop of chunk.props) {
      const b = blockOf(prop);
      if (!b || !isBuilding(b)) continue;
      // Chunk tables overlap at the seams; a building listed twice is signed once.
      const key = `${b.center.x.toFixed(1)}:${b.center.z.toFixed(1)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const side = b.skin?.front ?? SIDES.find((s) => faceOpen(b, s, world, 10)) ?? null;
      if (!side || !faceOpen(b, side, world, 2.5)) continue;
      const f = faceOf(b, side);
      buildings.push({ b, f });
      signBuilding(sink, b, f, clear, ground);
    }
    // Holo-ads on the tallest fronts of the chunk.
    const tall = buildings.filter(({ b }) => b.size.y >= 11 && b.center.y - b.size.y / 2 - ground(b.center.x, b.center.z) < 1).sort((p, q) => q.b.size.y - p.b.size.y || p.b.center.x - q.b.center.x || p.b.center.z - q.b.center.z);
    tall.slice(0, HOLO_PER_CHUNK).forEach(({ b, f }, i) => {
      const rand = prng(seedOf(b.center) ^ 0x4010);
      const w = Math.min(6.5, f.width * (0.45 + rand() * 0.2));
      const h = Math.min(b.size.y * 0.4, w * (1.1 + rand() * 0.5));
      const y = Math.min(b.size.y - h / 2 - 0.8, Math.max(6.5 + h / 2, b.size.y * 0.62));
      const u = (rand() - 0.5) * Math.max(0, f.width - w - 1);
      const at = f.at(u, y, 1.4);
      if (!clear(at, 1.5)) return;
      const color = SIGN_COLORS[(i * 2 + Math.floor(rand() * SIGN_COLORS.length)) % SIGN_COLORS.length] ?? "#00e5ff";
      flatQuad(sink, f, u, y, 1.4, w, h, tint(color, 1), [rand(), SIGNAGE_KIND.holo]);
    });
  }
  return sink;
};

/** Corner blades and a shop board on one building front, with their reflections. */
const signBuilding = (sink: MeshSink, b: DressBlock, f: Face, clear: (p: Vec3, pad: number) => boolean, ground: SignGround): void => {
  const rand = prng(seedOf(b.center) ^ 0x519a);
  const onStreet = b.center.y - b.size.y / 2 - ground(b.center.x, b.center.z) < 0.5;
  const w = f.width;
  // Blade signs at the corners of the front, above the awnings.
  for (const end of [-1, 1]) {
    if (b.size.y < 7 || w < 5 || rand() > 0.62) continue;
    const h = 2.6 + rand() * 1.4;
    const y = Math.min(b.size.y - h / 2 - 0.5, 4.3 + h / 2 + rand() * 1.2);
    const u = end * (w / 2 - 0.45);
    if (!clear(f.at(u, y, 0.7), 1.2)) continue;
    const cell = Math.floor(rand() * ATLAS_BLADES);
    const color = SIGN_COLORS[Math.floor(rand() * SIGN_COLORS.length)] ?? "#ff2e88";
    bladeQuads(sink, f, u, y, 0.15, 0.85, h, tint(color, 0.95), [cell, SIGNAGE_KIND.sign]);
    if (onStreet) reflection(sink, f, u, 1.3, 4.5 + rand() * 2, tint(color, 0.4), rand(), ground);
  }
  // A board over the shop fronts; skinned buildings carry the kit's own boards there.
  if (!b.skin && w >= 5 && rand() < 0.7) {
    const bw = Math.min(w - 1.5, 3.2 + rand() * 1.8);
    const u = (rand() - 0.5) * (w - bw - 1);
    const y = 3.62;
    if (clear(f.at(u, y, 0.1), 0.6)) {
      const cell = ATLAS_BLADES + Math.floor(rand() * ATLAS_BOARDS);
      const color = SIGN_COLORS[Math.floor(rand() * SIGN_COLORS.length)] ?? "#00e5ff";
      flatQuad(sink, f, u, y, 0.1, bw, bw / 4, tint(color, 0.9), [cell, SIGNAGE_KIND.sign]);
      if (onStreet) reflection(sink, f, u, bw * 0.9, 4 + rand() * 2, tint(color, 0.35), rand(), ground);
    }
  }
};
