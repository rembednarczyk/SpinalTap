import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { CREDITS } from "@seki/ui";
import { describe, expect, it } from "vitest";

/**
 * Credits (ADR-0063): the list of the "Credits" screen (`packages/ui/src/credits/credits.ts`), the
 * README of each folder of `public` and `tools/assets/sources.json` say the same. A CC-BY model is
 * found by the `extras.credit` its node carries, so a CC-BY file cannot ship without its credit.
 */

const PUBLIC = join(import.meta.dirname, "../public");
const SOURCES = JSON.parse(readFileSync(join(import.meta.dirname, "../../../tools/assets/sources.json"), "utf8")) as {
  sources: { id: string; title: string; author: string; authorUrl?: string; page: string; license: string; licenseUrl?: string; used?: string[] }[];
};

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
/** Every model and sound under `public`, as `city/city-props.glb`. */
const ASSETS = walk(PUBLIC)
  .map((f) => relative(PUBLIC, f).split("\\").join("/"))
  .filter((f) => /\.(glb|vrm|ogg)$/.test(f));

const readme = (file: string): string => readFileSync(join(PUBLIC, dirname(file), "README.md"), "utf8");

/** The `extras.credit` of every node of a GLB (its JSON chunk). */
const creditsIn = (file: string): string[] => {
  const b = readFileSync(join(PUBLIC, file));
  if (b.readUInt32LE(0) !== 0x46546c67) return [];
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8")) as { nodes?: { extras?: { credit?: string } }[] };
  return (json.nodes ?? []).flatMap((n) => (n.extras?.credit ? [n.extras.credit] : []));
};

describe("credits (ADR-0063)", () => {
  it("credits every model and sound that ships, and names only files that do", () => {
    const credited = new Set(CREDITS.flatMap((c) => c.files));
    for (const f of ASSETS) expect(credited.has(f), `${f} has no entry in credits.ts`).toBe(true);
    for (const f of credited) expect(ASSETS.includes(f), `${f} of credits.ts is not in public`).toBe(true);
    expect(new Set(CREDITS.map((c) => c.id)).size).toBe(CREDITS.length);
  });

  it("gives every CC-BY model in public its credit and a row in its folder's README", () => {
    const glbs = ASSETS.filter((f) => f.endsWith(".glb"));
    const found = glbs.flatMap((f) => creditsIn(f).map((id) => ({ f, id })));
    expect([...new Set(found.map((x) => x.id))].sort()).toEqual([
      "sketchfab-avika-street-food-cart",
      "sketchfab-cctv-camera",
      "sketchfab-cyberpunk-car",
      "sketchfab-cyberpunk-doors-and-windows",
      "sketchfab-cyberpunk-drone",
      "sketchfab-cyberpunk-scifi-door-3",
      "sketchfab-dirty-car",
      "sketchfab-electric-pole",
      "sketchfab-futuristic-compact-room",
      "sketchfab-megacity-cluster",
      "sketchfab-paper-lantern-chochin",
      "sketchfab-psx-garage-doors",
      "sketchfab-ramen-vending-machine",
      "sketchfab-reston-b2-terminal",
      "sketchfab-robotic-animal",
      "sketchfab-scifi-kiosk",
      "sketchfab-shipping-container",
      "sketchfab-vending-machine",
    ]);
    for (const { f, id } of found) {
      const c = CREDITS.find((x) => x.id === id);
      expect(c, `${f}: ${id} not in credits.ts`).toBeDefined();
      expect(c!.license).toBe("CC-BY-4.0");
      expect(c!.files).toContain(f);
    }
    // Every CC-BY entry: the README row (title, author with link, source, licence) and the same source in sources.json.
    for (const c of CREDITS.filter((x) => x.license === "CC-BY-4.0")) {
      expect(c.changed, c.id).toBe(true);
      for (const f of c.files) {
        const row = readme(f).split("\n").find((l) => l.startsWith("|") && l.includes(`| ${c.title} |`));
        expect(row, `${dirname(f)}/README.md has no row for ${c.title}`).toBeDefined();
        expect(row).toContain(`[${c.author}](${c.authorUrl})`);
        expect(row).toContain(`(${c.url})`);
        expect(row).toContain("[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)");
      }
      const s = SOURCES.sources.find((x) => x.id === c.id);
      expect(s, `${c.id} not in sources.json`).toBeDefined();
      expect({ title: s!.title, author: s!.author, authorUrl: s!.authorUrl, page: s!.page, license: s!.license }).toEqual({ title: c.title, author: c.author, authorUrl: c.authorUrl, page: c.url, license: "CC-BY-4.0" });
    }
  });

  it("credits the icons of game-icons.net (CC BY 3.0, ADR-0073) with their source and a row per icon in the icons' README", () => {
    const icons = CREDITS.filter((c) => c.license === "CC-BY-3.0");
    expect(icons.map((c) => c.id).sort()).toEqual(["game-icons-delapouite", "game-icons-lorc"]);
    const rows = readFileSync(join(import.meta.dirname, "../../ui/src/icons/README.md"), "utf8").split("\n").filter((l) => l.startsWith("| `"));
    for (const c of icons) {
      expect({ section: c.section, changed: c.changed, files: c.files }).toEqual({ section: "icons", changed: true, files: [] });
      const s = SOURCES.sources.find((x) => x.id === c.id)!;
      expect({ title: s.title, author: s.author, authorUrl: s.authorUrl, page: s.page, license: s.license, licenseUrl: s.licenseUrl }).toEqual({
        title: c.title,
        author: c.author,
        authorUrl: c.authorUrl,
        page: c.url,
        license: "CC-BY-3.0",
        licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
      });
      // Every icon the source gives has its README row: author with link, its page, the licence.
      for (const key of s.used ?? []) {
        const row = rows.find((l) => l.startsWith(`| \`${key}\` |`));
        expect(row, `README.md has no row for ${key}`).toBeDefined();
        expect(row).toContain(`[${c.author}](${c.authorUrl})`);
        expect(row).toContain("(https://game-icons.net/1x1/");
        expect(row).toContain("[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)");
      }
    }
  });

  it("credits every source of sources.json the game uses; all of them CC0, CC-BY 4.0 or (game-icons.net) CC BY 3.0", () => {
    for (const s of SOURCES.sources) {
      expect(["CC0", "CC-BY-4.0", "CC-BY-3.0"], s.id).toContain(s.license);
      if (s.license === "CC-BY-4.0") expect(s.licenseUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
      if (s.license === "CC-BY-3.0") expect(s.id, "CC BY 3.0 only for game-icons.net").toMatch(/^game-icons-/);
      // A source marked unused (`"used": []`) waits for a later stage of ADR-0063.
      if (s.used && s.used.length === 0) {
        expect(CREDITS.some((c) => c.id === s.id), `${s.id} is unused but credited`).toBe(false);
        continue;
      }
      expect(CREDITS.some((c) => c.id === s.id), `${s.id} is used but not credited`).toBe(true);
    }
  });
});
