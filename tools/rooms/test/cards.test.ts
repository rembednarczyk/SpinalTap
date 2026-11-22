import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTERIORS, inventoryOf, withInventory } from "../src/inventory";

/*
 * The rule of room cards (`docs/zasady-lokacji.md` §11, the user's decision of 22.11): every interior
 * of the game (`INTERIORS`) has its card in `docs/pomieszczenia/<id>.md` with its story, its climate,
 * its purpose, its inventory (the target one, written; the game's, generated, with the rules' measures) and its
 * audit against §12–§17 (its faction and a line a rule, the user's rules of 22.11). With
 * `ROOMS_CARDS=write` (`pnpm rooms:write`) the generated block is written into each card.
 */

const CARDS = new URL("../../../docs/pomieszczenia/", import.meta.url);
const SECTIONS = ["## Historia", "## Klimat", "## Przeznaczenie", "## Inwentarz docelowy", "## Frakcja i zasady", "## Inwentarz gry"] as const;
/** The faction that rules the place (§16): street, technology or a corporation, the first word after `Frakcja:`. */
const FACTION = /^Frakcja: (ulica|technika|korporacja)\b/m;
const WRITE = process.env.ROOMS_CARDS === "write";

describe("the room cards (zasady-lokacji §11)", () => {
  for (const i of INTERIORS) {
    it(`has the card of ${i.id} with its five parts and the game's inventory as it is`, () => {
      const file = new URL(`${i.id}.md`, CARDS);
      expect(existsSync(file), `docs/pomieszczenia/${i.id}.md`).toBe(true);
      const text = readFileSync(file, "utf8");
      for (const s of SECTIONS) expect(text, `${i.id}: ${s}`).toContain(s);
      // The audit of §12–§17: its faction and a line for each rule.
      expect(text, `${i.id}: Frakcja: ulica|technika|korporacja`).toMatch(FACTION);
      for (const rule of ["§12", "§13", "§14", "§15", "§16", "§17"]) expect(text, `${i.id}: ${rule} w audycie`).toMatch(new RegExp(`^- ${rule} `, "m"));
      const want = withInventory(text, inventoryOf(i), i);
      if (WRITE && want !== text) writeFileSync(file, want);
      else expect(text, `${i.id}: run pnpm rooms:write`).toBe(want);
    });
  }
});
