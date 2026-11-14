import { describe, expect, it } from "vitest";
import { OSM_GROUP, loadPropsPlan } from "../../osm-import/src/props-osm.ts";
import { cellById } from "../src/config.ts";
import { OSM_MATCH, furnitureCounts, osmPlanPoints, piecesOf } from "../src/furniture.ts";
import { PROP_TABLE } from "../src/game.ts";

describe("the cell report's furniture from the OSM extract (G-801)", () => {
  // The extract's groups are told by their id, not by a flag, so the check holds without the fix.
  const extract = loadPropsPlan().items.filter((i) => i.id.startsWith(`${OSM_GROUP}.`));
  const plan = osmPlanPoints();

  it.each(["krakowskie-1-0", "krakowskie-2-0"])("counts the pieces of the osm.furniture groups in %s as the map's", (id) => {
    const rect = cellById(id).rect;
    const pts = extract.flatMap((i) => (i.points ?? []).map(([x, z]) => ({ kind: i.kind, x, z })));
    const fromExtract = piecesOf(PROP_TABLE).filter((p) => pts.some((q) => q.kind === p.kind && Math.hypot(q.x - p.x, q.z - p.z) <= OSM_MATCH));
    const counts = furnitureCounts(fromExtract, plan, rect);
    let seen = 0;
    for (const [group, c] of Object.entries(counts)) {
      seen += c.total;
      expect(c.generator, group).toBe(0);
    }
    expect(seen).toBeGreaterThan(0);
  });
});
