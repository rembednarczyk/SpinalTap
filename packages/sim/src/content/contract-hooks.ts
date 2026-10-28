import type { ContractHookDef, Vec3 } from "@seki/core";
import { v } from "./builders";

/**
 * Observation hooks (ADR-0032, ADR-0034): one or two per kind of contract, found on site while
 * the job runs. The ink (`packages/narrative/ink/hooks.ink`) holds the line, the mail or the
 * shard's contents under `knot`; `text` is the tracker's line once found.
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
    text: "Szef ekipy co godzinę odchodzi sam na bok",
    carrier: { post: 1 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_eliminate_2",
    kind: "eliminate",
    source: "shard",
    knot: "hook_eliminate_2",
    text: "O 2:00 ganger od ulicy schodzi z posterunku na kwadrans",
    carrier: { post: 1 },
    reveal: { kind: "rotation_gap", post: 1, period: DAY, from: at(2), to: at(2, 15) },
  },
  {
    id: "hook_delivery_1",
    kind: "delivery",
    source: "terminal",
    knot: "hook_delivery_1",
    text: "Kładka nad Kanałową jest szybsza i nikt tam nie stoi",
    carrier: { at: v(12.5, 0, 74.6) },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_delivery_2",
    kind: "delivery",
    source: "bark",
    knot: "hook_delivery_2",
    text: "Hebi łapią kurierów pod kładką, na górę nie wchodzą",
    carrier: { key: "hebi-lookout" },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_retrieve_1",
    kind: "retrieve",
    source: "bark",
    knot: "hook_retrieve_1",
    text: "Po północy drugi strażnik skrytki idzie na kwadrans po ramen",
    carrier: { post: 0 },
    reveal: { kind: "rotation_gap", post: 1, period: DAY, from: at(0), to: at(0, 15) },
  },
  {
    id: "hook_retrieve_2",
    kind: "retrieve",
    source: "shard",
    knot: "hook_retrieve_2",
    text: "Z estakady widać skrytkę; strażnicy pilnują tylko przejścia",
    carrier: { post: 1 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_protect_1",
    kind: "protect",
    source: "bark",
    knot: "hook_protect_1",
    text: "Hebi idą na Oyaji zawsze tą samą drogą",
    carrier: { post: 0 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_protect_2",
    kind: "protect",
    source: "terminal",
    knot: "hook_protect_2",
    text: "Z balkonu schodów pożarowych widać całe przejście",
    carrier: { at: v(93, 0, 70.5) },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_escort_1",
    kind: "escort",
    source: "bark",
    knot: "hook_escort_1",
    text: "Zasadzka czeka przy biurze, nie na molo",
    carrier: { post: 0 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_escort_2",
    kind: "escort",
    source: "terminal",
    knot: "hook_escort_2",
    text: "Wschodnia alejka placu bez obsady od 1:00 do 3:00",
    carrier: { at: v(10, 0, 98.5) },
    reveal: { kind: "rotation_gap", post: 3, period: DAY, from: at(1), to: at(3) },
  },
  {
    id: "hook_infiltrate_1",
    kind: "infiltrate",
    source: "terminal",
    knot: "hook_infiltrate_1",
    text: "Kod do bocznych drzwi biura: 4177 (kamera bierze cię za personel)",
    carrier: { at: v(-15.4, 0, 126.6) },
    reveal: { kind: "code" },
  },
  {
    id: "hook_infiltrate_2",
    kind: "infiltrate",
    source: "bark",
    knot: "hook_infiltrate_2",
    text: "Strażnik spod drzwi biura co pół godziny wychodzi zapalić",
    carrier: { post: 2 },
    reveal: { kind: "rotation_gap", post: 1, period: 30, from: 20, to: 25 },
  },
  {
    id: "hook_hack_1",
    kind: "hack",
    source: "shard",
    knot: "hook_hack_1",
    text: "Snajper po trzecim strzale ma cztery sekundy bez lasera",
    carrier: { post: 1 },
    reveal: { kind: "intel" },
  },
  {
    id: "hook_hack_2",
    kind: "hack",
    source: "bark",
    knot: "hook_hack_2",
    text: "Pod wysięgnikiem dźwigu snajper cię nie widzi",
    carrier: { post: 0 },
    reveal: { kind: "intel" },
  },
];

/** The hooks of one kind of job, in table order. */
export const hooksOfKind = (kind: ContractHookDef["kind"]): readonly SimHookDef[] => CONTRACT_HOOKS.filter((h) => h.kind === kind);
