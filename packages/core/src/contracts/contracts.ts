import { contractPayout } from "../economy/wallet";
import { enemyScale } from "../progression/bands";
import { MIN_LEVEL } from "../progression/curve";
import { type TextRef, textRef } from "../i18n/text";
import type { RandomPort } from "../ports/random-port";
import type { FactionId, ReputationState } from "../reputation/reputation";
import type { Flags } from "../state/flags";
import { CONTRACT_KINDS, type ContractGiverId, type ContractKind } from "./kinds";
import type { ContractTally } from "./scoring";
import type { BreachDaemonId } from "../hacking/quickhacks";
import type { ContractVariation } from "../world/wave2";

/**
 * Places where a contract sends Seki. Positions live in sim content. `text` is the catalog key of
 * the place (ADR-0056), for the HUD and for the ink dialogues alike.
 */
const site = <const Id extends string>(id: Id) => ({ id, text: `contract.site.${id}` as const });

export const CONTRACT_SITES = {
  // Krakowskie Przedmieście (ADR-0045).
  east_lot: site("east_lot"),
  koi_back: site("koi_back"),
  car_wash: site("car_wash"),
  south_gate: site("south_gate"),
  // Stare Miasto (ADR-0026, ADR-0045).
  kanal_bridge: site("kanal_bridge"),
  // Podzamcze: the market under the viaduct over aleja Tysiąclecia (M4, ADR-0045).
  hana_stall: site("hana_stall"),
  hebi_stash: site("hebi_stash"),
  raid_north: site("raid_north"),
  raid_east: site("raid_east"),
  // Nabrzeże Bystrzycy (M4, ADR-0024, ADR-0045).
  docks_escort: site("docks_escort"),
  tessen_office: site("tessen_office"),
  quay_terminal: site("quay_terminal"),
} as const;

export type ContractSiteId = keyof typeof CONTRACT_SITES;

export const CONTRACT_SITE_IDS = Object.keys(CONTRACT_SITES) as ContractSiteId[];

/**
 * Where Kaito's elimination jobs happen: the M1 sites in their original order, then the spot
 * under the footbridge on Grodzka (ADR-0026, ADR-0045).
 */
export const ELIMINATION_SITE_IDS: readonly ContractSiteId[] = ["east_lot", "koi_back", "car_wash", "south_gate", "kanal_bridge"];

const RAID_SITE_IDS: readonly ContractSiteId[] = ["raid_north", "raid_east"];

export const isContractSiteId = (id: string): id is ContractSiteId => Object.hasOwn(CONTRACT_SITES, id);

/**
 * People who hand out contracts. Their faction's standing scales the pay. The name stays as it
 * is in every language; "go back to … for your pay" takes the giver from the catalog
 * (`contract.giver.<id>`, the genitive in Polish).
 */
export const CONTRACT_GIVERS = {
  kaito: { id: "kaito", name: "Kaito", faction: "fixers" },
  hana: { id: "hana", name: "Hana", faction: "civilians" },
  // A smuggler in the docks, part of Kaito's network: fixer standing scales his pay too.
  genzo: { id: "genzo", name: "Genzō", faction: "fixers" },
} as const satisfies Record<ContractGiverId, { id: ContractGiverId; name: string; faction: FactionId }>;

/** The giver as "go back to … for your pay" names them, a text for app and ui. */
export const giverText = (giver: ContractGiverId): TextRef => textRef(`contract.giver.${giver}`);

export interface Contract {
  readonly id: string;
  /** Absent in saves from before M4: those are eliminations. */
  readonly kind?: ContractKind;
  readonly siteId: ContractSiteId;
  /** Gangers spawned for the job: targets, stash guards or the raiding wave. 0 for a delivery. */
  readonly targets: number;
  /** Payout agreed at acceptance (already scaled by the giver's standing). */
  readonly reward: number;
  /** "cleared": the job itself is done (targets down, package handed over, crate taken). */
  readonly status: "active" | "cleared";
  /** Delivery only: the simulation tick by which the package must reach Hana. */
  readonly deadlineTick?: number;
  /**
   * Hack only (ADR-0024): simulation ticks of connection so far, present once the hack has
   * started. The job is done at `HACK_SECONDS` worth of ticks.
   */
  readonly progress?: number;
  /** Hack only: ticks in a row the player has been away from the running terminal. */
  readonly away?: number;
  /** Hack only: daemons won on the terminal (the breach is applied once). */
  readonly breach?: readonly BreachDaemonId[];
  /**
   * What changes the plan (ADR-0034), rolled at acceptance. Absent on the first contracts and
   * in saves from before wave 2: a plain job.
   */
  readonly variation?: ContractVariation;
}

export interface ContractLog {
  readonly active: Contract | null;
  readonly completed: number;
  /**
   * Debrief counters of the active contract (ADR-0029), kept beside it so the contract itself
   * (and the events that carry it) stays what was agreed. Absent or null without a contract.
   */
  readonly tally?: ContractTally | null;
  /** Ids of the observation hooks found during the active contract (ADR-0034). */
  readonly hooks?: readonly string[];
}

export const EMPTY_CONTRACTS: ContractLog = { active: null, completed: 0 };

export const contractKind = (c: Contract): ContractKind => c.kind ?? "eliminate";

export const contractGiver = (c: Contract): (typeof CONTRACT_GIVERS)[ContractGiverId] => CONTRACT_GIVERS[CONTRACT_KINDS[contractKind(c)].giver];

/** Tag carried by every ganger of a contract; EntityKilled reports it. */
export const contractTag = (contractId: string): string => `contract:${contractId}`;

/** Raised when a contract fails. Failed ids are never reused, so their dead-target flags stay theirs. */
export const contractFailedFlag = (contractId: string): string => `contract_failed:${contractId}`;

/** Key of the crate a retrieval contract is about. */
export const contractItemKey = (contractId: string): string => `${contractId}-item`;

/** Raised when the crate of a retrieval contract has been picked up. */
export const takenFlag = (key: string): string => `taken:${key}`;

/** The NPC a protection contract is about. */
export const PROTECTEE_KEY = "oyaji";

/** Key of the defector an escort contract walks to the boat. */
export const contractEscortKey = (contractId: string): string => `${contractId}-escort`;

/** Key of the terminal a hack contract breaks into. */
export const contractTerminalKey = (contractId: string): string => `${contractId}-terminal`;

/**
 * Raised when a contract's second phase begins: the ambush of an escort, the wave of a hack.
 * Gangers waiting for it spawn then (and after a load, if it is already up).
 */
export const contractAlarmFlag = (contractId: string): string => `alarm:${contractId}`;

/** Seconds of connection a hack needs. */
export const HACK_SECONDS = 40;

/** Seconds in a row the player may leave a running hack before the connection drops. */
export const HACK_GRACE_SECONDS = 15;

export type ContractFailure = "timeout" | "protectee-killed" | "escort-killed" | "detected" | "connection-lost";

/** Everything a contract generator may look at besides the random stream. */
export interface ContractContext {
  readonly log: ContractLog;
  readonly reputation: ReputationState;
  readonly flags: Flags;
  /** Current simulation tick and the tick rate, for deadlines. */
  readonly tick: number;
  readonly ticksPerSecond: number;
  /**
   * The level of a job at `site` (ADR-0059): that of an enemy in the site's district, which the
   * sim knows from its bands. Without it every job is of level 1.
   */
  readonly levelAt?: (site: ContractSiteId) => number;
}

const nextContractId = (log: ContractLog, flags: Flags): string =>
  `c${log.completed + flags.filter((f) => f.startsWith("contract_failed:")).length + 1}`;

/**
 * The crew of a job grows with its level (ADR-0059), in place of the old one more man every three
 * jobs done: one more every CONTRACT_LEVELS_PER_TARGET levels (the user's decision of 6.11), so a
 * job of level 1 to 4 sends its template's crew, one of level 5 one more, of 10 two more and so on.
 * Each template's own limit (4, or 5 for the bigger docks crews) caps it. First guesses for stage 8.
 */
export const CONTRACT_CREW_LEVEL = 0;
export const CONTRACT_LEVELS_PER_TARGET = 5;

/** Men a job of `level` sends on top of its template's: none up to level 4, 1 to 9, 2 to 14, and so on. */
export const contractExperience = (level: number): number => Math.max(0, Math.floor((Math.round(level) - CONTRACT_CREW_LEVEL) / CONTRACT_LEVELS_PER_TARGET));

/**
 * The pay of a job of `level`: the template's rates are those of level 1 (ADR-0018, ADR-0024)
 * and grow as an enemy's health does (+4% a level), then the giver's standing scales it.
 */
export const contractPay = (base: number, level: number, reputation: number): number => contractPayout(base * enemyScale(level), reputation);

/**
 * Procedural elimination job from Kaito (M1). Consumes exactly two random numbers. A job of a
 * higher level (its site's district, ADR-0059) sends more targets and pays more; standing with
 * the fixer scales the payout.
 */
export const generateContract = (log: ContractLog, rng: RandomPort, fixerReputation: number, levelAt?: (site: ContractSiteId) => number): Contract => {
  const site = ELIMINATION_SITE_IDS[Math.floor(rng.next() * ELIMINATION_SITE_IDS.length)] ?? "east_lot";
  const level = levelAt?.(site) ?? MIN_LEVEL;
  const targets = Math.min(4, 2 + Math.floor(rng.next() * 2) + contractExperience(level));
  return {
    id: `c${log.completed + 1}`,
    siteId: site,
    targets,
    reward: contractPay(250 + targets * 125, level, fixerReputation),
    status: "active",
  };
};

/** Delivery time limits in seconds. The sprint from Kaito to Hana takes about 25 s, a walk about 40 s. */
export const DELIVERY_LIMITS = [50, 65, 80] as const;

/** Pay for a delivery: the tighter the limit, the more it pays. */
export const deliveryBase = (limitSeconds: number): number => 200 + (90 - limitSeconds) * 5;

/** Base pay of the docks jobs before the per-guard part (ADR-0024 balance table). */
const DOCKS_BASE = { escort: 320, infiltrate: 380, hack: 340 } as const;

/** A crew of 2 or 3 (3 or 4 for `bigger`) by one random number, more at a higher level, at most 4 (5). */
const crewOf = (r: number, level: number, bigger: boolean): number => Math.min(bigger ? 5 : 4, (bigger ? 3 : 2) + Math.floor(r * 2) + contractExperience(level));

/**
 * A contract of the given kind. Each generator consumes a fixed amount of randomness:
 * elimination two numbers (site, targets), delivery one (time limit), retrieval one (guards),
 * protection two (approach, wave size), and each docks job one (guards or wave size). The crew
 * and the pay come from the job's level (`levelAt`, ADR-0059), the pay also from the giver's standing.
 */
export const generateContractOfKind = (kind: ContractKind, ctx: ContractContext, rng: RandomPort): Contract => {
  const id = nextContractId(ctx.log, ctx.flags);
  const giverRep = ctx.reputation[CONTRACT_GIVERS[CONTRACT_KINDS[kind].giver].faction];
  const levelAt = (site: ContractSiteId): number => ctx.levelAt?.(site) ?? MIN_LEVEL;
  const job = (siteId: ContractSiteId, r: number, bigger: boolean, base: number, perTarget: number): Contract => {
    const level = levelAt(siteId);
    const targets = crewOf(r, level, bigger);
    return { id, kind, siteId, targets, reward: contractPay(base + targets * perTarget, level, giverRep), status: "active" };
  };
  switch (kind) {
    case "eliminate":
      return { ...generateContract(ctx.log, rng, giverRep, ctx.levelAt), id };
    case "delivery": {
      const limit = DELIVERY_LIMITS[Math.floor(rng.next() * DELIVERY_LIMITS.length)] ?? DELIVERY_LIMITS[1];
      return {
        id,
        kind,
        siteId: "hana_stall",
        targets: 0,
        reward: contractPay(deliveryBase(limit), levelAt("hana_stall"), giverRep),
        status: "active",
        deadlineTick: ctx.tick + limit * ctx.ticksPerSecond,
      };
    }
    case "retrieve":
      return job("hebi_stash", rng.next(), false, 250, 110);
    case "protect": {
      const site = RAID_SITE_IDS[Math.floor(rng.next() * RAID_SITE_IDS.length)] ?? "raid_north";
      return job(site, rng.next(), false, 300, 125);
    }
    // The docks (ADR-0024): corporate guards in armour, so a man there is worth more than a Hebi.
    case "escort":
      return job("docks_escort", rng.next(), false, DOCKS_BASE.escort, 130);
    case "infiltrate":
      return job("tessen_office", rng.next(), true, DOCKS_BASE.infiltrate, 80);
    case "hack":
      return job("quay_terminal", rng.next(), true, DOCKS_BASE.hack, 120);
  }
};

/** The kinds the docks giver hands out, in the order his dialogue offers them. */
export const DOCKS_CONTRACT_KINDS: readonly ContractKind[] = ["escort", "infiltrate", "hack"];

/**
 * Whole seconds left (never negative): until a delivery deadline, or of a running hack's
 * connection. Null for jobs without a clock.
 */
export const contractSecondsLeft = (c: Contract, tick: number, ticksPerSecond: number): number | null => {
  if (c.progress !== undefined) return Math.max(0, Math.ceil(HACK_SECONDS - c.progress / ticksPerSecond));
  return c.deadlineTick === undefined ? null : Math.max(0, Math.ceil((c.deadlineTick - tick) / ticksPerSecond));
};

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * What to do next, for the HUD and the journal, as a key with parameters (ADR-0056): the site and
 * the giver are texts of their own, the clock a string. `secondsLeft` adds the delivery clock.
 */
export const contractObjective = (c: Contract, secondsLeft: number | null = null): TextRef => {
  if (c.status === "cleared") return textRef("contract.objective.cleared", { note: textRef(contractClearedNote(c)), giver: giverText(contractGiver(c).id) });
  const site = textRef(CONTRACT_SITES[c.siteId].text);
  const targets = c.targets;
  const timed: Readonly<Record<string, string>> = secondsLeft === null ? {} : { time: clock(secondsLeft) };
  switch (contractKind(c)) {
    case "eliminate":
      return textRef("contract.objective.eliminate", { targets, site });
    case "delivery":
      return textRef(secondsLeft === null ? "contract.objective.delivery" : "contract.objective.deliveryTimed", { site, ...timed });
    case "retrieve":
      return textRef("contract.objective.retrieve", { targets, site });
    case "protect":
      return textRef("contract.objective.protect", { targets, site });
    case "escort":
      return textRef("contract.objective.escort", { targets, site });
    case "infiltrate":
      return textRef("contract.objective.infiltrate", { targets, site });
    case "hack":
      if (c.progress === undefined) return textRef("contract.objective.hack", { seconds: HACK_SECONDS, site });
      return textRef(secondsLeft === null ? "contract.objective.hackHolding" : "contract.objective.hackHoldingTimed", { site, ...timed });
  }
};

/** Catalog key of the short note for the moment the job itself is done. */
export const contractClearedNote = (c: Contract): string => `contract.cleared.${contractKind(c)}`;

/**
 * Catalog key of why a contract fell through, as the HUD says it. A missed deadline of a varied
 * job (ADR-0034) is not about a package.
 */
export const contractFailureNote = (reason: ContractFailure, kind: ContractKind = "delivery"): string =>
  reason === "timeout" && kind !== "delivery" ? "contract.failure.deadline" : `contract.failure.${reason}`;
