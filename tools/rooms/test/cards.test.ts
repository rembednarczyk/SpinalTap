import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTERIORS, inventoryOf, withInventory } from "../src/inventory";

/*
 * The rule of room cards (`docs/zasady-lokacji.md` §11, the user's decision of 22.11): every interior
 * of the game (`INTERIORS`) has its card in `docs/pomieszczenia/<id>.md` with its story, its climate,
 * its purpose and its inventory (the target one, written; the game's, generated). With
 * `ROOMS_CARDS=write` (`pnpm rooms:write`) the generated block is written into each card.
 */

const CARDS = new URL("../../../docs/pomieszczenia/", import.meta.url);
const SECTIONS = ["## Historia", "## Klimat", "## Przeznaczenie", "## Inwentarz docelowy", "## Inwentarz gry"] as const;
const WRITE = process.env.ROOMS_CARDS === "write";

describe("the room cards (zasady-lokacji §11)", () => {
  for (const i of INTERIORS) {
    it(`has the card of ${i.id} with its five parts and the game's inventory as it is`, () => {
      const file = new URL(`${i.id}.md`, CARDS);
      expect(existsSync(file), `docs/pomieszczenia/${i.id}.md`).toBe(true);
      const text = readFileSync(file, "utf8");
      for (const s of SECTIONS) expect(text, `${i.id}: ${s}`).toContain(s);
      const want = withInventory(text, inventoryOf(i));
      if (WRITE && want !== text) writeFileSync(file, want);
      else expect(text, `${i.id}: run pnpm rooms:write`).toBe(want);
    });
  }
});
