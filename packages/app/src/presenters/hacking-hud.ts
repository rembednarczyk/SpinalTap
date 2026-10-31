import type { EntityId, Locale } from "@seki/core";
import { type MessageKey, type MessageParams, type ScanNoteVm, patchUi, translate } from "@seki/ui";
import { scanTargetVm } from "../scan-view";
import type { HudPart, HudPartContext, HudPartFrame, HudPatch } from "./hud-part";

const NOTE_SECONDS = 2.5;

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
        this.note("ok", this.t("hack.uploaded", { hack: this.t(`quickhack.${e.hackId}`) }));
      }),
      bus.on("QuickhackFailed", (e) => {
        if (ui.getState().upload?.hackId === e.hackId) patchUi(ui, { upload: null });
        this.note("fail", this.t("hack.failed", { hack: this.t(`quickhack.${e.hackId}`), reason: this.t(`hack.fail.${e.reason}`) }));
      }),
      bus.on("QuickhackTraced", () => this.note("traced", this.t("hack.traced"))),
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

  /** A note in the language of the moment (ADR-0056). */
  private t(key: MessageKey, params?: MessageParams): string {
    return translate(this.ctx.ui.getState().settings.locale, key, params);
  }

  private note(tone: ScanNoteVm["tone"], text: string): void {
    this.noteTick = this.ctx.hooks.tick();
    patchUi(this.ctx.ui, { scanNote: { seq: ++this.noteSeq, tone, text } });
  }
}
