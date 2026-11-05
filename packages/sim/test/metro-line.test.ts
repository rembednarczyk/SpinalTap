import { describe, expect, it } from "vitest";
import { METRO_STATION_IDS, isMetroStationId } from "@seki/core";
import { METRO_PLANNED, METRO_STATIONS, METRO_TUNNEL, MAP_CHUNKS, metroRoute } from "../src";

/** ADR-0071 stage 1: the line on the map is data only, and it has to fit the line the rules ride. */
describe("metro line on the map", () => {
  it("runs a tunnel between each pair of neighbouring stations, in the order of the ride", () => {
    expect(METRO_TUNNEL.map((t) => [t.from, t.to])).toEqual(METRO_STATION_IDS.slice(1).map((to, i) => [METRO_STATION_IDS[i], to]));
    expect(METRO_STATIONS.map((s) => s.id)).toEqual([...METRO_STATION_IDS]);
  });

  it("keeps its legs short: no jump over 700 m between the points of a tunnel", () => {
    for (const t of METRO_TUNNEL) {
      const pts = [METRO_STATIONS.find((s) => s.id === t.from)!.node, ...t.via, METRO_STATIONS.find((s) => s.id === t.to)!.node];
      for (let i = 1; i < pts.length; i++) expect(Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z)).toBeLessThan(700);
    }
  });

  it("names possible stations that are no station of the rules and lie outside the imported city", () => {
    expect(METRO_PLANNED.map((p) => p.name)).toEqual(["Ogród Saski", "Lublin Główny", "Kalinowszczyzna"]);
    for (const p of METRO_PLANNED) {
      expect(isMetroStationId(p.id)).toBe(false);
      const inside = MAP_CHUNKS.some((c) => p.at.x >= c.bounds.minX && p.at.x <= c.bounds.maxX && p.at.z >= c.bounds.minZ && p.at.z <= c.bounds.maxZ);
      expect(inside).toBe(false);
    }
  });

  it("puts a possible station on the line on a point of its tunnel", () => {
    for (const p of METRO_PLANNED.filter((x) => x.onLine)) {
      expect(p.via).toEqual([]);
      const leg = METRO_TUNNEL.find((t) => t.from === p.from)!;
      expect(leg.via).toContainEqual(p.at);
    }
  });

  it("lists the stations of a ride both ways, ends included", () => {
    expect(metroRoute("shinsekai", "targ")).toEqual(["shinsekai", "kanal", "targ"]);
    expect(metroRoute("doki", "kanal")).toEqual(["doki", "targ", "kanal"]);
    expect(metroRoute("kanal", "kanal")).toEqual(["kanal"]);
  });
});
