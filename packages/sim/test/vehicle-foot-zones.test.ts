import { type CarSnapshot, EMPTY_INPUT, type InputFrame } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Simulation, ground } from "../src";
import { ROAD_CHAINS } from "../src/content/lublin/roads";
import { FOOT_ZONE, footGroundAt } from "../src/world/vehicle/foot-zones";
import { restoreCars } from "../src/world/vehicle/saved-cars";

/*
 * Cars where only feet belong (ADR-0097 §3): the deptak of Krakowskie Przedmieście and the Old
 * Town's streets (deliveries only) and the pavements are for feet; a car street's carriageway is not.
 * Driving there a while is a trespass for the street's witnesses; on a car street it is nothing.
 */

const midpoints = (name: string, use: "cars" | "deliveries") =>
  ROAD_CHAINS.filter((c) => c.name === name && c.use === use).flatMap((c) => c.points.slice(1).map((p, i) => ({ x: (p[0] + c.points[i]![0]) / 2, z: (p[1] + c.points[i]![1]) / 2, along: Math.atan2(p[0] - c.points[i]![0], p[1] - c.points[i]![1]) })));

const DEPTAK = midpoints("Krakowskie Przedmieście", "deliveries");
const ALEJA = midpoints("Aleja Tysiąclecia", "cars");

describe("cars where only feet belong (ADR-0097 §3)", () => {
  it("knows the deptak's carriageway for feet and a car street's for cars", () => {
    expect(DEPTAK.length).toBeGreaterThan(3);
    expect(ALEJA.length).toBeGreaterThan(3);
    expect(DEPTAK.filter((p) => footGroundAt(p.x, p.z)).length).toBeGreaterThan(DEPTAK.length * 0.7);
    expect(ALEJA.filter((p) => footGroundAt(p.x, p.z))).toHaveLength(0);
  });

  it("makes a stretch of driving on the deptak a trespass, and none on a car street", () => {
    const offences = (at: { x: number; z: number; along: number }) => {
      const sim = Simulation.create({ seed: 4, crowd: "off", traffic: "off" });
      sim.step();
      const y = ground(at.x, at.z).y;
      const [sx, sz] = [Math.sin(at.along), Math.cos(at.along)];
      const car: CarSnapshot = {
        model: "sedan",
        tint: 1,
        pos: { x: at.x, y: y + 0.55, z: at.z },
        q: { w: Math.cos(at.along / 2), x: 0, y: Math.sin(at.along / 2), z: 0 },
        vel: { x: sx * 6, y: 0, z: sz * 6 },
        ang: { x: 0, y: 0, z: 0 },
        wheels: Array.from({ length: 4 }, () => ({ omega: 6 / 0.33, compression: 0.06, alpha: 0 })),
        rpm: 2000,
        gear: 1,
        shift: 0,
        controls: { throttle: 0.2, brake: 0, steer: 0, handbrake: false },
        asleep: false,
        still: 0,
        driving: true,
      };
      restoreCars(sim.world, sim.session, sim.player() ?? null, [car]);
      const before = sim.session.street.incidents;
      const input: InputFrame = { ...EMPTY_INPUT, moveZ: 0.25 };
      for (let i = 0; i < Math.round((FOOT_ZONE.after + 0.75) * 60); i++) sim.step(input);
      // The crime system takes the offences off the street each step: the incidents count them.
      return sim.session.street.incidents - before;
    };
    const onDeptak = DEPTAK.find((p) => footGroundAt(p.x, p.z))!;
    expect(offences(onDeptak)).toBeGreaterThanOrEqual(1);
    expect(offences(ALEJA[Math.floor(ALEJA.length / 2)]!)).toBe(0);
  });
});
