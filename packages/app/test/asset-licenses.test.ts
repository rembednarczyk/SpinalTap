import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { CREDITS, type Credit, NON_COMMERCIAL } from "@seki/ui";
import { describe, expect, it } from "vitest";
import { ASSET_FILE, licenseProblems, missingNotices, ncReport, noticePath, unlicensed } from "./asset-licenses";

/**
 * The licence of every file that ships (ADR-0063, change of 15.11): each model, texture, sound and
 * image under `packages/app/public` has its credit with a licence of the closed list, a changed
 * share-alike file carries its licence beside it, and `docs/assety-nc.md` lists what is
 * non-commercial (`ASSETS_NC=update` writes it anew).
 */

const PUBLIC = join(import.meta.dirname, "../public");
const NC_DOC = join(import.meta.dirname, "../../../docs/assety-nc.md");

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const FILES = walk(PUBLIC).map((f) => relative(PUBLIC, f).split("\\").join("/"));
const readPublic = (path: string): string | null => (existsSync(join(PUBLIC, path)) ? readFileSync(join(PUBLIC, path), "utf8") : null);

/** A made-up credit for the checks' own proofs. */
const credit = (over: Partial<Credit>): Credit => ({ id: "x", section: "street", title: "Thing", author: "Someone", url: "https://example.org/thing", license: "CC0-1.0", files: ["city/x.glb"], changed: true, ...over });

describe("asset licences (ADR-0063, 15.11)", () => {
  it("gives every model, texture, sound and image in public a credit", () => {
    expect(FILES.filter((f) => ASSET_FILE.test(f)).length).toBeGreaterThan(80);
    expect(unlicensed(FILES, CREDITS)).toEqual([]);
    // The check itself: a new file with no entry is caught, whatever its kind.
    for (const f of ["city/new.glb", "tex/wall.ktx2", "tex/wall.JPG", "audio/x.mp3", "audio/x.wav", "models/y.gltf", "ui/z.svg"]) expect(unlicensed([...FILES, f], CREDITS), f).toEqual([f]);
    expect(unlicensed([...FILES, "city/README.md", "manifest.webmanifest"], CREDITS)).toEqual([]);
  });

  it("holds every credit to a licence of the list, with its source and, for VRoid Hub NC, the author's terms", () => {
    expect(licenseProblems(CREDITS)).toEqual([]);
    expect(licenseProblems([credit({ license: "CC-BY-SA-4.0" as Credit["license"] })])).toEqual(["x: licence CC-BY-SA-4.0 is not on the list"]);
    expect(licenseProblems([credit({ license: "VRoid-Hub-NC" })])).toEqual(["x: VRoid-Hub-NC needs a link to the author's terms"]);
    expect(licenseProblems([credit({ license: "VRoid-Hub-NC", licenseUrl: "https://hub.vroid.com/en/characters/1/models/2" })])).toEqual([]);
    expect(licenseProblems([credit({ license: "CC-BY-NC-4.0", url: undefined })])).toEqual(["x: no source url"]);
    expect(licenseProblems([credit({ license: "own", url: undefined })])).toEqual([]);
  });

  it("asks a changed share-alike file for its licence notice beside it", () => {
    expect(missingNotices(CREDITS, readPublic)).toEqual([]);
    const sa = credit({ license: "CC-BY-NC-SA-4.0" });
    expect(noticePath("city/x.glb")).toBe("city/x.glb.license");
    expect(missingNotices([sa], () => null)).toEqual(["city/x.glb.license: no CC-BY-NC-SA-4.0 notice for Thing"]);
    expect(missingNotices([sa], () => "SPDX-License-Identifier: CC-BY-4.0\nThing by Someone")).toHaveLength(1);
    expect(missingNotices([sa], () => "SPDX-License-Identifier: CC-BY-NC-SA-4.0\nThing by Someone, changed for Seki Senshi")).toEqual([]);
    expect(missingNotices([{ ...sa, changed: false }], () => null)).toEqual([]);
    expect(missingNotices([{ ...sa, files: [] }], () => null)).toEqual(["x: a share-alike work needs its own file to carry the licence"]);
    expect(missingNotices([credit({ license: "CC-BY-NC-4.0" })], () => null)).toEqual([]);
  });

  it("lists the non-commercial works in docs/assety-nc.md; today there are none", () => {
    expect(CREDITS.filter((c) => NON_COMMERCIAL.includes(c.license)).map((c) => c.id)).toEqual([]);
    const doc = ncReport(CREDITS);
    if (process.env.ASSETS_NC === "update") writeFileSync(NC_DOC, doc);
    expect(readFileSync(NC_DOC, "utf8"), "docs/assety-nc.md is stale: ASSETS_NC=update").toBe(doc);
    expect(doc).toContain("Brak:");
    // With one, the list names it, its licence, its terms and its files.
    const vroid = credit({ id: "vroid-x", title: "Girl", license: "VRoid-Hub-NC", licenseUrl: "https://hub.vroid.com/t", files: ["models/girl.vrm"] });
    const rows = ncReport([...CREDITS, vroid, credit({ id: "nc-sa", license: "CC-BY-NC-SA-4.0" })]).split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| id "));
    expect(rows).toEqual(["| vroid-x | Girl | Someone | VRoid-Hub-NC | https://hub.vroid.com/t | models/girl.vrm |", "| nc-sa | Thing | Someone | CC-BY-NC-SA-4.0 | https://creativecommons.org/licenses/by-nc-sa/4.0/ | city/x.glb |"]);
  });
});
