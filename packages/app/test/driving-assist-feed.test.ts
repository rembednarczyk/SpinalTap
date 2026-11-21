import type { GameCommand } from "@seki/core";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@seki/ui";
import { feedDrivingAssist } from "../src/driving-assist-feed";
import { sanitizeSettings } from "../src/settings";

/** Her driving assists from the settings to the simulation (ADR-0097 §4): a command whenever they differ. */
describe("the driving assists' feed (ADR-0097 §4)", () => {
  it("sends the setting when the simulation's differs, and nothing when they agree", () => {
    const sent: GameCommand[] = [];
    const sim = { session: { drivingAssist: "full" as const }, enqueue: (c: GameCommand) => sent.push(c) } as never;
    feedDrivingAssist({ drivingAssist: "full" }, sim);
    expect(sent).toEqual([]);
    feedDrivingAssist({ drivingAssist: "off" }, sim);
    expect(sent).toEqual([{ type: "set-driving-assist", assist: "off" }]);
  });

  it("keeps a valid setting, and gives an old or broken entry every assist", () => {
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, drivingAssist: "abs" }).drivingAssist).toBe("abs");
    const { drivingAssist: _d, ...old } = DEFAULT_SETTINGS;
    expect(sanitizeSettings(old).drivingAssist).toBe("full");
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, drivingAssist: "turbo" }).drivingAssist).toBe("full");
  });
});
