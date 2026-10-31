import { type EntityId, type Locale, QUICKHACKS, type QuickhackFailure } from "@seki/core";
import { type ScanNoteVm, patchUi, translate } from "@seki/ui";
import { scanTargetVm } from "../scan-view";
import type { HudPart, HudPartContext, HudPartFrame, HudPatch } from "./hud-part";

const NOTE_SECONDS = 2.5;

export const FAILURE_TEXT: Readonly<Record<QuickhackFailure, string>> = {
  "no-ram": "Za mało RAM",
  "out-of-range": "Cel poza zasięgiem",
  "lost-target": "Utracono cel, wraca połowa RAM",
  "wrong-target": "Ten hack nie działa na ten cel",
  busy: "Trwa inny upload",
};

/** Scanner and quickhacks (ADR-0028): the scanned target, RAM, the upload, notes, and the breach result. */
export class HackingHud implements HudPart {
  readonly offs: readonly (() => void)[];
  private focusId: EntityId | null = null;
  /** The language the card was drawn in: a change redraws it for the same target (G-047). */
  private cardLocale: Locale | null = null;
  private noteTick = 0;
  private noteSeq = 0;
  private uploadSeq = 0;

  constructor(private readonly ctx: HudPartContext) {
    const { bus, ui } = ctx;
    this.offs = [
      bus.on("ScanFocusChanged", (e) => {
        this.focusId = e.targetId;
        if (e.targetId === null) patchUi(ui, { scanTarget: null });
      }),
      bus.on("RamChanged", (e) => patchUi(ui, { ram: { current: e.current, max: e.max } })),
      bus.on("QuickhackStarted", (e) => patchUi(ui, { upload: { seq: ++this.uploadSeq, hackId: e.hackId, seconds: e.upload } })),
      bus.on("QuickhackApplied", (e) => {
        patchUi(ui, { upload: null });
        this.note("ok", `${QUICKHACKS[e.hackId].title}: wgrano`);
      }),
      bus.on("QuickhackFailed", (e) => {
        if (ui.getState().upload?.hackId === e.hackId) patchUi(ui, { upload: null });
        this.note("fail", `${QUICKHACKS[e.hackId].title}: ${FAILURE_TEXT[e.reason]}`);
      }),
      bus.on("QuickhackTraced", () => this.note("traced", "Namierzono cię! Sieć zna twoją pozycję")),
      bus.on("BreachCompleted", (e) => {
        // The result in the language of the moment (ADR-0056), the daemons by their catalog names.
        const locale = ui.getState().settings.locale;
        const daemons = e.daemons.map((d) => translate(locale, `breach.daemon.${d}`)).join(", ");
        ctx.toast("system", translate(locale, "breach.done"), e.daemons.length > 0 ? translate(locale, "breach.daemons", { daemons }) : translate(locale, "breach.nothing"));
      }),
    ];
  }

  wanted(): Iterable<EntityId> {
    return this.focusId !== null ? [this.focusId] : [];
  }

  frame(f: HudPartFrame): HudPatch {
    const out: HudPatch = {};
    const ui = this.ctx.ui;
    if (this.focusId !== null) {
      const target = f.found.get(this.focusId);
      const prev = ui.getState().scanTarget;
      const locale = ui.getState().settings.locale;
      if (!target) out.scanTarget = null;
      else if (prev?.id !== target.id || this.cardLocale !== locale) {
        out.scanTarget = scanTargetVm(target, locale);
        this.cardLocale = locale;
      }
    }
    if (ui.getState().scanNote && f.tick - this.noteTick >= NOTE_SECONDS * this.ctx.hooks.ticksPerSecond) out.scanNote = null;
    return out;
  }

  reset(): HudPatch {
    this.focusId = null;
    return { scanTarget: null, upload: null, scanNote: null };
  }

  private note(tone: ScanNoteVm["tone"], text: string): void {
    this.noteTick = this.ctx.hooks.tick();
    patchUi(this.ctx.ui, { scanNote: { seq: ++this.noteSeq, tone, text } });
  }
}
