import { describe, expect, it } from "vitest";
import { FARA_HOLO, FARA_HOLO_FACETS, FARA_HOLO_INNER, FARA_HOLO_OUTLINES } from "@seki/sim";
import { MeshSink } from "../src/renderer/mesh-sink";
import { planFaraHolo } from "../src/renderer/mapcity/fara-holo-signs";
import { MAP_SIGN_KIND } from "../src/renderer/mapcity/sign-plan";

/*
 * The hologram of St Michael's parish church over its foundations (`fara-holo.ts`), the user's note of 24.11: its walls
 * as the game's other holograms, see-through but not wholly. Every facet a pane of the signs' hologram (`holoPanel`, the
 * building sites' boards'), both ways, in the one cell holding the church.
 */
describe("the parish church's hologram in the map's signs (Plac po Farze)", () => {
  const cell = { minX: FARA_HOLO.x - 10, maxX: FARA_HOLO.x + 10, minZ: FARA_HOLO.z - 10, maxZ: FARA_HOLO.z + 10 };

  it("draws every facet as two hologram panes, back to back, and the windows' and doors' outlines as tubes of light", () => {
    const sink = new MeshSink();
    const sides = FARA_HOLO_OUTLINES.reduce((n, o) => n + o.length, 0);
    expect(planFaraHolo(sink, cell)).toBe(FARA_HOLO_FACETS.length + FARA_HOLO_INNER.length + FARA_HOLO_OUTLINES.length);
    expect(sink.vertexCount).toBe((FARA_HOLO_FACETS.length + FARA_HOLO_INNER.length + sides) * 2 * 4);
    const panes = (FARA_HOLO_FACETS.length + FARA_HOLO_INNER.length) * 2;
    for (let q = panes; q < sink.vertexCount / 4; q++) expect(sink.uvs2[q * 8 + 1], `tube ${q}`).toBe(MAP_SIGN_KIND.tube);
    for (let q = 0; q < panes; q++) {
      expect(sink.uvs2[q * 8 + 1], `pane ${q}`).toBe(MAP_SIGN_KIND.holoPanel);
      // Not wholly bright: the panes' fill is the shader's, its brightness under a board's.
      expect(sink.colors[q * 16 + 3]).toBeLessThan(1);
    }
    // The panes inside the shell (the rooms' faces, the piers) fainter than the shell's.
    const shell = sink.colors[3]!;
    expect(sink.colors[FARA_HOLO_FACETS.length * 2 * 16 + 3]).toBeLessThan(shell / 2);
    // The two faces of a pane look opposite ways.
    expect(sink.normals[0]! + sink.normals[12]!).toBeCloseTo(0, 9);
  });

  it("draws nothing in a cell without it", () => {
    const sink = new MeshSink();
    expect(planFaraHolo(sink, { minX: 0, maxX: 100, minZ: 0, maxZ: 100 })).toBe(0);
    expect(sink.empty).toBe(true);
  });
});
