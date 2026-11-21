import { VEHICLE_MODELS, isDrivable } from "@seki/core";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec = (v: unknown): boolean => isObject(v) && isNum(v.x) && isNum(v.y) && isNum(v.z);
const isUnit = (v: unknown): boolean => isNum(v) && v >= -1 && v <= 1;

/** A saved car's controls: throttle and brake 0..1, the steer -1..1, the handbrake on or off. */
const findControlsError = (c: unknown): string | null =>
  isObject(c) && isNum(c.throttle) && c.throttle >= 0 && c.throttle <= 1 && isNum(c.brake) && c.brake >= 0 && c.brake <= 1 && isUnit(c.steer) && typeof c.handbrake === "boolean" ? null : "car controls";

/** One saved car (ADR-0097, v52). */
const findCarError = (c: unknown): string | null => {
  if (!isObject(c)) return "car";
  if (typeof c.model !== "string" || !(VEHICLE_MODELS as readonly string[]).includes(c.model) || !isDrivable(c.model as (typeof VEHICLE_MODELS)[number])) return "car model";
  if (!Number.isInteger(c.tint) || (c.tint as number) < 0) return "car tint";
  if (!isVec(c.pos) || !isVec(c.vel) || !isVec(c.ang)) return "car motion";
  const q = c.q;
  if (!isObject(q) || !isNum(q.w) || !isNum(q.x) || !isNum(q.y) || !isNum(q.z) || Math.abs(Math.hypot(q.w, q.x, q.y, q.z) - 1) > 1e-3) return "car attitude";
  if (!Array.isArray(c.wheels) || c.wheels.length !== 4 || !c.wheels.every((w) => isObject(w) && isNum(w.omega) && isNum(w.compression) && isNum(w.alpha))) return "car wheels";
  if (!isNum(c.rpm) || !Number.isInteger(c.gear) || !isNum(c.shift) || !isNum(c.still) || typeof c.asleep !== "boolean") return "car drivetrain";
  const controls = findControlsError(c.controls);
  if (controls) return controls;
  if (c.hold !== undefined && !isVec(c.hold)) return "car hold";
  if (c.driving !== undefined && c.driving !== true) return "car driving";
  if (c.damage !== undefined && !(isNum(c.damage) && c.damage >= 0 && c.damage <= 1)) return "car damage";
  const act = c.act;
  if (act !== undefined && !(c.driving === true && isObject(act) && (act.kind === "enter" || act.kind === "exit") && isNum(act.t))) return "car act";
  return null;
};

/** The player's cars (ADR-0097, v52): optional; valid cars, at most one she drives. */
export const findCarsError = (cars: unknown): string | null => {
  if (cars === undefined) return null;
  if (!Array.isArray(cars)) return "cars";
  for (const c of cars) {
    const error = findCarError(c);
    if (error) return error;
  }
  return cars.filter((c) => isObject(c) && c.driving === true).length > 1 ? "cars driven" : null;
};
