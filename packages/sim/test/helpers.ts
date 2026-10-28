import { EMPTY_INPUT, type InputFrame, type Vec3 } from "@seki/core";
import type { Simulation } from "../src";

export const input = (partial: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...partial });

export const run = (sim: Simulation, steps: number, frame: InputFrame = EMPTY_INPUT): void => {
  for (let i = 0; i < steps; i++) sim.step(frame);
};

export const teleportPlayer = (sim: Simulation, position: Vec3, yaw = 0, pitch = 0): void => {
  const p = sim.player();
  if (!p) throw new Error("no player");
  p.position = position;
  p.prevPosition = position;
  p.yaw = yaw;
  p.pitch = pitch;
};

export const byKey = (sim: Simulation, key: string) => [...sim.world].find((e) => e.key === key);

export const collect = <T>(sim: Simulation, type: Parameters<Simulation["bus"]["on"]>[0]): T[] => {
  const out: T[] = [];
  sim.bus.on(type, (p) => out.push(p as T));
  return out;
};

/** What the debrief cards paid on top of the base rewards so far (ADR-0029), from now on. */
export const debriefExtras = (sim: Simulation): (() => number) => {
  const cards = collect<{ bonus: number; styleBonus: number }>(sim, "ContractDebrief");
  return () => cards.reduce((sum, c) => sum + c.bonus + c.styleBonus, 0);
};
