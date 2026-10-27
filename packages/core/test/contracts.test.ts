import { describe, expect, it } from "vitest";
import { type AppearanceDescriptor, EMPTY_INPUT, type EntityId, type RenderPort } from "../src";

/** A recording RenderPort, the shape every adapter and test double has to satisfy. */
class RecordingPort implements RenderPort {
  readonly appearances: [EntityId, AppearanceDescriptor][] = [];
  spawn() {}
  updateTransform() {}
  despawn() {}
  clear() {}
  setCameraMode() {}
  attachCamera() {}
  playEffect() {}
  setAppearance(id: EntityId, a: AppearanceDescriptor) {
    this.appearances.push([id, a]);
  }
}

describe("inventory contracts (ADR-0015)", () => {
  it("an empty input frame neither reloads nor switches weapons", () => {
    expect(EMPTY_INPUT.reload).toBe(false);
    expect(EMPTY_INPUT.weaponSlot).toBe(0);
  });

  it("RenderPort takes an appearance separately from spawn", () => {
    const port: RenderPort = new RecordingPort();
    const look: AppearanceDescriptor = {
      weapons: { primary: "smg", secondary: "pistol", melee: null, active: "secondary" },
      garments: { torso: { tint: "jacket-seki" } },
      implants: ["optics"],
    };
    port.setAppearance(1, look);
    expect((port as RecordingPort).appearances).toEqual([[1, look]]);
  });
});
