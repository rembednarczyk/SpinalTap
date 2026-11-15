import { CREDIT_LICENSES, type Credit, LICENSES, NON_COMMERCIAL, SHARE_ALIKE } from "@seki/ui";

/**
 * The rules of the licence of every file that ships (ADR-0063, change of 15.11), as pure checks over
 * the credits (`packages/ui/src/credits/credits.ts`), so the test can prove each of them on a made-up
 * list as well as hold the real one to them.
 */

/** A model, texture, sound or image of the game (the SVGs of the UI are drawn into its code, not shipped in `public`). */
export const ASSET_FILE = /\.(glb|gltf|vrm|png|jpe?g|ktx2|ogg|mp3|wav|svg)$/i;

/** The licence notice next to a changed share-alike file (as the REUSE spec: `city/x.glb.license`). */
export const noticePath = (file: string): string => `${file}.license`;

/** Asset files under `public` with no credit naming them. */
export const unlicensed = (files: readonly string[], credits: readonly Credit[]): string[] => {
  const credited = new Set(credits.flatMap((c) => c.files));
  return files.filter((f) => ASSET_FILE.test(f) && !credited.has(f));
};

/** What is wrong with each credit's licence record: a licence off the list, terms or a source missing. */
export const licenseProblems = (credits: readonly Credit[]): string[] =>
  credits.flatMap((c) => {
    const out: string[] = [];
    if (!CREDIT_LICENSES.includes(c.license)) out.push(`${c.id}: licence ${String(c.license)} is not on the list`);
    else if (c.license === "VRoid-Hub-NC" && !c.licenseUrl) out.push(`${c.id}: VRoid-Hub-NC needs a link to the author's terms`);
    else if (c.license !== "own" && !c.url) out.push(`${c.id}: no source url`);
    if (!c.title || !c.author) out.push(`${c.id}: no title or author`);
    return out;
  });

/** Changed share-alike files without their notice: SPDX id, title and author in `<file>.license`. */
export const missingNotices = (credits: readonly Credit[], read: (path: string) => string | null): string[] =>
  credits
    .filter((c) => SHARE_ALIKE.includes(c.license))
    .flatMap((c) => {
      if (c.files.length === 0) return [`${c.id}: a share-alike work needs its own file to carry the licence`];
      if (!c.changed) return [];
      return c.files.flatMap((f) => {
        const text = read(noticePath(f));
        const ok = text !== null && text.includes(`SPDX-License-Identifier: ${c.license}`) && text.includes(c.title) && text.includes(c.author);
        return ok ? [] : [`${noticePath(f)}: no ${c.license} notice for ${c.title}`];
      });
    });

const deed = (c: Credit): string => c.licenseUrl ?? LICENSES[c.license].url ?? "";

/** `docs/assety-nc.md`: the non-commercial works to replace before the game is ever sold. */
export const ncReport = (credits: readonly Credit[]): string => {
  const nc = credits.filter((c) => NON_COMMERCIAL.includes(c.license));
  const head = [
    "# Assety NC i NC-SA",
    "",
    "Plik generowany przez `packages/app/test/asset-licenses.test.ts` z `packages/ui/src/credits/credits.ts` (ADR-0063, zmiana 15.11).",
    "Nie edytuj ręcznie: po zmianie kredytów `ASSETS_NC=update pnpm --filter @seki/app exec vitest run test/asset-licenses.test.ts`.",
    "Przed ewentualną komercjalizacją każdy wpis z tej listy trzeba wymienić albo uzyskać zgodę autora.",
    "",
  ];
  if (nc.length === 0) return [...head, "Brak: wszystkie assety gry są na CC0, CC BY albo własne.", ""].join("\n");
  const rows = nc.map((c) => `| ${c.id} | ${c.title} | ${c.author} | ${c.license} | ${deed(c)} | ${c.files.join(", ") || "-"} |`);
  return [...head, "| id | tytuł | autor | licencja | warunki | pliki |", "|---|---|---|---|---|---|", ...rows, ""].join("\n");
};
