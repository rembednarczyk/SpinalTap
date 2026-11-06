import type { Rarity } from "../items/types";
import type { CyberwareSlot } from "./cyberware";

/** Tier and level of a graded implant (the cyberdeck, decision of 6.11 after ADR-0059 stage 6). */
export interface ImplantGrade {
  readonly rarity: Rarity;
  readonly level: number;
}

/** Grades of the installed graded implants, by slot; absent for the rest. */
export type ImplantGrades = Readonly<Partial<Record<CyberwareSlot, ImplantGrade>>>;
