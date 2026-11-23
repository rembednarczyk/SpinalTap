import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { GATE_PASSAGES, KANAL_ALLEY_STASH, KANAL_PATROL_ACTORS, KANAL_PROPS, KANAL_SPOTS, LOOT_REACH, STEAM_VENTS, inBuilding, nearestWall } from "../src";
import { BOOTH_STEAM, BRAMA_DETAIL, GATE_DUMPSTER, GATE_STASH, HIDEO_DOORWAY, LANTERN_DROP, SABU_GRATE, SCANNER_AT, inPassage } from "../src/content/brama-detail";
import { ENCOUNTERS } from "../src/content/encounters";
import { groundY } from "../src/content/lublin/terrain";

/*
 * The scene of Brama Krakowska after its card (`docs/lokacje/brama-krakowska.md`, ADR-0102 point 5): the dumpster Tetsu
 * and the stash's comment speak of, with the stash behind it; the passage lit and scanned, the post on Bramowa watching
 * its east mouth; the forecourt's booth steaming; Hideo's doorway at a wall, Sabu's grate under his feet.
 */

const GATE = GATE_PASSAGES[0]!;
const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
const modelAt = (key: string) => BRAMA_DETAIL.find((i) => i.prop === "room-detail" && keyOf(i.variant) === key)!;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** The dumpster's box on the ground (its solid). */
const box = { minX: GATE_DUMPSTER.x - GATE_DUMPSTER.w / 2, maxX: GATE_DUMPSTER.x + GATE_DUMPSTER.w / 2, minZ: GATE_DUMPSTER.z - GATE_DUMPSTER.d / 2, maxZ: GATE_DUMPSTER.z + GATE_DUMPSTER.d / 2 };
const inBox = (p: { x: number; z: number }, pad = 0) => p.x > box.minX - pad && p.x < box.maxX + pad && p.z > box.minZ - pad && p.z < box.maxZ + pad;

describe("Brama Krakowska's scene (ADR-0102 point 5)", () => {
  it("has the dumpster under the annex on the deptak's side, a hiding place drawn by its model, last of the district's props", () => {
    const last = KANAL_PROPS.at(-1)!;
    expect(last.hide).toBe("dumpster");
    expect(last.scenery).toBe(true);
    expect(last.solid).toBe(true);
    expect(last.center.x).toBeCloseTo(GATE_DUMPSTER.x, 5);
    expect(last.center.z).toBeCloseTo(GATE_DUMPSTER.z, 5);
    expect(last.view.kind === "block" ? last.view.size : null).toEqual({ x: GATE_DUMPSTER.w, y: GATE_DUMPSTER.h, z: GATE_DUMPSTER.d });
    expect(last.center.y - GATE_DUMPSTER.h / 2).toBeCloseTo(groundY(GATE_DUMPSTER.x, GATE_DUMPSTER.z), 3);
    // Out of the walls at every corner, its back within a hand of the annex's front, west of the passage's mouth.
    for (const [x, z] of [[box.minX, box.minZ], [box.maxX, box.minZ], [box.minX, box.maxZ], [box.maxX, box.maxZ]] as const) expect(inBuilding(x, z), `${x},${z}`).toBe(false);
    expect(nearestWall(box.maxX, box.maxZ).d).toBeLessThan(0.3);
    const mouthSouth = inPassage(7, -GATE.width / 2);
    expect(box.maxZ).toBeLessThan(mouthSouth.z - 0.5);
    const drawn = modelAt("rd-bk-dumpster");
    expect([drawn.x, drawn.z]).toEqual([GATE_DUMPSTER.x, GATE_DUMPSTER.z]);
  });

  it("puts Tetsu's stash behind the dumpster, out of sight from the plaza and within reach from its south end", () => {
    expect(KANAL_ALLEY_STASH.at.x).toBeCloseTo(GATE_STASH.x, 5);
    expect(KANAL_ALLEY_STASH.at.z).toBeCloseTo(GATE_STASH.z, 5);
    expect(KANAL_ALLEY_STASH.at.y).toBeCloseTo(groundY(GATE_STASH.x, GATE_STASH.z), 3);
    expect(inBuilding(GATE_STASH.x, GATE_STASH.z)).toBe(false);
    expect(inBox(GATE_STASH)).toBe(false);
    // Between the dumpster's back (east) and the annex's front.
    expect(GATE_STASH.x).toBeGreaterThan(box.maxX);
    expect(GATE_STASH.z).toBeGreaterThan(box.minZ);
    // Where she stands to reach it: off the dumpster's south end, clear of the walls by a body's half width.
    const stand = { x: box.maxX - 0.35, z: box.minZ - 0.75 };
    expect(inBuilding(stand.x, stand.z)).toBe(false);
    expect(inBox(stand, 0.3)).toBe(false);
    expect(nearestWall(stand.x, stand.z).d).toBeGreaterThan(0.35);
    expect(flat(stand, GATE_STASH)).toBeLessThan(LOOT_REACH);
    // Was on the bare cobbles by the floodlight, 5 m off the gate (the card's debt).
    expect(flat(GATE_STASH, { x: 459.5, z: -99 })).toBeGreaterThan(4);
  });

  it("lights the passage from two lanterns on its jambs under the vault, the scanner in the vault's middle", () => {
    const lanterns = BRAMA_DETAIL.filter((i) => i.prop === "lamp-wall-lantern");
    expect(lanterns).toHaveLength(2);
    const crown = Math.max(groundY(GATE.from.x, GATE.from.z), groundY(GATE.to.x, GATE.to.z)) + GATE.height;
    for (const l of lanterns) {
      // On a jamb, its bracket under the springing (the model's bracket at 4.05 m on a house's front).
      const len = Math.hypot(GATE.to.x - GATE.from.x, GATE.to.z - GATE.from.z);
      const off = ((l.x - GATE.from.x) * (GATE.to.z - GATE.from.z) - (l.z - GATE.from.z) * (GATE.to.x - GATE.from.x)) / len;
      expect(Math.abs(off)).toBeCloseTo(GATE.width / 2, 5);
      expect(l.y).toBeCloseTo(groundY(l.x, l.z) - LANTERN_DROP, 5);
      expect(l.y + 4.2).toBeLessThan(crown - GATE.rise);
      expect(l.y + 4.2 - groundY(l.x, l.z)).toBeGreaterThan(2.6);
    }
    const scanner = modelAt("rd-bk-scanner");
    expect(flat(scanner, inPassage(SCANNER_AT))).toBeLessThan(1e-6);
    expect(scanner.y).toBeCloseTo(groundY(scanner.x, scanner.z), 5);
    // The camera's plate at 4.33 m stays under the crown.
    expect(scanner.y + 4.33).toBeLessThan(crown);
    expect(ROOM_DETAIL_SHAPES.find((s) => s.key === "rd-bk-scanner")?.sound).toBe("scan");
  });

  it("brings the Bramowa post near the passage's east mouth, facing it", () => {
    const post = KANAL_PATROL_ACTORS.find((a) => a.spawn.key === "hebi-bramowa")!.spawn;
    const mouth = inPassage(26.55);
    const d = flat(post.position, mouth);
    // Was 25 m up Bramowa (506, -71), out of sight of the gate.
    expect(d).toBeLessThan(10);
    expect(d).toBeGreaterThan(5);
    const look = Math.atan2(mouth.x - post.position.x, mouth.z - post.position.z);
    expect(Math.abs(Math.atan2(Math.sin(look - post.yaw), Math.cos(look - post.yaw)))).toBeLessThan(0.3);
    expect(inBuilding(post.position.x, post.position.z)).toBe(false);
    expect(nearestWall(post.position.x, post.position.z).d).toBeGreaterThan(0.4);
  });

  it("stands every piece on the ground, lets the booth's steam rise over its counter, Hideo sleep at a wall and Sabu fish at his grate", () => {
    for (const i of BRAMA_DETAIL) {
      if (i.prop === "lamp-wall-lantern") continue;
      expect(Math.abs(i.y - groundY(i.x, i.z)), `${i.prop} ${i.variant} at ${i.x},${i.z}`).toBeLessThan(0.005);
      expect(inBuilding(i.x, i.z), `${i.prop} ${i.variant} at ${i.x},${i.z}`).toBe(i.prop === "room-detail" && keyOf(i.variant) === "rd-bk-scanner");
    }
    expect(STEAM_VENTS[2]).toEqual(BOOTH_STEAM);
    expect(ROOM_DETAIL_SHAPES.find((s) => s.key === "rd-bk-booth")?.sound).toBe("simmer");
    expect(ROOM_DETAIL_SHAPES.find((s) => s.key === "rd-bk-neon-box")?.sound).toBe("hum");
    expect(flat(KANAL_SPOTS.hideoHome, HIDEO_DOORWAY)).toBeLessThan(0.7);
    expect(flat(modelAt("rd-bk-doorway"), HIDEO_DOORWAY)).toBeLessThan(1e-6);
    const sabu = ENCOUNTERS.find((e) => e.id === "kanal_fisherman")!;
    expect(flat(sabu.at, SABU_GRATE)).toBeLessThan(0.7);
  });
});
