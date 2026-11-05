import type { MetroStationId } from "@seki/core";
import type { MapMetroVm, MetroMapVm, MetroPreviewVm, MetroStopVm } from "../src";

/** The metro of the tests (ADR-0071): four stations like the game's, two possible ones. */
export const METRO_LAYER: MapMetroVm = {
  stations: [
    { id: "shinsekai", name: "Plac Litewski", district: "Krakowskie Przedmieście", x: 158, z: -58, entrances: [{ label: "A", name: "Plac Litewski", x: 158, z: -58 }] },
    { id: "kanal", name: "Brama Krakowska", district: "Stare Miasto", x: 490, z: -76, entrances: [{ label: "A", name: "Brama Krakowska", x: 490, z: -76 }] },
    { id: "targ", name: "Plac Zamkowy", district: "Podzamcze", x: 717, z: 297, entrances: [{ label: "A", name: "Plac Zamkowy", x: 717, z: 297 }] },
    { id: "doki", name: "Nabrzeże Bystrzycy", district: "Nabrzeże Bystrzycy", x: 2527, z: 392, entrances: [{ label: "A", name: "Nabrzeże Bystrzycy", x: 2527, z: 392 }] },
  ],
  legs: [
    [158, -58, 342, -89, 490, -76],
    [490, -76, 442, -20, 585, 362, 717, 297],
    [717, 297, 1700, 380, 2527, 392],
  ],
  planned: [
    { id: "ogrod-saski", name: "Ogród Saski", from: "shinsekai", x: -810, z: 180, path: [158, -58, -810, 180], distance: 1010 },
    { id: "lublin-glowny", name: "Lublin Główny", from: "kanal", x: 560, z: -2030, path: [490, -76, 560, -2030], distance: 1960 },
  ],
};

const IDS: readonly MetroStationId[] = ["shinsekai", "kanal", "targ", "doki"];

/** The kiosk at `from`, with `selected` chosen: fares and times by the game's rules. */
export const kioskVm = (from: MetroStationId, selected: MetroStationId | null = null, refusal: string | null = null, fareOf?: (stops: number) => number): MetroMapVm => {
  const stopsTo = (id: MetroStationId) => Math.abs(IDS.indexOf(id) - IDS.indexOf(from));
  const fare = (n: number) => (n === 0 ? 0 : (fareOf?.(n) ?? 15 + 5 * n));
  const stops: MetroStopVm[] = METRO_LAYER.stations.map((s) => ({ id: s.id, name: s.name, fare: fare(stopsTo(s.id)), stops: stopsTo(s.id), seconds: stopsTo(s.id) === 0 ? 0 : 5 + 2 * stopsTo(s.id), here: s.id === from }));
  let preview: MetroPreviewVm | null = null;
  if (selected) {
    const s = METRO_LAYER.stations.find((x) => x.id === selected)!;
    const a = IDS.indexOf(from);
    const b = IDS.indexOf(selected);
    const route = (a <= b ? IDS.slice(a, b + 1) : IDS.slice(b, a + 1).reverse()) as MetroStationId[];
    preview = {
      id: selected,
      name: s.name,
      district: s.district,
      entrances: s.entrances,
      x: s.x,
      z: s.z,
      near:
        selected === "targ"
          ? [
              { kind: "shop", label: "prompt.shop.oyaji", x: 769, z: 327, distance: 60 },
              { kind: "contract", label: "metro.near.contract", name: "Hana", x: 781, z: 334, distance: 70 },
            ]
          : [],
      route,
      fare: fare(stopsTo(selected)),
      stops: stopsTo(selected),
      seconds: 5 + 2 * stopsTo(selected),
    };
  }
  return { line: "Kanjō Line", from, stops, selected, preview, refusal };
};
