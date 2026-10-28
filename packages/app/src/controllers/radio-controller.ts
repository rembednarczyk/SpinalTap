import type { AudioPort } from "@seki/core";
import { RADIO_STATIONS, type RadioIntents, type RadioStationId, type SettingsVm, type UiStore, radioStationName } from "@seki/ui";
import type { KnotPool } from "../phone";

/** Seconds of play between two inserts of the station (a DJ line, an ad, the news). */
export const RADIO_INSERT_SECONDS = 45;

/** The order B walks through: every station, then off. */
const DIAL: readonly (RadioStationId | null)[] = [...RADIO_STATIONS.map((s) => s.id), null];

/**
 * Proposed audio contract (ADR-0035): the engine plays the station as a sequencer programme;
 * null stops it. Optional, so the app calls it only when the adapter has it.
 */
export interface RadioAudio {
  setRadioStation?(id: RadioStationId | null): void;
}

export interface RadioControllerDeps {
  readonly ui: UiStore;
  readonly audio: AudioPort;
  /** Saves the station with the settings (localStorage in the browser). */
  readonly changeSettings: (patch: Partial<SettingsVm>) => void;
  /** Ink inserts per station, `radio_<station>_<n>`; an empty pool plays music only. */
  readonly inserts: (station: RadioStationId) => KnotPool;
  /** A radio toast: the station's name, and an insert's line when there is one. */
  readonly toast: (title: string, text: string) => void;
  readonly insertSeconds?: number;
}

/**
 * The radio (ADR-0035): three stations and off, picked with B or in the phone. The station is a
 * setting, so it survives a reload; the engine plays it, and inserts from ink come up as
 * subtitles in a toast now and then. Pure presentation: nothing of it reaches the simulation.
 */
export class RadioController implements RadioIntents {
  private sinceInsert = 0;

  constructor(private readonly deps: RadioControllerDeps) {
    // The station saved last time plays from the start.
    this.tune(this.station);
  }

  get station(): RadioStationId | null {
    return this.deps.ui.getState().settings.radioStation;
  }

  setRadioStation(id: RadioStationId | null): void {
    if (id === this.station) return;
    this.deps.changeSettings({ radioStation: id });
    this.tune(id);
    this.deps.toast(radioStationName(id), id ? (RADIO_STATIONS.find((s) => s.id === id)?.genre ?? "") : "");
  }

  nextRadioStation(): void {
    const i = DIAL.indexOf(this.station);
    this.setRadioStation(DIAL[(i + 1) % DIAL.length] ?? null);
  }

  /** Advances the radio by `dt` seconds of play; an insert comes every `insertSeconds`. */
  tick(dt: number): void {
    const station = this.station;
    if (!station) return;
    this.sinceInsert += dt;
    if (this.sinceInsert < (this.deps.insertSeconds ?? RADIO_INSERT_SECONDS)) return;
    this.sinceInsert = 0;
    const lines = this.deps.inserts(station).next();
    const text = lines?.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join(" ");
    if (text) this.deps.toast(radioStationName(station), text);
  }

  private tune(id: RadioStationId | null): void {
    this.sinceInsert = 0;
    (this.deps.audio as AudioPort & RadioAudio).setRadioStation?.(id);
  }
}
