import { prng } from "../city-kit-data";
import { MEGA_SITES } from "./skyline";

/**
 * PROTOTYP (megabloki, 31.10): warianty panoramy do wyboru przez użytkownika, przez `?skyline=`.
 * Wszystko poza danymi Lublina (prostokąt chunków Krakowskiego, Starego Miasta i Podzamcza
 * x -200..1120, z -270..580, oraz Nabrzeże x 2300..2700, z 60..480), w tych samych dwóch
 * siatkach panoramy.
 *
 * - A „pierścień”: dwa rzędy megabloków 300–700 m za krawędzią chunków, 150–350 m.
 * - B „osaczenie”: bliższy rząd 220–380 m za krawędzią, 300–520 m, z kładkami między wieżami
 *   i reklamami na kilku wysokościach, za nim pierścień A.
 * - C „nadbudowa”: płyty-megabloki na nogach z wież nad Czechowem, Tatarami, Wieniawą
 *   i Kośminkiem (120–200 m nad ziemią), z wieżami przebijającymi płyty.
 */
export type SkylineVariant = "now" | "A" | "B" | "C";

export interface TowerSpec {
  readonly x: number;
  readonly z: number;
  readonly h: number;
  /** Unit horizontal direction its front looks to. */
  readonly front: { readonly x: number; readonly z: number };
  /** Extra ads up its front (beyond the one at its middle). */
  readonly ads: number;
}

/** A skybridge between towers `a` and `b` of the layout, at height `y`. */
export interface BridgeSpec {
  readonly a: number;
  readonly b: number;
  readonly y: number;
  readonly width: number;
}

/** A megablock slab lifted over the city: centre, size, turn, its underside at `y`. */
export interface SlabSpec {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly length: number;
  readonly depth: number;
  readonly height: number;
  readonly rotY: number;
}

export interface SkylineLayout {
  readonly towers: readonly TowerSpec[];
  readonly bridges: readonly BridgeSpec[];
  /** Slabs and the towers that carry each (indices into `towers`, for the stamp). */
  readonly slabs: readonly { readonly slab: SlabSpec; readonly carrier: number }[];
}

export const skylineVariant = (): SkylineVariant => {
  const q = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("skyline");
  return q === "A" || q === "B" || q === "C" ? q : "now";
};

/** The game's main block of chunks and the Nabrzeże. */
const DATA = { minX: -200, maxX: 1120, minZ: -270, maxZ: 580 };
const DOCKS = { minX: 2300, maxX: 2700, minZ: 60, maxZ: 480 };

const toBox = (b: typeof DATA, x: number, z: number): number => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ));

/** Nearest point of the main block: where a tower out there looks. */
const towardsData = (x: number, z: number): { x: number; z: number } => {
  const nx = Math.min(Math.max(x, DATA.minX), DATA.maxX) - x;
  const nz = Math.min(Math.max(z, DATA.minZ), DATA.maxZ) - z;
  const l = Math.hypot(nx, nz) || 1;
  return { x: nx / l, z: nz / l };
};

/**
 * Points round the main block `offset` metres out (a rounded rectangle), every `spacing` metres,
 * jittered; none nearer than `minToData` to any chunk.
 */
const ring = (offset: number, spacing: number, jitter: number, seed: number, minToData: number): { x: number; z: number }[] => {
  const rand = prng(seed);
  const w = DATA.maxX - DATA.minX;
  const d = DATA.maxZ - DATA.minZ;
  const perimeter = 2 * (w + d) + 2 * Math.PI * offset;
  const n = Math.round(perimeter / spacing);
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    let s = ((i + rand() * 0.4) / n) * perimeter;
    let x = 0;
    let z = 0;
    // Walk the rounded rectangle: south edge east, the SE arc, east edge north, and so on.
    const legs: [number, (t: number) => [number, number]][] = [
      [w, (t) => [DATA.minX + t, DATA.minZ - offset]],
      [(Math.PI / 2) * offset, (t) => arc(DATA.maxX, DATA.minZ, -Math.PI / 2 + t / offset)],
      [d, (t) => [DATA.maxX + offset, DATA.minZ + t]],
      [(Math.PI / 2) * offset, (t) => arc(DATA.maxX, DATA.maxZ, t / offset)],
      [w, (t) => [DATA.maxX - t, DATA.maxZ + offset]],
      [(Math.PI / 2) * offset, (t) => arc(DATA.minX, DATA.maxZ, Math.PI / 2 + t / offset)],
      [d, (t) => [DATA.minX - offset, DATA.maxZ - t]],
      [(Math.PI / 2) * offset, (t) => arc(DATA.minX, DATA.minZ, Math.PI + t / offset)],
    ];
    function arc(cx: number, cz: number, a: number): [number, number] {
      return [cx + Math.cos(a) * offset, cz + Math.sin(a) * offset];
    }
    for (const [len, at] of legs) {
      if (s <= len) {
        [x, z] = at(s);
        break;
      }
      s -= len;
    }
    const out2 = towardsData(x, z);
    x -= out2.x * (rand() - 0.3) * jitter;
    z -= out2.z * (rand() - 0.3) * jitter;
    x += (rand() - 0.5) * jitter * 0.5 * out2.z;
    z -= (rand() - 0.5) * jitter * 0.5 * out2.x;
    if (toBox(DATA, x, z) < minToData || toBox(DOCKS, x, z) < minToData) continue;
    out.push({ x, z });
  }
  return out;
};

/** Today's sites, as tower specs facing the centre on an axis (as `planSkyline` turns them). */
const legacy = (): TowerSpec[] => {
  const out: TowerSpec[] = [];
  for (const s of MEGA_SITES) {
    const rand = prng(Math.floor(Math.abs(s.x * 31 + s.z * 17)) ^ 0x5ca1e);
    s.towers.forEach((h, k) => {
      const a = k * 2.4 + rand();
      const r = k === 0 ? 0 : 120 + rand() * 160;
      const x = s.x + Math.sin(a) * r;
      const z = s.z + Math.cos(a) * r;
      const front = Math.abs(x) > Math.abs(z) ? { x: -Math.sign(x), z: 0 } : { x: 0, z: -Math.sign(z) };
      out.push({ x, z, h, front, ads: 0 });
    });
  }
  return out;
};

const rows = (offset: number, spacing: number, lo: number, hi: number, seed: number, ads: number, minToData: number): TowerSpec[] => {
  const rand = prng(seed ^ 0x77);
  return ring(offset, spacing, 120, seed, minToData).map((p) => ({ ...p, h: lo + rand() * (hi - lo), front: towardsData(p.x, p.z), ads }));
};

const ringA = (): TowerSpec[] => [...rows(360, 165, 150, 250, 101, 0, 300), ...rows(600, 180, 230, 350, 202, 1, 300)];

/** Skybridges between neighbours of a row (they come round the ring in order). */
const bridgesOf = (from: number, count: number, towers: readonly TowerSpec[], seed: number): BridgeSpec[] => {
  const rand = prng(seed);
  const out: BridgeSpec[] = [];
  for (let i = 0; i < count; i++) {
    const a = from + i;
    const b = from + ((i + 1) % count);
    const ta = towers[a]!;
    const tb = towers[b]!;
    if (Math.hypot(ta.x - tb.x, ta.z - tb.z) > 260) continue;
    const top = Math.min(ta.h, tb.h);
    for (const f of [0.28, 0.52, 0.74]) if (rand() < 0.75) out.push({ a, b, y: top * (f + (rand() - 0.5) * 0.06), width: 8 + rand() * 8 });
  }
  return out;
};

const variantB = (): SkylineLayout => {
  const inner = rows(270, 120, 300, 520, 303, 3, 220);
  const towers = [...inner, ...ringA()];
  return { towers, bridges: bridgesOf(0, inner.length, towers, 404), slabs: [] };
};

/** Slab complexes over the real blocks beyond the chunks: centre, length, turn. */
const SLABS: readonly { x: number; z: number; length: number; rotY: number }[] = [
  { x: -300, z: 1250, length: 900, rotY: Math.PI / 2 + 0.25 }, // Czechów
  { x: 1650, z: 1150, length: 700, rotY: -0.5 }, // Tatary
  { x: -800, z: 150, length: 650, rotY: 0.1 }, // Wieniawa
  { x: 1550, z: -650, length: 650, rotY: 0.6 }, // Kośminek
  { x: 450, z: -850, length: 750, rotY: Math.PI / 2 }, // Wrotków
];

const variantC = (): SkylineLayout => {
  const rand = prng(0xc0c0);
  const towers: TowerSpec[] = [...legacy()];
  const slabs: { slab: SlabSpec; carrier: number }[] = [];
  for (const s of SLABS) {
    const ax = { x: Math.sin(s.rotY), z: Math.cos(s.rotY) };
    const y = 120 + rand() * 80;
    const legs = Math.round(s.length / 170);
    for (let k = 0; k <= legs; k++) {
      const t = (k / legs - 0.5) * s.length * 0.92;
      const x = s.x + ax.x * t;
      const z = s.z + ax.z * t;
      // Legs as tall as the slab, every other one breaking through it.
      const h = k % 2 === 1 ? y + 120 + rand() * 160 : y + 4;
      towers.push({ x, z, h, front: towardsData(x, z), ads: k % 2 });
    }
    for (const lvl of [0, 1]) {
      const carrier = towers.length - 1 - Math.floor(legs / 2);
      slabs.push({ slab: { x: s.x, z: s.z, y: y + lvl * 46, length: s.length * (1 - lvl * 0.25), depth: 70 - lvl * 18, height: 40, rotY: s.rotY }, carrier });
    }
  }
  return { towers, bridges: [], slabs };
};

export const skylineLayout = (v: SkylineVariant): SkylineLayout | null => {
  if (v === "A") return { towers: [...legacy(), ...ringA()], bridges: [], slabs: [] };
  if (v === "B") {
    const b = variantB();
    return { ...b, towers: [...b.towers, ...legacy()] };
  }
  if (v === "C") return variantC();
  return null;
};
