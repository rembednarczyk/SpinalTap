import { contractPayout } from "../economy/wallet";
import type { RandomPort } from "../ports/random-port";

/** Places in the district where the fixer can send Seki. Positions live in sim content. */
export const CONTRACT_SITES = {
  east_lot: { id: "east_lot", label: "parking przy furgonetce, wschodnia strona" },
  koi_back: { id: "koi_back", label: "ulica na wysokości baru Neon Koi" },
  car_wash: { id: "car_wash", label: "zaułek za myjnią" },
  south_gate: { id: "south_gate", label: "brama południowa przy wraku" },
} as const;

export type ContractSiteId = keyof typeof CONTRACT_SITES;

export const CONTRACT_SITE_IDS = Object.keys(CONTRACT_SITES) as ContractSiteId[];

export const isContractSiteId = (id: string): id is ContractSiteId => Object.hasOwn(CONTRACT_SITES, id);

export interface Contract {
  readonly id: string;
  readonly siteId: ContractSiteId;
  readonly targets: number;
  /** Payout agreed at acceptance (already scaled by reputation). */
  readonly reward: number;
  readonly status: "active" | "cleared";
}

export interface ContractLog {
  readonly active: Contract | null;
  readonly completed: number;
}

export const EMPTY_CONTRACTS: ContractLog = { active: null, completed: 0 };

/** Tag carried by every target of a contract; EntityKilled reports it. */
export const contractTag = (contractId: string): string => `contract:${contractId}`;

/**
 * Procedural fixer job. Consumes exactly two random numbers. Later contracts send more
 * targets and pay more; standing with the fixer scales the payout.
 */
export const generateContract = (log: ContractLog, rng: RandomPort, fixerReputation: number): Contract => {
  const site = CONTRACT_SITE_IDS[Math.floor(rng.next() * CONTRACT_SITE_IDS.length)] ?? "east_lot";
  const targets = Math.min(4, 2 + Math.floor(rng.next() * 2) + Math.floor(log.completed / 3));
  return {
    id: `c${log.completed + 1}`,
    siteId: site,
    targets,
    reward: contractPayout(250 + targets * 125, fixerReputation),
    status: "active",
  };
};

export const contractObjective = (c: Contract): string =>
  c.status === "cleared"
    ? "Kontrakt wykonany. Wróć do Kaito po zapłatę"
    : `Zneutralizuj gangerów Hebi (${c.targets}): ${CONTRACT_SITES[c.siteId].label}`;
