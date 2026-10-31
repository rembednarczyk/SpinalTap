/**
 * Kinds of job. `eliminate`: kill every target. `delivery`: carry a package to Hana before the
 * deadline. `retrieve`: take a crate from a guarded Hebi stash and bring it back. `protect`:
 * keep Oyaji alive until the whole Hebi wave is down. In the docks (Genzō): `escort` walks a
 * defector to the boat through a Tessen ambush, `infiltrate` copies data from the corporate office
 * without being seen, `hack` holds a terminal while a wave comes. Kept free of imports so the reputation
 * rules can name the kinds without a cycle. `title` is the catalog key of the kind's name (ADR-0056).
 */
export const CONTRACT_KINDS = {
  eliminate: { id: "eliminate", giver: "kaito", title: "contract.kind.eliminate" },
  delivery: { id: "delivery", giver: "kaito", title: "contract.kind.delivery" },
  retrieve: { id: "retrieve", giver: "hana", title: "contract.kind.retrieve" },
  protect: { id: "protect", giver: "hana", title: "contract.kind.protect" },
  // The docks (ADR-0024).
  escort: { id: "escort", giver: "genzo", title: "contract.kind.escort" },
  infiltrate: { id: "infiltrate", giver: "genzo", title: "contract.kind.infiltrate" },
  hack: { id: "hack", giver: "genzo", title: "contract.kind.hack" },
} as const;

export type ContractKind = keyof typeof CONTRACT_KINDS;

export type ContractGiverId = (typeof CONTRACT_KINDS)[ContractKind]["giver"];

export const CONTRACT_KIND_IDS = Object.keys(CONTRACT_KINDS) as ContractKind[];

export const isContractKind = (id: string): id is ContractKind => Object.hasOwn(CONTRACT_KINDS, id);
