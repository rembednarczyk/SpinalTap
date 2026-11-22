import type { StreetPropItem } from "../../../packages/core/src";
import { ALCHEMIA_PIECES } from "../../../packages/sim/src/content/alchemia";
import { type InteriorDef, type InteriorRoom, INTERIORS } from "../../../packages/sim/src/content/interior-areas";
import { WORLD_CHUNKS, WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";

/*
 * The inventory of a room as the game has it (the rule of room cards, `docs/zasady-lokacji.md` §11):
 * what stands inside each interior's boxes (`INTERIORS`), counted by what it is. Three sources, the
 * ones the simulation hands the renderer:
 * - the chunks' static props (solids and views: a block by its material, a neon, a lamp, a door...);
 * - the furniture and the game's models (`street-props` items of the scenery and of the chunks), by kind;
 * - Alchemia's drawn pieces (counters, shelves, screens, cups...), by kind.
 * Pure data; `cards.test.ts` checks it is current in each card, and with `ROOMS_CARDS=write` (`pnpm rooms:write`) puts it in.
 */

export type Inventory = ReadonlyMap<string, number>;

const inside = (r: InteriorRoom, x: number, y: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && y >= r.bottom - 0.3 && y <= r.top;
const inAny = (i: InteriorDef, x: number, y: number, z: number): boolean => i.rooms.some((r) => inside(r, x, y, z));

/** A static prop's name in the inventory: its view's kind, a block by its material (and a sloped one as stairs or a ramp). */
const propName = (view: { readonly kind: string; readonly material?: string; readonly slope?: unknown }): string => {
  if (view.kind === "block") return view.slope ? `blok (${view.material ?? "?"}, pochyły)` : `blok (${view.material ?? "?"})`;
  return view.kind;
};

const count = (m: Map<string, number>, key: string): void => {
  m.set(key, (m.get(key) ?? 0) + 1);
};

/** Street props of the scenery and the chunks, in world metres. */
const streetItems = (): { readonly item: StreetPropItem; readonly x: number; readonly y: number; readonly z: number }[] => {
  const out: { item: StreetPropItem; x: number; y: number; z: number }[] = [];
  for (const s of WORLD_SCENERY) {
    if (s.view.kind !== "street-props") continue;
    for (const item of s.view.items) out.push({ item, x: s.at.x + item.x, y: s.at.y + item.y, z: s.at.z + item.z });
  }
  return out;
};

/** What the game puts in an interior, counted: `prop:` the chunks' props, `model:` the furniture and models, `piece:` Alchemia's drawn pieces. */
export const inventoryOf = (i: InteriorDef): Inventory => {
  const m = new Map<string, number>();
  for (const c of WORLD_CHUNKS)
    for (const p of [...c.props, ...(c.street ?? [])]) {
      if (p.view.kind === "street-props" || p.view.kind === "building") continue;
      if (inAny(i, p.center.x, p.center.y, p.center.z)) count(m, `prop: ${propName(p.view as { kind: string; material?: string; slope?: unknown })}`);
    }
  for (const s of streetItems()) if (inAny(i, s.x, s.y, s.z)) count(m, `model: ${s.item.prop}`);
  for (const p of ALCHEMIA_PIECES) {
    const b = p.box;
    if (inAny(i, (b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2)) count(m, `piece: ${p.kind}`);
  }
  return new Map([...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
};

/** The inventory as the card's generated block: one line a kind, with its count; a note when the game has nothing in it. */
export const renderInventory = (inv: Inventory): string => {
  if (inv.size === 0) return "- (gra nie ma tu jeszcze nic poza bryłą pomieszczenia)";
  return [...inv.entries()].map(([k, n]) => `- ${k} × ${n}`).join("\n");
};

export const START = "<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->";
export const END = "<!-- inwentarz-gry:end -->";

/** A card's text with its generated block put in (between the markers), or appended at its end. */
export const withInventory = (text: string, inv: Inventory): string => {
  const block = `${START}\n${renderInventory(inv)}\n${END}`;
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a >= 0 && b > a) return `${text.slice(0, a)}${block}${text.slice(b + END.length)}`;
  return `${text.trimEnd()}\n\n${block}\n`;
};

export { INTERIORS };
