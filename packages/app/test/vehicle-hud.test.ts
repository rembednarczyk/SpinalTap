import { type EntityId, vehicleSpec } from "@seki/core";
import type { CarState, Entity } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { LAMP_HOLD, VehicleHud } from "../src/presenters/vehicle-hud";
import type { HudPartFrame } from "../src/presenters/hud-part";

/*
 * The car's dashboard on the HUD (ADR-0097 §3): the speed, the gear, the revs in twentieths and the
 * ABS and TC lamps, held a quarter of a second after the assist last worked so they do not flicker.
 */

const CAR = 7 as EntityId;
const { idle, limiter } = vehicleSpec("sedan").engine;
const wheel = (eased: "abs" | "tc" | null) => ({ omega: 0, compression: 0, alpha: 0, load: 1, contact: null, normal: { x: 0, y: 1, z: 0 }, slipRatio: 0, slipAngle: 0, fx: 0, fy: 0, eased });
const carOf = (rpm: number, eased: "abs" | "tc" | null = null): CarState =>
  ({
    model: "sedan",
    pos: { x: 0, y: 0, z: 0 },
    q: { w: 1, x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 10 },
    ang: { x: 0, y: 0, z: 0 },
    wheels: [wheel(eased), wheel(null), wheel(null), wheel(null)],
    rpm,
    gear: 3,
    shift: 0,
    controls: { throttle: 0, brake: 0, steer: 0, handbrake: false },
    asleep: false,
    still: 0,
    hold: null,
  }) as CarState;

const frame = (tick: number, car: CarState | null): HudPartFrame => ({
  tick,
  found: new Map(car ? [[CAR, { id: CAR, car } as unknown as Entity]] : []),
  player: { id: 1, seated: car ? CAR : undefined } as unknown as Entity,
  busy: false,
  calm: true,
});

describe("the car's dashboard (ADR-0097 §3)", () => {
  it("shows the speed, the gear and the revs from idle to the limiter in twentieths", () => {
    const hud = new VehicleHud();
    expect(hud.frame(frame(0, carOf(idle))).vehicle).toEqual({ kmh: 36, gear: "3", revs: 0, abs: false, tc: false });
    expect(hud.frame(frame(1, carOf(idle + 0.52 * (limiter - idle)))).vehicle?.revs).toBeCloseTo(0.5, 9);
    expect(hud.frame(frame(2, carOf(limiter + 500))).vehicle?.revs).toBe(1);
  });

  it("lights a lamp while its assist works and keeps it lit a quarter of a second after", () => {
    const hud = new VehicleHud();
    expect(hud.frame(frame(10, carOf(idle, "abs"))).vehicle).toMatchObject({ abs: true, tc: false });
    expect(hud.frame(frame(10 + LAMP_HOLD - 1, carOf(idle))).vehicle).toMatchObject({ abs: true });
    expect(hud.frame(frame(10 + LAMP_HOLD, carOf(idle))).vehicle).toMatchObject({ abs: false });
    expect(hud.frame(frame(40, carOf(idle, "tc"))).vehicle).toMatchObject({ abs: false, tc: true });
  });

  it("clears on foot", () => {
    const hud = new VehicleHud();
    hud.frame(frame(0, carOf(idle)));
    expect(hud.frame(frame(1, null)).vehicle).toBeNull();
  });
});
