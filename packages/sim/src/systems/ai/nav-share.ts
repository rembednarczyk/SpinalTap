import type { GroundField } from "../../world/ground";
import type { Collider } from "../../world/solids";
import type { Field, Raster } from "./nav-raster";
import type { NavShareStore } from "./nav-memo";

export { type Made, type NavShareStore, recorded, replayed, through } from "./nav-memo";

/**
 * A store of the steering's rasters and fields shared by every world of a process (ADR-0083 step
 * 3): the tests run the same city in hundreds of simulations, and each made the same rasters and
 * grew the same fields again (some 60% of the time of the slowest of them, in `fieldSteps`). The
 * game installs none, and with none nothing here runs. What it holds is keyed by what a raster is
 * made of (the solids' shapes, the ground's content, the window), not by entity ids, which another
 * world may give other solids. A hit hands back the same work reports (`Slices`) the making gave,
 * so a world's memo, its counts (`wideBuilds`) and the slices spread over its steps stay what they
 * were without the store: a pure speed-up.
 */

export interface NavShare<R, F> {
  readonly rasters: NavShareStore<R>;
  readonly fields: NavShareStore<F>;
}

let installed: NavShare<Raster, Field> | null = null;

/**
 * Installs the process's store of rasters and fields (tests only), or takes it away (null); gives
 * the one before. Here, not in `nav-field.ts`, so that a test worker installs it without loading
 * the simulation (a worker of tools' tests that never runs one).
 */
export const shareNav = (store: NavShare<Raster, Field> | null): NavShare<Raster, Field> | null => {
  const before = installed;
  installed = store;
  return before;
};

/** The store installed, or null (the game). */
export const navShare = (): NavShare<Raster, Field> | null => installed;

const ids = new WeakMap<object, number>();
let nextId = 1;
const idOf = (o: object): number => {
  let id = ids.get(o);
  if (id === undefined) {
    id = nextId++;
    ids.set(o, id);
  }
  return id;
};

const groundKeys = new WeakMap<GroundField, string>();
/** The long identities of the grounds seen, by their short key. */
const groundIds = new Map<string, string>();

/**
 * The content of a ground, as the identity of what it was made of: the chunks, cuts and vaults of
 * the content in their order (module constants, the same objects for every world of the process).
 * A short key for it (the city's long one is some thousand characters).
 */
export const groundKey = (ground: GroundField): string => {
  let k = groundKeys.get(ground);
  if (k === undefined) {
    const { chunks, cuts, vaults } = ground.made;
    const long = `${chunks.map(idOf).join(",")}:${cuts.map(idOf).join(",")}:${vaults.map(idOf).join(",")}`;
    k = groundIds.get(long) ?? `g${groundIds.size}`;
    groundIds.set(long, k);
    groundKeys.set(ground, k);
  }
  return k;
};

/** Grounds the shared rasters are made on, one a content: the last few used. */
const CANON_GROUNDS = 16;
const canon = new Map<string, GroundField>();

/**
 * One ground of the same content for every world, the one the shared rasters are made on and hold
 * (`Raster.ground`): each simulation makes a ground of its own, and a raster kept from each world
 * held each world's (a test worker ran out of heap with them).
 */
export const sharedGround = (ground: GroundField): { readonly key: string; readonly ground: GroundField } => {
  const key = groundKey(ground);
  const had = canon.get(key) ?? ground;
  canon.delete(key);
  canon.set(key, had);
  for (const k of canon.keys()) {
    if (canon.size <= CANON_GROUNDS) break;
    canon.delete(k);
  }
  return { key, ground: had };
};

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

/** FNV-1a over a number's bits. */
const mixNumber = (h: number, x: number): number => {
  f64[0] = x;
  h = Math.imul(h ^ (u32[0] ?? 0), 16777619);
  return Math.imul(h ^ (u32[1] ?? 0), 16777619);
};

const colliderHash = (c: Collider, seed: number): number => {
  let h = seed;
  const { min, max } = c.box;
  for (const v of [min.x, min.y, min.z, max.x, max.y, max.z]) h = mixNumber(h, v);
  if (c.slope) {
    h = mixNumber(h, c.slope.axis === "x" ? 1 : 2);
    h = mixNumber(h, c.slope.dir);
    h = mixNumber(h, c.slope.low);
    h = mixNumber(h, c.slope.steps ?? -1);
  }
  if (c.prism) {
    h = mixNumber(h, c.prism.bottom);
    h = mixNumber(h, c.prism.top);
    for (const p of c.prism.points) h = mixNumber(mixNumber(h, p.x), p.z);
  }
  return h >>> 0;
};

/** The shapes of the colliders, whatever their order (the raster does not depend on it): two 32-bit hashes and their number. */
export const shapesKey = (colliders: readonly Collider[]): string => {
  let a = 0;
  let b = 0;
  for (const c of colliders) {
    a = (a + colliderHash(c, 2166136261)) >>> 0;
    b = (b ^ colliderHash(c, 0x811c9dc5 ^ 0x5bd1e995)) >>> 0;
  }
  return `${colliders.length}:${a.toString(36)}:${b.toString(36)}`;
};
