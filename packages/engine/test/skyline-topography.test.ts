// @ts-expect-error The engine is typed for the browser; the test reads the props file off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCityProps } from "../src/renderer/city-props";
import { MEGA_LAYOUT, MEGA_SITES, planSkyline, siteTowers } from "../src/renderer/mapcity/skyline";
import { megaBodies } from "../src/renderer/mapcity/skyline-bodies";
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

  it("megablock-overlap: no two bodies of different rows, nor of the far ring's two bands, run into each other", () => {
    // The near rows stand close on purpose, joined by their bridges (ADR-0067); the ring does not.
    const hits: string[] = [];
    placed.forEach((a, i) => {
      for (const b of placed.slice(i + 1)) if ((a.row !== b.row || a.row === "ring") && overlaps(a, b)) hits.push(`${a.id} ${b.id}`);
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
    const names = MEGA_SITES.map((s) => s.name);
    expect(names).not.toContain("Zalew Zemborzycki");
    expect(names).toContain("Zemborzyce");
  });

  it("stands the sites' towers where the guard checked them, with the megatower bodies too", () => {
    const f = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-props.glb", import.meta.url));
    const bodies = megaBodies(parseCityProps(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer));
    expect(bodies.length).toBeGreaterThan(0);
    const feet = siteTowers().map((t) => `${t.x.toFixed(1)},${t.z.toFixed(1)}`);
    for (const kit of [[], bodies]) {
      // Every vertex of a tower carries its foot in uv: the distinct feet, in order.
      const uvs = planSkyline(MEGA_SITES, kit).towers.uvs;
      const drawn: string[] = [];
      for (let i = 0; i < uvs.length; i += 2) {
        const at = `${uvs[i]!.toFixed(1)},${uvs[i + 1]!.toFixed(1)}`;
        if (drawn[drawn.length - 1] !== at) drawn.push(at);
      }
      expect(drawn).toEqual(feet);
    }
  });
});
