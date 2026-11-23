import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { W3_PUBLIC_PROPS } from "../src/content/tessen-w3/public";
import { GENZO_BRAZIER, GENZO_SPOT, KAIUN_WALL, LADDER_BOARD, PIPE_LANDING, TOWER_SMOKERS, W3_OFFICE_DOOR, W3_OUTSIDE_DETAIL, W3_PIPE_LADDER, W3_PLATFORM, W3_TOWER, W3_Y, WORLD_SCENERY } from "../src";

/*
 * W-3's outside after its scenes' cards (ADR-0102 point 5): drawings only, each where its card puts it, the brazier
 * over the crate's solid, nothing in a door's way.
 */

const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
const at = (key: string) => W3_OUTSIDE_DETAIL.find((i) => keyOf(i.variant) === key)!;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("W-3's outside scene (ADR-0102 point 5)", () => {
  it("draws Genzō's brazier over the crate's solid by KAIUN, the block no more drawn, his things under its wall", () => {
    const crate = W3_PUBLIC_PROPS.find((p) => p.center.x === GENZO_BRAZIER.x && p.center.z === GENZO_BRAZIER.z)!;
    expect(crate.solid).toBe(true);
    expect(crate.scenery).toBe(true);
    expect(flat(at("rd-w3-barrel"), GENZO_BRAZIER)).toBeLessThan(1e-9);
    expect(flat(at("rd-w3-genzo"), KAIUN_WALL)).toBeLessThan(1e-9);
    expect(flat(GENZO_SPOT, GENZO_BRAZIER)).toBeLessThan(4);
  });

  it("puts the smokers by the pass office's door, out of its way, and the fitters' things on the landing", () => {
    const smokers = at("rd-w3-tower-door");
    expect(smokers.y).toBe(W3_Y);
    expect(flat(smokers, TOWER_SMOKERS)).toBeLessThan(1e-9);
    expect(smokers.x).toBeGreaterThan(W3_TOWER.maxX);
    expect(Math.abs(smokers.z - W3_OFFICE_DOOR.at.z)).toBeGreaterThan(W3_OFFICE_DOOR.width / 2 + 0.5);
    const landing = at("rd-w3-landing");
    expect(landing.y).toBe(W3_Y + W3_PLATFORM);
    expect(flat(landing, PIPE_LANDING)).toBeLessThan(1e-9);
    const board = at("rd-w3-ladder-board");
    expect(flat(board, LADDER_BOARD)).toBeLessThan(1e-9);
    expect(flat(board, W3_PIPE_LADDER)).toBeLessThan(1.5);
    expect(flat(board, W3_PIPE_LADDER)).toBeGreaterThan(0.8);
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === W3_OUTSIDE_DETAIL)).toBe(true);
  });
});
