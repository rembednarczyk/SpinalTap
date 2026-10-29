import type { AudioPort, DomainEvents, EventBus, MetroStationId } from "@seki/core";
import { type MetroIntents, type MetroRideVm, type PhoneLineVm, type UiStore, patchUi } from "@seki/ui";
import { METRO_LINE, METRO_REFUSAL_TEXT, METRO_STATION_NAMES, metroFare, metroMapVm } from "../metro";
import type { KnotPool } from "../phone";
import type { Focus, SimRef } from "./shared";

/** Ride progress reaches the store in steps of 1/50. */
const PROGRESS_STEP = 0.02;

export interface MetroControllerDeps {
  readonly bus: EventBus<DomainEvents>;
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly audio: AudioPort;
  readonly focus: Focus;
  /** The kiosk may open now: playing, and no other panel on screen. */
  readonly canOpen: () => boolean;
  /** A hot contract: the platform is watched and takes nobody (ADR-0032). */
  readonly guarded: () => boolean;
  /** Ink lines for the ride, `metro_ride_<n>`; an empty pool leaves the ride quiet. */
  readonly rideLines: KnotPool;
  /** A system toast (a refused ticket). */
  readonly toast?: (title: string, text: string) => void;
}

interface Kiosk {
  readonly from: MetroStationId;
  /** Opened by an interaction: the simulation holds the player until `end-dialogue`. */
  readonly interaction: boolean;
}

interface Ride {
  readonly from: MetroStationId;
  readonly to: MetroStationId;
  readonly seconds: number;
  elapsed: number;
  readonly lines: readonly PhoneLineVm[];
}

/**
 * The metro (ADR-0035): the line map at the ticket kiosk, which sends `travel-metro`, and the
 * ride screen between `MetroDeparted` and `MetroArrived` with the ride's ink lines as subtitles.
 * The simulation charges the fare and streams the destination; the engine draws the car.
 */
export class MetroController implements MetroIntents {
  private kiosk: Kiosk | null = null;
  private ride: Ride | null = null;
  private lastRide: MetroRideVm | null = null;

  constructor(private readonly deps: MetroControllerDeps) {
    deps.bus.on("MetroDeparted", (e) => this.depart(e));
    deps.bus.on("MetroArrived", () => this.arrive());
    deps.bus.on("MetroRefused", (e) => {
      deps.audio.play("denied");
      deps.toast?.("Kiosk odmawia", METRO_REFUSAL_TEXT[e.reason]);
    });
  }

  get isOpen(): boolean {
    return this.kiosk !== null;
  }

  get riding(): boolean {
    return this.ride !== null;
  }

  /** Shows the line map at the kiosk of `from`. */
  open(from: MetroStationId, interaction = true): void {
    if (this.kiosk || this.ride || !this.deps.canOpen()) return;
    this.kiosk = { from, interaction };
    patchUi(this.deps.ui, { metroMap: metroMapVm(from, this.deps.guarded()), prompt: null });
    this.deps.focus.panel();
  }

  travelMetro(to: MetroStationId): void {
    const kiosk = this.kiosk;
    if (!kiosk || to === kiosk.from) return;
    const eddies = this.deps.sim().domain.wallet.eddies;
    if (this.deps.guarded() || eddies < metroFare(kiosk.from, to)) {
      this.deps.audio.play("denied");
      return;
    }
    this.deps.sim().enqueue({ type: "travel-metro", to });
    this.leave();
    this.deps.audio.play("ui-select");
  }

  closeMetro(): void {
    if (this.kiosk) this.leave();
  }

  /** Advances the ride screen by `dt` seconds of game time. */
  tick(dt: number): void {
    const ride = this.ride;
    if (!ride) return;
    ride.elapsed += dt;
    this.showRide();
  }

  /** Closes the kiosk without telling the simulation (a load, the title screen). */
  closeSilently(): void {
    this.kiosk = null;
    patchUi(this.deps.ui, { metroMap: null });
  }

  /** A new game or a load: no ride carries over. */
  reset(): void {
    this.closeSilently();
    this.ride = null;
    this.lastRide = null;
    patchUi(this.deps.ui, { metroRide: null });
  }

  private leave(): void {
    const kiosk = this.kiosk;
    this.closeSilently();
    if (kiosk?.interaction) this.deps.sim().enqueue({ type: "end-dialogue" });
    this.deps.focus.settle();
  }

  private depart(e: DomainEvents["MetroDeparted"]): void {
    if (this.kiosk) this.closeSilently();
    this.ride = { from: e.from, to: e.to, seconds: Math.max(0.1, e.seconds), elapsed: 0, lines: this.deps.rideLines.next() ?? [] };
    patchUi(this.deps.ui, { prompt: null });
    this.showRide();
  }

  private arrive(): void {
    if (!this.ride) return;
    this.ride = null;
    this.lastRide = null;
    patchUi(this.deps.ui, { metroRide: null });
    this.deps.focus.settle();
  }

  private showRide(): void {
    const ride = this.ride;
    if (!ride) return;
    const progress = Math.min(1, Math.round(ride.elapsed / ride.seconds / PROGRESS_STEP) * PROGRESS_STEP);
    // The lines spread over the ride, one at a time.
    const line = ride.lines.length > 0 ? ride.lines[Math.min(ride.lines.length - 1, Math.floor((ride.elapsed / ride.seconds) * ride.lines.length))] : undefined;
    const caption = line ? { speaker: line.speaker, text: line.text } : null;
    const prev = this.lastRide;
    if (prev && prev.progress === progress && prev.caption?.text === caption?.text) return;
    this.lastRide = { line: METRO_LINE, fromName: METRO_STATION_NAMES[ride.from], toName: METRO_STATION_NAMES[ride.to], progress, caption };
    patchUi(this.deps.ui, { metroRide: this.lastRide });
  }
}
