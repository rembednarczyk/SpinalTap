import type { ContractHookDef, Vec3 } from "@seki/core";
import { docks } from "./district-doki";
import { market } from "./district-targ";
import { spotNear } from "./lublin/places";

/**
 * Observation hooks (ADR-0032, ADR-0034): one or two per kind of contract, found on site while
 * the job runs. The ink (`packages/narrative/ink/hooks.ink`) holds the line, the mail or the
 * shard's contents under `knot`; `text` is the catalog key of the tracker's line once found
 * (`hook.<kind>_<n>`, ADR-0056): the app writes it in the player's language.
 *
 * - `bark`: a guard (the job's guard `post`, or a world character `key`) says it when the
 *   player comes within earshot.
 * - `terminal`: a mail on a terminal standing `at`, read with the interact key.
 * - `shard`: a datachip in the bag of the job's guard `post` once that guard is down.
 *
 * `reveal` says what it opens. A rotation gap is the guard's real timetable: the guard leaves
 * its post in the window whether or not the hook was found (the hook only tells). A code only
 * works once found: the office camera then takes the player for staff. Intel is a fact about
 * the site or the target the player can plan around.
 */
export type HookReveal =
  | { readonly kind: "rotation_gap"; readonly post: number; readonly period: number; readonly from: number; readonly to: number }
  | { readonly kind: "code" }
  | { readonly kind: "intel" };

export type HookCarrier = { readonly post: number } | { readonly key: string } | { readonly at: Vec3 };

export interface SimHookDef extends ContractHookDef {
  readonly carrier: HookCarrier;
  readonly reveal: HookReveal;
}

/** Minutes of the day. */
const at = (hour: number, minute = 0): number => hour * 60 + minute;
const DAY = 1440;

export const CONTRACT_HOOKS: readonly SimHookDef[] = [
  {
    id: "hook_eliminate_1",
    kind: "eliminate",
    source: "bark",
    knot: "hook_eliminate_1",
    text: "hook.eliminate_1",
    carrier: { post: 1 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_eliminate_2",
    kind: "eliminate",
    source: "shard",
    knot: "hook_eliminate_2",
    text: "hook.eliminate_2",
    carrier: { post: 1 },
    reveal: { kind: "rotation_gap", post: 1, period: DAY, from: at(2), to: at(2, 15) },
  },
  {
    id: "hook_delivery_1",
    kind: "delivery",
    source: "terminal",
    knot: "hook_delivery_1",
    text: "hook.delivery_1",
    carrier: { at: spotNear(649, 61) },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_delivery_2",
    kind: "delivery",
    source: "bark",
    knot: "hook_delivery_2",
    text: "hook.delivery_2",
    carrier: { key: "hebi-lookout" },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_retrieve_1",
    kind: "retrieve",
    source: "bark",
    knot: "hook_retrieve_1",
    text: "hook.retrieve_1",
    carrier: { post: 0 },
    reveal: { kind: "rotation_gap", post: 1, period: DAY, from: at(0), to: at(0, 15) },
  },
  {
    id: "hook_retrieve_2",
    kind: "retrieve",
    source: "shard",
    knot: "hook_retrieve_2",
    text: "hook.retrieve_2",
    carrier: { post: 1 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_protect_1",
    kind: "protect",
    source: "bark",
    knot: "hook_protect_1",
    text: "hook.protect_1",
    carrier: { post: 0 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_protect_2",
    kind: "protect",
    source: "terminal",
    knot: "hook_protect_2",
    text: "hook.protect_2",
    carrier: { at: market(93, 0, 70.5) },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_escort_1",
    kind: "escort",
    source: "bark",
    knot: "hook_escort_1",
    text: "hook.escort_1",
    carrier: { post: 0 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_escort_2",
    kind: "escort",
    source: "terminal",
    knot: "hook_escort_2",
    text: "hook.escort_2",
    carrier: { at: docks(10, 0, 98.5) },
    reveal: { kind: "rotation_gap", post: 3, period: DAY, from: at(1), to: at(3) },
  },
  {
    id: "hook_infiltrate_1",
    kind: "infiltrate",
    source: "terminal",
    knot: "hook_infiltrate_1",
    text: "hook.infiltrate_1",
    carrier: { at: docks(-15.4, 0, 126.6) },
    reveal: { kind: "code" },
  },
  {
    id: "hook_infiltrate_2",
    kind: "infiltrate",
    source: "bark",
    knot: "hook_infiltrate_2",
    text: "hook.infiltrate_2",
    carrier: { post: 2 },
    reveal: { kind: "rotation_gap", post: 1, period: 30, from: 20, to: 25 },
  },
  {
    id: "hook_hack_1",
    kind: "hack",
    source: "shard",
    knot: "hook_hack_1",
    text: "hook.hack_1",
    carrier: { post: 1 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_hack_2",
    kind: "hack",
    source: "bark",
    knot: "hook_hack_2",
    text: "hook.hack_2",
    carrier: { post: 0 },
    reveal: { kind: "intel" },
  },
];

/** The hooks of one kind of job, in table order. */
export const hooksOfKind = (kind: ContractHookDef["kind"]): readonly SimHookDef[] => CONTRACT_HOOKS.filter((h) => h.kind === kind);
