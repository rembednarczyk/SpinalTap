import { contractPayout } from "../economy/wallet";
import type { RandomPort } from "../ports/random-port";
import type { FactionId, ReputationState } from "../reputation/reputation";
import type { Flags } from "../state/flags";
import { CONTRACT_KINDS, type ContractGiverId, type ContractKind } from "./kinds";

/** Places where a contract sends Seki. Positions live in sim content. */
export const CONTRACT_SITES = {
  east_lot: { id: "east_lot", label: "parking przy furgonetce, wschodnia strona" },
  koi_back: { id: "koi_back", label: "ulica na wysokości baru Neon Koi" },
  car_wash: { id: "car_wash", label: "zaułek za myjnią" },
  south_gate: { id: "south_gate", label: "brama południowa przy wraku" },
  // Targ pod estakadą (M4).
  hana_stall: { id: "hana_stall", label: "wózek Hany na targu pod estakadą" },
  hebi_stash: { id: "hebi_stash", label: "skrytka Hebi pod estakadą, wschodni koniec targu" },
  raid_north: { id: "raid_north", label: "stragan Oyaji, Hebi idą spod estakady" },
  raid_east: { id: "raid_east", label: "stragan Oyaji, Hebi idą od wschodniej ściany" },
} as const;

export type ContractSiteId = keyof typeof CONTRACT_SITES;

export const CONTRACT_SITE_IDS = Object.keys(CONTRACT_SITES) as ContractSiteId[];

/** Where Kaito's elimination jobs happen (the M1 sites, in their original order). */
export const ELIMINATION_SITE_IDS: readonly ContractSiteId[] = ["east_lot", "koi_back", "car_wash", "south_gate"];

const RAID_SITE_IDS: readonly ContractSiteId[] = ["raid_north", "raid_east"];

export const isContractSiteId = (id: string): id is ContractSiteId => Object.hasOwn(CONTRACT_SITES, id);

/** People who hand out contracts. Their faction's standing scales the pay. */
export const CONTRACT_GIVERS = {
  kaito: { id: "kaito", name: "Kaito", genitive: "Kaito", faction: "fixers" },
  hana: { id: "hana", name: "Hana", genitive: "Hany", faction: "civilians" },
} as const satisfies Record<ContractGiverId, { id: ContractGiverId; name: string; genitive: string; faction: FactionId }>;

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
}

export interface ContractLog {
  readonly active: Contract | null;
  readonly completed: number;
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

export type ContractFailure = "timeout" | "protectee-killed";

/** Everything a contract generator may look at besides the random stream. */
export interface ContractContext {
  readonly log: ContractLog;
  readonly reputation: ReputationState;
  readonly flags: Flags;
  /** Current simulation tick and the tick rate, for deadlines. */
  readonly tick: number;
  readonly ticksPerSecond: number;
}

const nextContractId = (log: ContractLog, flags: Flags): string =>
  `c${log.completed + flags.filter((f) => f.startsWith("contract_failed:")).length + 1}`;

/**
 * Procedural elimination job from Kaito (M1). Consumes exactly two random numbers. Later
 * contracts send more targets and pay more; standing with the fixer scales the payout.
 */
export const generateContract = (log: ContractLog, rng: RandomPort, fixerReputation: number): Contract => {
  const site = ELIMINATION_SITE_IDS[Math.floor(rng.next() * ELIMINATION_SITE_IDS.length)] ?? "east_lot";
  const targets = Math.min(4, 2 + Math.floor(rng.next() * 2) + Math.floor(log.completed / 3));
  return {
    id: `c${log.completed + 1}`,
    siteId: site,
    targets,
    reward: contractPayout(250 + targets * 125, fixerReputation),
    status: "active",
  };
};

/** Delivery time limits in seconds. The sprint from Kaito to Hana takes about 25 s, a walk about 40 s. */
export const DELIVERY_LIMITS = [50, 65, 80] as const;

/** Pay for a delivery: the tighter the limit, the more it pays. */
export const deliveryBase = (limitSeconds: number): number => 200 + (90 - limitSeconds) * 5;

/**
 * A contract of the given kind. Each generator consumes a fixed amount of randomness:
 * elimination two numbers (site, targets), delivery one (time limit), retrieval one (guards),
 * protection two (approach, wave size).
 */
export const generateContractOfKind = (kind: ContractKind, ctx: ContractContext, rng: RandomPort): Contract => {
  const id = nextContractId(ctx.log, ctx.flags);
  const giverRep = ctx.reputation[CONTRACT_GIVERS[CONTRACT_KINDS[kind].giver].faction];
  const experience = Math.floor(ctx.log.completed / 3);
  switch (kind) {
    case "eliminate":
      return { ...generateContract(ctx.log, rng, giverRep), id };
    case "delivery": {
      const limit = DELIVERY_LIMITS[Math.floor(rng.next() * DELIVERY_LIMITS.length)] ?? DELIVERY_LIMITS[1];
      return {
        id,
        kind,
        siteId: "hana_stall",
        targets: 0,
        reward: contractPayout(deliveryBase(limit), giverRep),
        status: "active",
        deadlineTick: ctx.tick + limit * ctx.ticksPerSecond,
      };
    }
    case "retrieve": {
      const targets = Math.min(4, 2 + Math.floor(rng.next() * 2) + experience);
      return { id, kind, siteId: "hebi_stash", targets, reward: contractPayout(250 + targets * 110, giverRep), status: "active" };
    }
    case "protect": {
      const site = RAID_SITE_IDS[Math.floor(rng.next() * RAID_SITE_IDS.length)] ?? "raid_north";
      const targets = Math.min(4, 2 + Math.floor(rng.next() * 2) + experience);
      return { id, kind, siteId: site, targets, reward: contractPayout(300 + targets * 125, giverRep), status: "active" };
    }
  }
};

/** Whole seconds left until a delivery deadline (never negative), or null for jobs without one. */
export const contractSecondsLeft = (c: Contract, tick: number, ticksPerSecond: number): number | null =>
  c.deadlineTick === undefined ? null : Math.max(0, Math.ceil((c.deadlineTick - tick) / ticksPerSecond));

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** What to do next, for the HUD and the journal. `secondsLeft` adds the delivery clock. */
export const contractObjective = (c: Contract, secondsLeft: number | null = null): string => {
  if (c.status === "cleared") return `${contractClearedNote(c)}. Wróć do ${contractGiver(c).genitive} po zapłatę`;
  const site = CONTRACT_SITES[c.siteId].label;
  switch (contractKind(c)) {
    case "eliminate":
      return `Zneutralizuj gangerów Hebi (${c.targets}): ${site}`;
    case "delivery":
      return `Zanieś paczkę od Kaito Hanie: ${site}${secondsLeft === null ? "" : ` (zostało ${clock(secondsLeft)})`}`;
    case "retrieve":
      return `Zabierz skrzynkę Hany ze skrytki Hebi (strażnicy: ${c.targets}): ${site}`;
    case "protect":
      return `Obroń Oyaji przed Hebi (${c.targets}): ${site}`;
  }
};

/** Short note for the moment the job itself is done. */
export const contractClearedNote = (c: Contract): string => {
  switch (contractKind(c)) {
    case "eliminate":
      return "Cele zneutralizowane";
    case "delivery":
      return "Paczka oddana";
    case "retrieve":
      return "Skrzynka zabrana";
    case "protect":
      return "Oyaji żyje, Hebi leżą";
  }
};

/** Why a contract fell through, as the HUD says it. */
export const contractFailureNote = (reason: ContractFailure): string =>
  reason === "timeout" ? "Paczka nie dotarła na czas. Kaito nie będzie zadowolony" : "Oyaji nie żyje. Zlecenie Hany przepadło";
