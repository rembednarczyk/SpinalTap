import { describe, expect, it } from "vitest";
import {
  type EncounterDef,
  METRO_STATION_IDS,
  NO_ENCOUNTERS,
  SECONDS_PER_HOUR,
  encounterAvailable,
  isMetroStationId,
  markEncounter,
  metroFare,
  metroRefusal,
  metroRideSeconds,
  metroStops,
  nightOf,
} from "../src";

const at = (day: number, hour: number) => ({ seconds: (day - 1) * 24 * SECONDS_PER_HOUR + hour * SECONDS_PER_HOUR });

describe("metro rules (ADR-0034)", () => {
  it("prices and times a ride by the stops along the line", () => {
    expect(metroStops("shinsekai", "doki")).toBe(3);
    expect(metroStops("targ", "kanal")).toBe(1);
    expect(metroFare("shinsekai", "kanal")).toBe(20);
    expect(metroFare("doki", "shinsekai")).toBe(30);
    expect(metroRideSeconds("shinsekai", "kanal")).toBe(7);
    expect(metroRideSeconds("shinsekai", "doki")).toBe(11);
    // A few seconds at most: the ride is a short scene, not a wait.
    for (const a of METRO_STATION_IDS) for (const b of METRO_STATION_IDS) if (a !== b) expect(metroRideSeconds(a, b)).toBeLessThanOrEqual(12);
    expect(isMetroStationId("targ")).toBe(true);
    expect(isMetroStationId("moon")).toBe(false);
  });

  it("refuses a second ride, a ticket away from a kiosk, the same station, a watched platform and an empty wallet", () => {
    const ok = { from: "kanal", to: "doki", riding: false, eddies: 100, contract: false, heat: 0 } as const;
    expect(metroRefusal(ok)).toBeNull();
    expect(metroRefusal({ ...ok, riding: true })).toBe("riding");
    expect(metroRefusal({ ...ok, from: null })).toBe("not-at-kiosk");
    expect(metroRefusal({ ...ok, to: "kanal" })).toBe("same-station");
    expect(metroRefusal({ ...ok, contract: true, heat: 1 })).toBe("watched");
    // Heat without a contract, or a contract without heat, still rides.
    expect(metroRefusal({ ...ok, heat: 2 })).toBeNull();
    expect(metroRefusal({ ...ok, contract: true })).toBeNull();
    expect(metroRefusal({ ...ok, eddies: 24 })).toBe("funds");
    expect(metroRefusal({ ...ok, eddies: 25 })).toBeNull();
  });
});

describe("street encounters (ADR-0034)", () => {
  const def: EncounterDef = { id: "enc_kanal_test", district: "kanal", knot: "enc_kanal_test", fromHour: 22, toHour: 3, at: { x: 0, z: 0 }, radius: 4, once: true };

  it("opens only in its hours, wrapping past midnight", () => {
    expect(encounterAvailable(def, at(1, 23), NO_ENCOUNTERS)).toBe(true);
    expect(encounterAvailable(def, at(2, 2), NO_ENCOUNTERS)).toBe(true);
    expect(encounterAvailable(def, at(2, 3), NO_ENCOUNTERS)).toBe(false);
    expect(encounterAvailable(def, at(2, 12), NO_ENCOUNTERS)).toBe(false);
  });

  it("a one-off plays once, a nightly one once per night", () => {
    const used = markEncounter(NO_ENCOUNTERS, def, at(1, 23));
    expect(used.used).toEqual(["enc_kanal_test"]);
    expect(encounterAvailable(def, at(3, 23), used)).toBe(false);
    const nightly = { ...def, id: "enc_kanal_nightly", once: false };
    const played = markEncounter(NO_ENCOUNTERS, nightly, at(1, 23));
    expect(played.nights).toEqual({ enc_kanal_nightly: 1 });
    // After midnight it is still the same night.
    expect(nightOf(at(2, 1))).toBe(1);
    expect(encounterAvailable(nightly, at(2, 1), played)).toBe(false);
    expect(encounterAvailable(nightly, at(2, 23), played)).toBe(true);
  });
});
