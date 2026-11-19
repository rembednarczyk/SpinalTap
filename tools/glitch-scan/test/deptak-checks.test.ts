import { describe, expect, it } from "vitest";
import { type Deptak, METRO_B_WAY, TROLLEY_OFF, TROLLEY_ROOM, deptakCarLanes, deptakStallClear, deptaksOf, onDeptak, roadRetagRows } from "./deptak-checks";

/** A deptak 50 m long northwards from (0; 0), 5 m of its old carriageway either side. */
const D: Deptak = {
  id: "w1",
  line: [
    { x: 0, z: 0 },
    { x: 0, z: 50 },
  ],
  half: 5,
};
const line = (id: string, pts: readonly [number, number][]) => ({ id, osmId: Number(id.slice(1)), tags: { highway: "residential" }, line: pts.map(([x, z]) => ({ x, z })) });

describe("the deptaki's checks (ADR-0074, T-324)", () => {
  it("reads a deptak's old carriageway between its ends, not the junction past them", () => {
    expect(onDeptak(D, 4, 20)).toBe(true);
    expect(onDeptak(D, 6, 20)).toBe(false);
    expect(onDeptak(D, 0, -2)).toBe(false);
    expect(onDeptak(D, 0, 52)).toBe(false);
    expect(deptaksOf([{ id: "w1", reason: "", ref: "T-1" }], [line("w1", [[0, 0], [0, 50]]), line("w2", [[9, 0], [9, 9]])], () => 10)).toEqual([D]);
  });

  it("finds a car route along a deptak, and only a car's: not a delivery van's, a trolleybus's or one crossing the junction past its end", () => {
    const routes = [
      { id: "lane", use: "cars", points: [[1.6, -20], [1.6, 60]] as [number, number][] },
      { id: "van", use: "deliveries", points: [[0, -20], [0, 60]] as [number, number][] },
      { id: "bus", use: "trolley", points: [[1.6, -20], [1.6, 60]] as [number, number][] },
      { id: "by", use: "cars", points: [[-20, -3], [20, -3]] as [number, number][] },
    ];
    expect(deptakCarLanes([D], routes)).toEqual([{ at: "2,1", what: "lane on w1" }]);
  });

  it("asks every way of the list for its register row naming it", () => {
    const register = ["| T-324 | Lubartowska w1 | deptak |", "| T-325 | coś innego |"].join("\n");
    const ways = [line("w1", [[0, 0], [0, 50]])];
    expect(roadRetagRows([{ id: "w1", reason: "", ref: "T-324" }], ways, register)).toEqual([]);
    expect(roadRetagRows([{ id: "w1", reason: "", ref: "T-325" }], ways, register)).toEqual([{ at: "0,0", what: "w1: T-325 does not name it" }]);
    expect(roadRetagRows([{ id: "w1", reason: "", ref: "T-326" }], ways, register)).toEqual([{ at: "0,0", what: "w1: no row T-326" }]);
  });

  it("finds a stall by the trolleybus's line or in metro B's way, not one clear of both or off the deptak", () => {
    const at = (x: number, z: number, r = 1) => ({ x, z, r, what: "kiosk" });
    // West of the axis, 2.5 m: 4.1 m from the line, 3.1 m clear of it.
    expect(deptakStallClear([D], [at(-2.5, 10)])).toEqual([]);
    // East of it: its reach comes within 1.4 m of the line.
    const close = TROLLEY_OFF - TROLLEY_ROOM - 1 + 0.8;
    expect(deptakStallClear([D], [at(close, 10)])).toHaveLength(1);
    // In the way from metro B onto the deptak (a deptak there in the test).
    const by: Deptak = { id: "w2", line: [{ x: METRO_B_WAY.maxX - 3, z: 0 }, { x: METRO_B_WAY.maxX - 3, z: 60 }], half: 5 };
    expect(deptakStallClear([by], [at(by.line[0]!.x - 2.5, 28)])).toEqual([{ at: "442,28", what: "kiosk in metro B's way onto w2" }]);
    expect(deptakStallClear([by], [at(by.line[0]!.x - 2.5, 33)])).toEqual([]);
    // Off the deptak: the pavement's own checks.
    expect(deptakStallClear([D], [at(1.6, 70)])).toEqual([]);
  });
});
