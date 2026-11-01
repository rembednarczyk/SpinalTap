import { describe, expect, it } from "vitest";
import { MEGA_LAYOUT, MEGA_SITES, siteTowers } from "../src/renderer/mapcity/skyline";
import { BODY_REACH, type Disc, TIERS_REACH, areaHit, bridgeViewHit, overlaps, riverHit, viewHit } from "../src/renderer/mapcity/skyline-guard";

/**
 * The megablocks and Lublin's topography (ADR-0067, the curator's review): the counts of the
 * proposed scan checks `megablock-protected`, `megablock-overlap` and `megablock-viewaxis`, each
 * with a baseline of 0. A tower is a disc of its reach: 0.2 h for a megatower body, 0.13 h for the
 * far ring's tiers.
 */

interface Placed extends Disc {
  readonly id: string;
  readonly row: string;
}

const placed: Placed[] = [
  ...siteTowers(MEGA_SITES).map((t, i) => ({ id: `sites[${i}]`, row: "sites", x: t.x, z: t.z, r: BODY_REACH * t.h })),
  ...MEGA_LAYOUT.rows.flatMap((row) =>
    row.towers.map((t, i) => ({ id: `${row.name}[${i}]`, row: row.name, x: t.x, z: t.z, r: (row.lod === "body" ? BODY_REACH : TIERS_REACH) * t.h })),
  ),
];

describe("megablocks and Lublin's topography (ADR-0067)", () => {
  it("megablock-protected: none on the Jewish cemeteries or the Ogród Saski (30 m) or by the Bystrzyca (100 m)", () => {
    const hits = placed.flatMap((t) => {
      const area = areaHit(t);
      return [...(area ? [`${t.id} ${area}`] : []), ...(riverHit(t) ? [`${t.id} Bystrzyca`] : [])];
    });
    expect(hits).toEqual([]);
  });

  it("megablock-overlap: no two bodies of different rows run into each other", () => {
    const hits: string[] = [];
    placed.forEach((a, i) => {
      for (const b of placed.slice(i + 1)) if (a.row !== b.row && overlaps(a, b)) hits.push(`${a.id} ${b.id}`);
    });
    expect(hits).toEqual([]);
  });

  it("megablock-viewaxis: Plac Litewski sees the Wieża Trynitarska and the cathedral, the Nabrzeże the Zamek", () => {
    const towers = placed.filter((t) => viewHit(t)).map((t) => t.id);
    const bridges = MEGA_LAYOUT.rows.flatMap((row) =>
      row.bridges.filter((b) => bridgeViewHit(row.towers[b.a]!, row.towers[b.b]!, b.y)).map((b) => `${row.name} ${b.a}-${b.b} y ${b.y}`),
    );
    expect([...towers, ...bridges]).toEqual([]);
  });

  it("moves the old Zalew Zemborzycki site off the Bystrzyca and names where it stands", () => {
    expect(MEGA_SITES.map((s) => s.name)).not.toContain("Zalew Zemborzycki");
  });
});
