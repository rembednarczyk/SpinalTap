import { describe, expect, it } from "vitest";
import type { ActivityId, CameraMode, EffectDescriptor, EntityId, RenderPort, Transform, ViewDescriptor } from "@seki/core";
import { ALCHEMIA_UNITS, ALL_SHOP_BUILDS, RenderSync, SELLERS, SELLER_ACTORS, SELLER_VARIANTS, STAND_IN_FAR, STAND_IN_NEAR, Simulation, galleryShopOpen } from "../src";
import { GAME_ACTORS } from "../src/content/street-props";
import { PRISMS, outside } from "./alchemia-raster";
import { byKey, teleportPlayer } from "./helpers";

/*
 * Alchemia's sellers (ADR-0101): a character behind the counter of every open shop and of every
 * open kitchen of the food hall without a keeper of the story, nobody in a shut one; each with a
 * voice of its trade's scenario no other shop of the trade has; drawn as one of the crowd's figures
 * but within a conversation's reach and a little more of the player.
 */

class Port implements RenderPort {
  readonly views = new Map<EntityId, ViewDescriptor>();
  readonly gone: [EntityId, string | undefined][] = [];
  spawn(id: EntityId, view: ViewDescriptor) {
    this.views.set(id, view);
  }
  updateTransform(_id: EntityId, _t: Transform) {}
  despawn(id: EntityId, reason?: string) {
    this.views.delete(id);
    this.gone.push([id, reason]);
  }
  clear() {
    this.views.clear();
  }
  setCameraMode(_mode: CameraMode) {}
  attachCamera() {}
  playEffect(_e: EffectDescriptor) {}
  setAppearance() {}
  setActivity(_id: EntityId, _a: ActivityId | null) {}
}

describe("Alchemia's sellers (ADR-0101)", () => {
  it("stands one behind the counter of every open shop and open kitchen without a keeper, none in a shut, barred or vacant one", () => {
    const open = ALL_SHOP_BUILDS.filter((b) => galleryShopOpen(b.shop));
    const kitchens = ALCHEMIA_UNITS.filter((u) => !u.keeper && !u.shut);
    expect(SELLERS.map((s) => s.id).sort()).toEqual([...open.map((b) => b.shop.id), ...kitchens.map((u) => u.id)].sort());
    expect(SELLERS).toHaveLength(44);
    for (const b of ALL_SHOP_BUILDS.filter((x) => !galleryShopOpen(x.shop))) expect(b.seller, b.shop.id).toBeNull();
    // Keyed apart from everybody else, after every other actor (the ids before them stay).
    expect(new Set(SELLERS.map((s) => s.key)).size).toBe(SELLERS.length);
    expect(GAME_ACTORS.slice(-SELLER_ACTORS.length)).toEqual(SELLER_ACTORS);
  });

  it("stands each one on its floor clear of every solid by a body, a kitchen's cook too, facing out over its counter", () => {
    for (const s of SELLERS) {
      const f = s.at;
      expect(PRISMS.every((q) => q.bottom > f.y + 1.6 || q.top < f.y + 0.3 || outside(q, f.x, f.z) > 0.2), s.id).toBe(true);
      // A step the way it faces is the counter's side: nearer the customer's spot (a shop's) or out of the unit (a kitchen's).
      const ahead = { x: f.x + Math.sin(s.yaw), z: f.z + Math.cos(s.yaw) };
      const b = ALL_SHOP_BUILDS.find((x) => x.shop.id === s.id);
      if (b?.customer) expect(Math.hypot(ahead.x - b.customer.x, ahead.z - b.customer.z), s.id).toBeLessThan(Math.hypot(f.x - b.customer.x, f.z - b.customer.z));
    }
  });

  it("gives every shop of a trade a voice of its own, within the scenario's variants", () => {
    const byScenario = new Map<string, number[]>();
    for (const s of SELLERS) byScenario.set(s.scenario, [...(byScenario.get(s.scenario) ?? []), s.variant]);
    expect([...byScenario.keys()].sort()).toEqual(Object.keys(SELLER_VARIANTS).sort());
    for (const [scenario, variants] of byScenario) {
      expect(new Set(variants).size, scenario).toBe(variants.length);
      expect(Math.max(...variants), scenario).toBeLessThanOrEqual(SELLER_VARIANTS[scenario]!);
      expect(Math.min(...variants), scenario).toBe(1);
    }
    const pharmacies = SELLERS.filter((s) => s.scenario === "pharmacy");
    expect(new Set(pharmacies.map((s) => s.knot)).size).toBe(pharmacies.length);
    expect(SELLERS.find((s) => s.id === "p1-w1")?.knot).toMatch(/^seller_pharmacy\.v[1-4]$/);
    expect(SELLERS.find((s) => s.id === "l1e-1")?.knot).toMatch(/^seller_synth_food\.v[1-4]$/);
  });

  it("is drawn as a full character only near the player, as one of the crowd's figures past that, with a margin between", () => {
    const seller = SELLERS.find((s) => s.id === "p1-w1")!;
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, { x: seller.at.x + 30, y: seller.at.y, z: seller.at.z });
    sim.step();
    const e = byKey(sim, seller.key)!;
    expect(e.interactable?.dialogueId).toBe(seller.knot);
    const port = new Port();
    const sync = new RenderSync(port);
    sync.sync(sim.world, 0);
    expect(port.views.get(e.id)?.kind).toBe("crowd");
    const at = (d: number): void => {
      teleportPlayer(sim, { x: seller.at.x + d, y: seller.at.y, z: seller.at.z });
      sync.sync(sim.world, 0);
    };
    at(STAND_IN_NEAR - 0.5);
    expect(port.views.get(e.id)).toEqual(e.view);
    expect(e.view).toMatchObject({ kind: "npc", preset: "civilian", umbrella: false });
    // Swapped at once, without the fall of a removed character.
    expect(port.gone.filter(([id]) => id === e.id)).toEqual([[e.id, "unloaded"]]);
    at((STAND_IN_NEAR + STAND_IN_FAR) / 2);
    expect(port.views.get(e.id)?.kind).toBe("npc");
    at(STAND_IN_FAR + 0.5);
    expect(port.views.get(e.id)).toEqual({ kind: "crowd", look: e.view?.kind === "npc" ? e.view.look : -1, umbrella: false });
    at((STAND_IN_NEAR + STAND_IN_FAR) / 2);
    expect(port.views.get(e.id)?.kind).toBe("crowd");
    // A floor up, right over it: the crowd's figure still (the next floor's seller is not drawn in full through the slab).
    teleportPlayer(sim, { x: seller.at.x + 1, y: seller.at.y + 4.5, z: seller.at.z });
    sync.sync(sim.world, 0);
    expect(port.views.get(e.id)?.kind).toBe("crowd");
    expect(port.gone.filter(([id]) => id === e.id)).toHaveLength(2);
  });
});
