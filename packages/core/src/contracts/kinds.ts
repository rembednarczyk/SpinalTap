/**
 * Kinds of job. `eliminate`: kill every target. `delivery`: carry a package to Hana before the
 * deadline. `retrieve`: take a crate from a guarded Hebi stash and bring it back. `protect`:
 * keep Oyaji alive until the whole Hebi wave is down. Kept free of imports so the reputation
 * rules can name the kinds without a cycle.
 */
export const CONTRACT_KINDS = {
  eliminate: { id: "eliminate", giver: "kaito", title: "Likwidacja" },
  delivery: { id: "delivery", giver: "kaito", title: "Kurs" },
  retrieve: { id: "retrieve", giver: "hana", title: "Odzyskanie" },
  protect: { id: "protect", giver: "hana", title: "Ochrona" },
} as const;

export type ContractKind = keyof typeof CONTRACT_KINDS;

export type ContractGiverId = (typeof CONTRACT_KINDS)[ContractKind]["giver"];

export const CONTRACT_KIND_IDS = Object.keys(CONTRACT_KINDS) as ContractKind[];

export const isContractKind = (id: string): id is ContractKind => Object.hasOwn(CONTRACT_KINDS, id);
