// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { KOI_DETAIL, ROOM_DETAILS } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { mergeCityProps, parseCityProps } from "../src/renderer/city-props";
import { ROOM_DETAIL_NEAR, RoomDetailViews } from "../src/renderer/room-detail-views";

/**
 * The rooms' detail (ADR-0098) drawn near each room only, one mesh a room: not with the city's furniture blocks, which
 * are drawn whole from 170 m, a room's walls between.
 */
describe("the rooms' detail near each room (ADR-0098)", () => {
  const FILES = ["room-detail-props.glb", "room-detail-doki-props.glb", "room-detail-stare-props.glb", "room-detail-w3-props.glb", "room-detail-metro-props.glb", "room-detail-alchemia-props.glb"];
  const buffer = (name: string): ArrayBuffer =>
    ((b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)((readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url)));
  const props = FILES.map((f) => parseCityProps(buffer(f))).reduce((a, b) => mergeCityProps(a, b));
  const koi = { x: KOI_DETAIL[0]!.x, y: KOI_DETAIL[0]!.y + 1.6, z: KOI_DETAIL[0]!.z };
  const views = (quality: "high" | "low", eye: { x: number; y: number; z: number }, loaded = true) => {
    const scene = new Scene(new NullEngine());
    return new RoomDetailViews({ scene, materials: new ToonMaterials(scene), props: () => (loaded ? props : null), eye: () => eye, quality });
  };

  it("draws Neon Koi's detail in it and not from the street 100 m west of it, and W-3's from its hall's floor", () => {
    const eye = { ...koi };
    const v = views("high", eye);
    v.update();
    expect(v.stats.shown).toBeGreaterThanOrEqual(1);
    expect(v.stats.triangles).toBeGreaterThan(1000);
    // West of the bar, no room within reach (east of it, the metro's Krakowskie Przedmieście platform under the street is).
    eye.x -= 100;
    v.update();
    expect(v.stats.shown).toBe(0);
    // W-3's hall and its basement under it, both near from the hall's floor.
    [eye.x, eye.y, eye.z] = [2528, -28.6, 418];
    v.update();
    expect(v.stats.shown).toBeGreaterThanOrEqual(1);
  });

  it("holds a shown room a little past its edge, draws nearer on the phone, nothing before the props load", () => {
    const eye = { ...koi };
    const v = views("high", eye);
    v.update();
    const edge = Math.min(...KOI_DETAIL.map((i) => i.x));
    eye.x = edge - ROOM_DETAIL_NEAR.high - 2;
    v.update();
    expect(v.stats.shown).toBeGreaterThanOrEqual(1);
    eye.x = edge - ROOM_DETAIL_NEAR.high - 20;
    v.update();
    expect(v.stats.shown).toBe(0);
    const phone = views("low", { x: edge - ROOM_DETAIL_NEAR.low - 5, y: koi.y, z: koi.z });
    phone.update();
    expect(phone.stats.shown).toBe(0);
    const none = views("high", { ...koi }, false);
    none.update();
    expect(none.stats.shown).toBe(0);
    expect(ROOM_DETAILS.length).toBeGreaterThan(10);
  });
});
