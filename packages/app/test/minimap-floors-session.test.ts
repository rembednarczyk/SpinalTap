import { describe, expect, it } from "vitest";
import { INTERIORS, type InteriorRoom } from "@seki/sim";
import { setup, steps, teleport } from "./story-helpers";

/*
 * The minimap's storey in the session (ADR-0100): indoors the store's player carries the interior's
 * name, its level and the rooms of the floor she stands on, from the simulation's interior; on the
 * street nothing of it.
 */

const biggest = (id: string): InteriorRoom => [...INTERIORS.find((i) => i.id === id)!.rooms].sort((a, b) => (b.maxX - b.minX) * (b.maxZ - b.minZ) - (a.maxX - a.minX) * (a.maxZ - a.minZ))[0]!;

const started = () => {
  const { session, ui } = setup();
  session.newGame();
  steps(session, 1);
  return { session, ui };
};

/** Stands in the middle of the room on its floor and lets the interior system and the HUD see it. */
const standIn = (s: ReturnType<typeof started>["session"], r: InteriorRoom) => {
  teleport(s, (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, 0, 0, r.bottom);
  steps(s, 2);
};

describe("the minimap's storey in the session (ADR-0100)", () => {
  it("names Alchemia's P-2 with its level and draws its rooms", () => {
    const { session, ui } = started();
    standIn(session, biggest("alchemia-p2"));
    expect(session.sim.session.interior).toBe("alchemia-p2");
    const floor = ui.getState().mapPlayer?.floor;
    expect(floor).toMatchObject({ name: "interior.alchemia-p2", level: -2 });
    expect(floor?.rooms.length).toBe(INTERIORS.find((i) => i.id === "alchemia-p2")!.rooms.length);
    expect(ui.getState().mapPlayer?.level).toBeUndefined();
    // The same storey a step later: the same object, no re-render.
    steps(session, 1);
    expect(ui.getState().mapPlayer?.floor).toBe(floor);
  });

  it("names a metro platform with how deep it lies under the street", () => {
    const { session, ui } = started();
    standIn(session, biggest("metro-shinsekai"));
    const floor = ui.getState().mapPlayer?.floor;
    expect(floor).toMatchObject({ name: "interior.metro-shinsekai" });
    expect(floor?.level).toBeUndefined();
    expect(floor?.depth).toBeGreaterThanOrEqual(6);
  });

  it("has no storey on the street", () => {
    const { session, ui } = started();
    teleport(session, 321.4, -80);
    steps(session, 2);
    expect(session.sim.session.interior).toBeNull();
    expect(ui.getState().mapPlayer).not.toHaveProperty("floor");
  });
});
