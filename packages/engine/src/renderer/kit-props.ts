import type { BlockSkin, Vec3 } from "@seki/core";
import type { KitModel } from "./city-kit-data";
import { type DecorBox, type DecorCable, type SkinPlan, seedOf, toWorld, turnXZ } from "./city-kit-data";
import { type CityProps, type PropXform, facing, onWall, pickProp, propHash } from "./city-props";

/**
 * Facade props on the city kit's blocks (ADR-0058): the procedural AC boxes of `planSkin` give
 * way to air conditioners from the props file in the same spots, and a block gets a dish under
 * its eaves and an antenna on a roof nobody walks on. Everything is chosen from the block's
 * position, so a cell rebuilds the same; `planSkin` and its random draws are untouched.
 */

export interface PlacedProp {
  readonly model: KitModel;
  readonly xf: PropXform;
}

export interface KitPropsOptions {
  /** Phones: the cheap versions of the air conditioners, no dish or antenna. */
  readonly lite?: boolean;
  /** People walk on this roof (ADR-0027, C8): nothing stands on it. */
  readonly walkedRoof?: boolean;
}

const BUILDINGS: ReadonlySet<string> = new Set(["shop", "bar", "tenement", "tower"]);

/** The facade's outward normal in the world. */
const outward = (plan: SkinPlan): Vec3 => {
  const [x, z] = turnXZ(0, -1, plan.turn);
  return { x, y: 0, z };
};

/** An AC box of the plan (the unit; its grille is the thin `ac-grille` box in front of it). */
const isUnit = (d: DecorBox | DecorCable): d is DecorBox => d.kind === "box" && d.swatch === "ac";
const isGrille = (d: DecorBox | DecorCable): boolean => d.kind === "box" && d.swatch === "ac-grille";

/**
 * The plan's decor without the AC boxes the props replace, and the props: an air conditioner
 * where each box hung, a dish and an antenna on buildings. Without a model for a kind the
 * procedural decor stays.
 */
export const planKitProps = (props: CityProps, plan: SkinPlan, skin: BlockSkin, size: Vec3, options: KitPropsOptions = {}): { decor: readonly (DecorBox | DecorCable)[]; props: readonly PlacedProp[] } => {
  if (!BUILDINGS.has(skin.style)) return { decor: plan.decor, props: [] };
  const lite = options.lite ?? false;
  const out = outward(plan);
  const placed: PlacedProp[] = [];
  const decor: (DecorBox | DecorCable)[] = [];
  let replaced = false;
  for (const d of plan.decor) {
    if (!isUnit(d)) {
      decor.push(d);
      continue;
    }
    const seed = seedOf(toWorld(plan, d));
    const m = pickProp(props, "ac-wall", seed, lite);
    if (!m) {
      decor.push(d);
      continue;
    }
    replaced = true;
    // The box's back on the wall, its foot at the box's bottom; about the box's width.
    const at = toWorld(plan, { x: d.x, y: d.y - d.h / 2, z: d.z + d.d / 2 });
    const s = Math.min(1.3, Math.max(0.7, d.w / m.size.x));
    placed.push({ model: m, xf: onWall(m, at, out, { x: s, y: s, z: s }) });
  }
  const kept = replaced ? decor.filter((d) => !isGrille(d)) : decor;
  if (lite) return { decor: kept, props: placed };
  const alongX = skin.front === "z+" || skin.front === "z-";
  const W = alongX ? size.x : size.z;
  const D = alongX ? size.z : size.x;
  const H = size.y;
  const seed = seedOf({ x: plan.origin.x, y: plan.origin.y, z: plan.origin.z });
  const unit = (salt: number) => (propHash(seed, salt) % 10000) / 10000;
  // A satellite dish under the eaves of a block of flats.
  const dish = pickProp(props, "dish", seed);
  if (dish && skin.style !== "tower" && H > 7 && W > 4 && unit(1) < 0.55) {
    const x = (unit(2) - 0.5) * (W - 2.5);
    const at = toWorld(plan, { x, y: H - 2.4 - unit(3) * 1.5, z: -D / 2 });
    placed.push({ model: dish, xf: onWall(dish, at, out, { x: 1, y: 1, z: 1 }) });
  }
  // A TV antenna on a roof nobody walks on, back from the street.
  const antenna = pickProp(props, "antenna", seed);
  if (antenna && !options.walkedRoof && W > 4 && unit(4) < 0.6) {
    const at = toWorld(plan, { x: (unit(5) - 0.5) * (W - 3), y: H, z: D * (0.05 + 0.2 * unit(6)) });
    const s = 0.8 + 0.5 * unit(7);
    placed.push({ model: antenna, xf: facing(at, out, { x: s, y: s, z: s }) });
  }
  return { decor: kept, props: placed };
};
