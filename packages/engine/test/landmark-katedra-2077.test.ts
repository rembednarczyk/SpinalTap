import { describe, expect, it } from "vitest";
import { cityAround, colored, near3 } from "./landmark-fixture";

/**
 * Lublin 2077 on Plac Katedralny's monuments (the user's choice of 25.11, after the Trinitarian
 * Tower's mast and lit clocks): cyan lines where the building has an instrument and red
 * obstruction lights on its tops, over the old stone; the tower's passage a museum's gate.
 */

const CYAN = "#5ce1ff";
const RED = "#ff2a2a";
const cathedral = cityAround(615, -184);
const tower = cityAround(586.4, -147.3);

describe("Lublin 2077 on Plac Katedralny (25.11)", () => {
  it("lights the turrets' helmets: cyan strips on the ribs facing the plaza, red lights over the lanterns", () => {
    for (const id of ["w617763434", "w617763435"]) {
      const f = cathedral.frameOf(id);
      const sink = near3(f);
      const cyan = colored(sink, CYAN);
      const red = colored(sink, RED);
      expect(cyan.length, id).toBeGreaterThan(0);
      // On the helmet over the cornice (33.5), towards the plaza (west): no strip on the far side.
      expect(Math.min(...cyan.map((p) => p.y)), id).toBeGreaterThan(f.top - 0.1);
      const cx = cyan.reduce((a, p) => a + p.x, 0) / cyan.length;
      expect(cx, id).toBeLessThan(f.b.ring.reduce((a, p) => a + p.x, 0) / f.b.ring.length);
      // Four lights round the lantern, under the cross (43).
      expect(red.length, id).toBe(4 * 24);
      for (const p of red) expect(p.y, id).toBeGreaterThan(f.top + 3);
      for (const p of red) expect(p.y, id).toBeLessThan(42);
    }
  });

  it("rings the pediment's sun with a cyan halo and hangs a camera over the portal", () => {
    const screen = near3(cathedral.frameOf("T-349/katedra-fronton"));
    const halo = colored(screen, CYAN);
    expect(halo.length).toBeGreaterThan(0);
    // In the tympanum: over the screen front's top window (31.2) and its cornice, under the apex (35.3).
    for (const p of halo) expect(p.y).toBeGreaterThan(32.9);
    for (const p of halo) expect(p.y).toBeLessThan(35.3);
    const vestibule = near3(cathedral.frameOf("w66286341"));
    const lens = colored(vestibule, "#ff3030");
    expect(lens.length).toBeGreaterThan(0);
    // Over the door's head (6.2), under the middle bay's window (9).
    for (const p of lens) expect(p.y).toBeGreaterThan(6.2);
    for (const p of lens) expect(p.y).toBeLessThan(9);
  });

  it("makes the tower's passage a museum's gate: a cyan scanner arch in its vault", () => {
    const f = tower.frameOf("w66286371");
    expect((f.b.passages ?? []).length).toBeGreaterThan(0);
    const arch = colored(near3(f), CYAN);
    // Under the vault, low in the body (25.5), apart from the clocks' rims in the gables.
    expect(arch.filter((p) => p.y < f.b.foot + 8).length).toBeGreaterThan(0);
  });
});
