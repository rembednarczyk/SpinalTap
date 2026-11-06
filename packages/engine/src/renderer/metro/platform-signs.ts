import { METRO_STATION_IDS } from "@seki/core";
import { metroStation } from "@seki/sim";
import { glyphCell } from "../mapcity/venue-plan";
import type { MeshSink, Vec } from "../mesh-sink";
import { LINE_AMBER } from "./pavilion-dress";
import { pavilionFrame } from "./pavilion-frame";
import { letters } from "./pavilion-signs";
import { type PlatformEntrance, departureBoard, namePlates } from "./platform-plan";

/**
 * The letters of a metro platform (ADR-0071 stage 4) on the map's sign material, one quad a
 * letter from the glyph atlas (ADR-0064): the station's name on the plates of the back wall, in
 * white, and the departures' board in the line's amber, each side the trains going one way, to
 * the line's end that way and in how many minutes. Lublin's names, the same in every language,
 * as on the pavilions; "MIN" reads the same in both.
 */

const NAME_GLYPH = 0.34;
const BOARD_GLYPH = 0.16;
const WHITE = "#f2f4f7";

/** Only the letters the atlas holds. */
const drawable = (text: string): string => [...text].filter((ch) => glyphCell(ch) !== null).join("");

/** The ends of the line from a station, each with the minutes to the next train that way (none past an end). */
export const departures = (station: PlatformEntrance["station"]): { readonly to: string; readonly minutes: number }[] => {
  const i = METRO_STATION_IDS.indexOf(station);
  const ends: { to: string; minutes: number }[] = [];
  const first = METRO_STATION_IDS[0];
  const last = METRO_STATION_IDS[METRO_STATION_IDS.length - 1];
  if (first && i > 0) ends.push({ to: metroStation(first).name, minutes: 2 + (i % 3) });
  if (last && i < METRO_STATION_IDS.length - 1) ends.push({ to: metroStation(last).name, minutes: 1 + ((i + 2) % 4) });
  return ends;
};

/** The letters of one platform; how many lines of them. */
export const planPlatformSigns = (sink: MeshSink, e: PlatformEntrance): number => {
  const f = pavilionFrame(e);
  const p = e.platform;
  const name = drawable(metroStation(e.station).name.toUpperCase());
  const inward = f.inward;
  let lines = 0;
  for (const n of namePlates(p)) {
    letters(sink, name, f.at(p.u.back + 0.03, n.w, n.y - NAME_GLYPH / 2 + 0.02), inward, NAME_GLYPH, n.width - 0.4, WHITE);
    lines++;
  }
  const b = departureBoard(p);
  const mid = (b.u0 + b.u1) / 2;
  const rows = departures(e.station);
  for (const k of [-1, 1] as const) {
    const n: Vec = { x: f.across.x * k, y: 0, z: f.across.z * k };
    rows.forEach((r, i) => {
      const y = b.y1 - 0.2 - i * 0.26;
      letters(sink, drawable(`${r.to.toUpperCase()} ${r.minutes} MIN`), f.at(mid, b.w + k * 0.04, y - BOARD_GLYPH / 2), n, BOARD_GLYPH, b.u1 - b.u0 - 0.2, LINE_AMBER);
      lines++;
    });
  }
  return lines;
};
