import type { Vec3 } from "@seki/core";
import type { ActorDef } from "../builders";
import { shopHash } from "./shop-fittings";
import { ALL_SHOP_BUILDS } from "./shops";
import { ALCHEMIA_UNITS, OPEN_YAW, keeperSpotOf } from "./units";

/*
 * The sellers of Alchemia (ADR-0101): a character behind the counter of every open shop of the
 * gallery and the front (where a still figure stood until then) and of every open kitchen of the
 * food hall that has no keeper of the story, to be talked to. What one says is the scenario of its
 * trade or kitchen (`sellers.ink`), in a voice of its own: the scenario's variants go round the
 * shops of a trade in an order of a hash of their ids, so no two of a trade say the same. A shut
 * or vacant shop and a shut kitchen have nobody. Their looks come from the crowd's pool by the
 * spawn key (ADR-0076), the same in every game.
 */

export interface SellerDef {
  /** The shop's or the kitchen's id. */
  readonly id: string;
  /** Its spawn key: `seller-<id>`, a save's name for it. */
  readonly key: string;
  /** What it talks about: the shop's trade or the kitchen's cuisine. */
  readonly scenario: string;
  /** Which of the scenario's voices, from 1. */
  readonly variant: number;
  /** The ink knot and stitch of the conversation: `seller_<scenario>.v<variant>`. */
  readonly knot: string;
  readonly at: Vec3;
  readonly yaw: number;
  /** How far from it she may talk to it. */
  readonly reach: number;
  /** For a shop's: she talks to it from inside the shop only. */
  readonly from?: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
}

/** The voices each scenario has in `sellers.ink`: at least as many as it has shops open. */
export const SELLER_VARIANTS: Readonly<Record<string, number>> = {
  pharmacy: 4,
  tattoo: 4,
  pawn: 2,
  "synth-food": 4,
  electronics: 3,
  florist: 2,
  repair: 4,
  implants: 3,
  crypto: 4,
  clothing: 4,
  vr: 3,
  arms: 3,
  coffee: 1,
  thai: 1,
  greek: 1,
  wok: 1,
};

/** The knot of a scenario: `seller_` and its name with `_` for `-`. */
export const sellerKnot = (scenario: string): string => `seller_${scenario.replace(/-/g, "_")}`;

type Place = Omit<SellerDef, "variant" | "knot">;

const rectOf = (r: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number }) => ({ minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1 });

/**
 * Reach of a conversation over a shop's counter: its customer's spot (1.7 to 1.9 m off) and a
 * little, from inside the shop only (`from`: not through its glass nor its wall); over a kitchen's,
 * open to the floor, the keepers' 3 m (ADR-0063).
 */
const SHOP_REACH = 2.4;
const KITCHEN_REACH = 3;

const SHOP_PLACES: readonly Place[] = ALL_SHOP_BUILDS.flatMap((b) =>
  b.seller ? [{ id: b.shop.id, key: `seller-${b.shop.id}`, scenario: b.shop.trade, at: b.seller, yaw: b.sellerYaw, reach: SHOP_REACH, from: rectOf(b.shop.rect) }] : [],
);

/** The food hall's open kitchens without a keeper of the story: a cook behind each counter, facing out. */
const KITCHEN_PLACES: readonly Place[] = ALCHEMIA_UNITS.flatMap((u) =>
  u.keeper || u.shut ? [] : [{ id: u.id, key: `seller-fh-${u.id}`, scenario: u.cuisine, at: keeperSpotOf(u.id), yaw: OPEN_YAW[u.open], reach: KITCHEN_REACH }],
);

/** Each place with its voice: a scenario's places in the order of `shopHash(id, 94)` take its variants one by one. */
const voiced = (places: readonly Place[]): SellerDef[] => {
  const rank = new Map<string, number>();
  const byScenario = new Map<string, Place[]>();
  for (const p of places) byScenario.set(p.scenario, [...(byScenario.get(p.scenario) ?? []), p]);
  for (const group of byScenario.values()) [...group].sort((a, b) => shopHash(a.id, 94) - shopHash(b.id, 94)).forEach((p, i) => rank.set(p.id, i));
  return places.map((p) => {
    const variant = (rank.get(p.id) ?? 0) + 1;
    return { ...p, variant, knot: `${sellerKnot(p.scenario)}.v${variant}` };
  });
};

export const SELLERS: readonly SellerDef[] = voiced([...SHOP_PLACES, ...KITCHEN_PLACES]);

/** What the HUD offers at a seller's counter. */
export const SELLER_PROMPT = "prompt.talk.seller";

/**
 * The sellers as characters under the gallery's roof, drawn as the crowd's figures but near the
 * player. They keep to their counters: no bystander's AI, no body that moves (44 of them walking
 * the AI's and the bodies' steps cost the wave of `level-chase-cost.test.ts` a sixth more queries
 * of the solid index a step), as the still figures they replace.
 */
export const SELLER_ACTORS: readonly ActorDef[] = SELLERS.map((s) => ({
  kind: "npc",
  spawn: { key: s.key, position: s.at, yaw: s.yaw },
  preset: "civilian",
  faction: "civilians",
  indoor: true,
  standIn: true,
  interactable: { kind: "dialogue", dialogueId: s.knot, prompt: SELLER_PROMPT, radius: s.reach, ...(s.from ? { from: s.from } : {}) },
}));
