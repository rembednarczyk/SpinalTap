import { describe, expect, it } from "vitest";
import { W3_HALL_DOORS, W3_ROOF, WORLD_CHUNKS, w3 } from "@seki/sim";
import { type TransformNode, Vector3 } from "../src/babylon";
import { W3InteriorCull, W3_INTERIOR_RANGE, inW3Hall, inW3Interior } from "../src/renderer/tessen-w3/w3-interior-cull";

/**
 * W-3's hall from afar (ADR-0082 §4, stage 2): its doors' leaves, stairs and ladders inside are
 * drawn only within 30 m of its rooms; what stands in its outer walls and on its roofs stays.
 */

const OUTER = new Set(["door:w3-airlock-s-out", "door:w3-airlock-n-out"]);

describe("W-3's hall's own meshes from afar (ADR-0082 §4)", () => {
  it("counts the inner doors in, the doors in its outer walls, the roofs and the shut wagon gate out", () => {
    for (const d of W3_HALL_DOORS) {
      const leaf = { x: d.at.x, y: d.at.y + d.height / 2, z: d.at.z };
      expect(inW3Interior(leaf), d.key).toBe(!OUTER.has(d.key));
    }
    const w3Props = WORLD_CHUNKS.find((c) => c.id === "nabrzeze-w3")!.props;
    const roofs = w3Props.filter((p) => p.view.kind === "block" && !p.view.interior && Math.abs(p.center.y + p.view.size.y / 2 - w3(0, W3_ROOF, 0).y) < 1e-6 && p.view.size.x > 5);
    expect(roofs.length).toBe(2);
    for (const p of roofs) expect(inW3Interior(p.center), `${p.center.x},${p.center.z}`).toBe(false);
    expect(inW3Interior(w3(2499.875, 3.5, 418))).toBe(false);
    // The ladders up to the crane's track, up the goods lift's shaft and up to the roof hatch are in.
    const ladders = w3Props.filter((p) => p.view.kind === "block" && p.view.rungs);
    const inside = ladders.filter((p) => inW3Interior(p.center));
    expect(inside.length).toBe(3);
  });

  it("draws the hall's merged blocks with it, but its outer walls, the cooling units and the shut leaves in its facades always", () => {
    const merged = WORLD_CHUNKS.find((c) => c.id === "nabrzeze-w3")!.props.filter((p) => p.view.kind === "block" && p.view.interior);
    const out = merged.filter((p) => !inW3Hall(p.center));
    // The west wall in pieces round its doors and the gate, the north and east walls, five cooling units, the hatch's curb, the roof by the hatch, the gate.
    for (const p of out) expect(p.center.x < (p.center.z < 406 ? 2500 : 2500.31) || p.center.z > 439.69 || p.center.x > (p.center.z >= 430 ? 2571.69 : 2572) || p.center.z < (p.center.y < w3(0, 0, 0).y ? 395.5 : 396) || p.center.y > w3(0, 10, 0).y, `${p.center.x},${p.center.y},${p.center.z}`).toBe(true);
    // Of the culvert only its mouth by the river.
    for (const p of out.filter((q) => q.center.x < 2500)) expect(p.center.x < 2472.3 || p.center.y > w3(0, 0, 0).y, `${p.center.x}`).toBe(true);
    expect(out.filter((p) => p.center.y > w3(0, W3_ROOF, 0).y && p.view.kind === "block" && p.view.size.x === 3)).toHaveLength(5);
    expect(inW3Hall(w3(2529, 15.85, 418))).toBe(true);
    expect(inW3Hall(w3(2530, -2, 401))).toBe(true);
    expect(inW3Hall(w3(2572.03, 3, 418))).toBe(false);
    expect(inW3Hall(w3(2552, 1.3, 395.97))).toBe(false);
    expect(inW3Hall(w3(2490, -2, 407.2))).toBe(true);
    expect(inW3Hall(w3(2500.19, 2.65, 404.2))).toBe(true);
    expect(inW3Hall(w3(2500.15, 5, 420))).toBe(false);
    expect(inW3Hall(w3(2530.5, -2.45, 395.85))).toBe(true);
    expect(inW3Hall(w3(2466, -1.4, 407.2))).toBe(false);
  });

  it("hides them from the Lutosławski bridge and shows them within 30 m of the rooms", () => {
    const cull = new W3InteriorCull();
    const state = { enabled: true };
    const node = { setEnabled: (on: boolean) => (state.enabled = on) } as unknown as TransformNode;
    cull.track(1, node, new Vector3(2512, w3(0, 1.3, 0).y, 406));
    cull.track(2, { setEnabled: () => { throw new Error("outside"); } } as unknown as TransformNode, new Vector3(2450, 0, 430));
    expect(cull.size).toBe(1);
    expect(state.enabled).toBe(false);
    cull.update(new Vector3(2462, w3(0, 3.5, 0).y, 421));
    expect(state.enabled).toBe(false);
    cull.update(new Vector3(2500 - W3_INTERIOR_RANGE + 1, w3(0, 1.6, 0).y, 418));
    expect(state.enabled).toBe(true);
    cull.update(new Vector3(2529, w3(0, 1.6, 0).y, 418));
    expect(state.enabled).toBe(true);
    cull.untrack(1);
    expect(cull.size).toBe(0);
  });
});
