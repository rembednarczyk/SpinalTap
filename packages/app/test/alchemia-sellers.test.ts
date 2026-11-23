import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type EntityId, type InputFrame, type Transform, type ViewDescriptor } from "@seki/core";
import { NarrativeRuntime, STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { ALL_SHOP_BUILDS, SELLERS, SELLER_VARIANTS, type ShopBuild, galleryShopFrame, galleryShopOpen, sellerKnot } from "@seki/sim";
import { GameSession } from "../src/game-session";
import { FakeRender, frame, steps, teleport } from "./story-helpers";

/*
 * Alchemia's sellers (ADR-0101), headless: Seki walks into an open shop off the gallery to the
 * customer's place before its counter, the HUD offers a chat with the seller, and the talk opens on
 * the knot of the shop's voice; not from the gallery through the glass, nor from the next shop
 * through its wall. A shut shop has nobody behind its shutter. Two shops of a trade talk
 * differently. The seller is the crowd's figure from afar and a full character near her.
 */

/** The fake port with the views it was given. */
class ViewRender extends FakeRender {
  readonly views = new Map<EntityId, ViewDescriptor>();
  override spawn(id: EntityId, view: unknown, t: Transform) {
    super.spawn(id, view, t);
    this.views.set(id, view as ViewDescriptor);
  }
}

const setup = () => {
  const render = new ViewRender();
  const ui = createUiStore();
  const session = new GameSession({ render, audio: { play() {}, stopAll() {} }, persistence: new SavePersistence(new MemorySaveStore()), ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 10, 23) });
  return { session, ui, render };
};

const CHAT = /Chat at the counter|Zagadaj przy ladzie/;

const shop = (id: string): ShopBuild => ALL_SHOP_BUILDS.find((b) => b.shop.id === id)!;
/** A point of a shop's frame in the world, on its floor. */
const inShop = (b: ShopBuild, u: number, v: number) => ({ ...galleryShopFrame(b.shop).point(u, v), y: b.seller?.y ?? 0 });

/** Walks towards (x, z), turning to it every step, until within `near` of it. */
const walkAt = (session: GameSession, to: { x: number; z: number }, n: number, near = 0.2): void => {
  for (let i = 0; i < n; i++) {
    const p = session.sim.player()!;
    if (Math.hypot(to.x - p.position.x, to.z - p.position.z) < near) return;
    const want = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    const input: InputFrame = { ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) };
    steps(session, 1, input);
  }
};

/** From the gallery before the shop's door in through it and up its aisle to the customer's place. */
const walkIn = (session: GameSession, b: ShopBuild): void => {
  const L = b.layout!;
  const doorU = (L.door.u0 + L.door.u1) / 2;
  const outside = inShop(b, doorU, -1.2);
  teleport(session, outside.x, outside.z, 0, 0, outside.y);
  steps(session, 2);
  for (const p of [inShop(b, doorU, 0.6), inShop(b, (L.aisle.u0 + L.aisle.u1) / 2, (L.aisle.v0 + L.aisle.v1) / 2), b.customer!]) walkAt(session, p, 400);
};

const sellerOf = (session: GameSession, id: string) => [...session.sim.world].find((e) => e.key === `seller-${id}`);

describe("Alchemia's sellers (ADR-0101)", () => {
  it("offers a chat at the counter of an open shop walked into from the gallery, and opens the talk on the shop's voice", () => {
    const { session, ui } = setup();
    session.newGame();
    const b = shop("p1-w1");
    const def = SELLERS.find((s) => s.id === "p1-w1")!;
    walkIn(session, b);
    const me = session.sim.player()!.position;
    expect(Math.hypot(me.x - b.customer!.x, me.z - b.customer!.z)).toBeLessThan(0.4);
    expect(ui.getState().prompt ?? "").toMatch(CHAT);
    // What the knot says to her now, played on a runtime of its own.
    const expected = new NarrativeRuntime(STORY_SOURCE, () => {}).start(def.knot, session.sim.domain);
    steps(session, 1, frame({ interact: true }));
    const talk = ui.getState().dialogue;
    expect(talk).not.toBeNull();
    expect(def.knot).toMatch(new RegExp(`^${sellerKnot("pharmacy")}\\.v[1-4]$`));
    expect(talk!.lines.map((l) => l.text)).toEqual(expected.lines.map((l) => l.text));
    expect(talk!.choices).toHaveLength(4);
  });

  it("is not talked to from the gallery through the glass nor from the next shop through its wall", () => {
    const { session, ui } = setup();
    session.newGame();
    // P1's south row: CRYPTO's seller by its east wall, VOLTAGE's shop past it.
    const crypto = shop("p1-s1");
    const seller = crypto.seller!;
    const glass = galleryShopFrame(crypto.shop).point(crypto.layout!.seller.u, -0.45);
    teleport(session, glass.x, glass.z, 0, 0, seller.y);
    steps(session, 2);
    expect(Math.hypot(glass.x - seller.x, glass.z - seller.z)).toBeLessThan(2.6);
    expect(ui.getState().prompt ?? "").not.toMatch(CHAT);
    // In the next shop, a step from the wall, 1.3 m from the seller behind it.
    teleport(session, 412.75, 35.75, Math.PI / 2, 0, seller.y);
    steps(session, 2);
    expect(Math.hypot(412.75 - seller.x, 35.75 - seller.z)).toBeLessThan(1.5);
    expect(ui.getState().prompt ?? "").not.toMatch(CHAT);
  });

  it("leaves a shut shop without a seller, and gives two shops of a trade different talks", () => {
    const { session } = setup();
    session.newGame();
    const shut = ALL_SHOP_BUILDS.filter((b) => !galleryShopOpen(b.shop));
    expect(shut.length).toBeGreaterThan(5);
    const p = shop("p1-w1").seller!;
    teleport(session, p.x, p.z - 1, 0, 0, p.y);
    steps(session, 3);
    for (const b of shut) expect(sellerOf(session, b.shop.id), b.shop.id).toBeUndefined();
    const r = shut[0]!.shop.rect;
    expect([...session.sim.world].filter((e) => e.interactable && e.position.x > r.x0 && e.position.x < r.x1 && e.position.z > r.z0 && e.position.z < r.z1 && Math.abs(e.position.y - p.y) < 2)).toEqual([]);
    // The pharmacies of P1 and P2: two voices, two talks.
    const [a, c] = [SELLERS.find((s) => s.id === "p1-w1")!, SELLERS.find((s) => s.id === "p2-s1")!];
    expect(a.knot).not.toBe(c.knot);
    const said = (knot: string) => new NarrativeRuntime(STORY_SOURCE, () => {}).start(knot, session.sim.domain).lines.map((l) => l.text);
    expect(said(a.knot)[1]).not.toBe(said(c.knot)[1]);
    // Every seller's knot is in the story, with as many voices as the simulation hands out.
    const runtime = new NarrativeRuntime(STORY_SOURCE, () => {});
    for (const [scenario, n] of Object.entries(SELLER_VARIANTS))
      for (let v = 1; v <= n; v++) {
        expect(runtime.start(`${sellerKnot(scenario)}.v${v}`, session.sim.domain).lines.length, `${scenario} v${v}`).toBe(2);
        runtime.interrupt();
      }
  });

  it("draws the seller as the crowd's figure from afar and as a full character in reach of a talk", () => {
    const { session, render } = setup();
    session.newGame();
    const b = shop("p1-w1");
    const far = inShop(b, 2, -12);
    teleport(session, far.x, far.z, 0, 0, far.y);
    steps(session, 3);
    const e = sellerOf(session, "p1-w1")!;
    expect(render.views.get(e.id)?.kind).toBe("crowd");
    walkIn(session, b);
    expect(render.views.get(e.id)?.kind).toBe("npc");
    expect(render.despawns.filter(([id]) => id === e.id)).toEqual([[e.id, "unloaded"]]);
  });
});
