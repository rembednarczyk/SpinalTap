import { describe, expect, it } from "vitest";
import type { EntityId, RenderPort, Transform } from "@seki/core";
import { RenderSync } from "../src";
import { HURT_FROM, HURT_FULL } from "../src/presentation/render-sync";
import { streetSim } from "./helpers";

/*
 * ADR-0090 point 14: the picture learns how hurt a character is from its health. Above half its
 * health nothing goes out; below, `hurt` grows to 1 at 15% and stays there; the dead and the
 * knocked out send none (they lie still anyway).
 */

const port = () => {
  const transforms = new Map<EntityId, Transform>();
  const p = {
    spawn: (id: EntityId, _v: unknown, t: Transform) => transforms.set(id, t),
    updateTransform: (id: EntityId, t: Transform) => transforms.set(id, t),
    despawn: () => {},
    clear: () => {},
    setCameraMode: () => {},
    attachCamera: () => {},
    playEffect: () => {},
    setAppearance: () => {},
  } as unknown as RenderPort;
  return { p, transforms };
};

describe("ADR-0090 point 14: how hurt, for the picture", () => {
  it("nothing above half health, a share below it, all of it at 15% and under; none for the dead", () => {
    const sim = streetSim({ seed: 3 });
    const { p, transforms } = port();
    const sync = new RenderSync(p);
    const player = sim.player()!;
    const hurtAt = (share: number): number | undefined => {
      player.health = { ...player.health!, current: player.health!.max * share };
      sync.sync(sim.world, 1);
      return transforms.get(player.id)?.hurt;
    };
    expect(hurtAt(1)).toBeUndefined();
    expect(hurtAt(HURT_FROM)).toBeUndefined();
    expect(hurtAt((HURT_FROM + HURT_FULL) / 2)).toBeCloseTo(0.5, 5);
    expect(hurtAt(HURT_FULL)).toBe(1);
    expect(hurtAt(0.05)).toBe(1);
    expect(hurtAt(0)).toBeUndefined();
  });
});
