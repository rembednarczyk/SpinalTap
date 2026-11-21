import type { Simulation } from "@seki/sim";
import type { SettingsVm } from "@seki/ui";

/**
 * Her driving assists (ADR-0097 §4) from the settings to the simulation: whenever the setting and the
 * simulation's differ (a change, a new game, a load), the `set-driving-assist` command, taken at the
 * next step. The simulation keeps it in its session, not in the save.
 */
export const feedDrivingAssist = (settings: Pick<SettingsVm, "drivingAssist">, sim: Pick<Simulation, "session" | "enqueue">): void => {
  if (sim.session.drivingAssist !== settings.drivingAssist) sim.enqueue({ type: "set-driving-assist", assist: settings.drivingAssist });
};
