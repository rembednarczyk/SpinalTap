import type { TelemetryWheel } from "@seki/core";
import { type Simulation, carTelemetry, drivenCar } from "@seki/sim";

/** Where the telemetry is drawn: the engine's `VehicleTelemetry`, made by the app only behind `?telemetry=1`. */
export interface TelemetrySink {
  update(wheels: readonly TelemetryWheel[] | null): void;
}

/** The driven car's telemetry to its lines (ADR-0097 §3, `?telemetry=1`): its wheels while she drives, none on foot. */
export const feedTelemetry = (sink: TelemetrySink, sim: Pick<Simulation, "session" | "world">): void => {
  const car = drivenCar(sim);
  sink.update(car ? carTelemetry(car) : null);
};
