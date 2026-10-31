import type { DomainState, Locale } from "@seki/core";
import { CONTRACT_HOOKS } from "@seki/sim";
import { type ContractHookVm, patchUi, translate } from "@seki/ui";
import { contentText } from "../content-text";
import type { HudPart, HudPartContext, HudPatch } from "./hud-part";

/** The hooks a saved contract had found, by id and the catalog key of the line (ADR-0034). */
export const savedHooks = (domain: DomainState): ContractHookVm[] => {
  const ids = domain.contracts.hooks ?? [];
  return ids.flatMap((id) => {
    const def = CONTRACT_HOOKS.find((h) => h.id === id);
    return def ? [{ id, text: def.text }] : [];
  });
};

/** Tracker lines in `locale`: the simulation names each hook's line by key (ADR-0056). */
const hookLines = (hooks: readonly ContractHookVm[], locale: Locale): ContractHookVm[] => hooks.map((h) => ({ id: h.id, text: contentText(locale, h.text) }));

/**
 * Observation hooks of the running contract (ADR-0032): into the tracker as they are found,
 * and a guard's overheard bark as a subtitle.
 */
export class ContractIntel implements HudPart {
  readonly offs: readonly (() => void)[];
  /** Found hooks with their lines as keys; the tracker gets them written out. */
  private hooks: readonly ContractHookVm[] = [];
  private contractId: string | null = null;
  /** The language the tracker lines were written in: a change rewrites them. */
  private linesLocale: Locale | null = null;

  constructor(private readonly ctx: HudPartContext) {
    const { bus, ui } = ctx;
    const clear = () => {
      this.hooks = [];
      this.contractId = null;
      patchUi(ui, { contractHooks: [] });
    };
    this.offs = [
      bus.on("ContractAccepted", clear),
      bus.on("ContractCompleted", clear),
      bus.on("ContractFailed", clear),
      bus.on("ContractHookFound", (e) => {
        if (this.contractId !== e.contractId) this.hooks = [];
        this.contractId = e.contractId;
        if (this.hooks.some((h) => h.id === e.hookId)) return;
        this.hooks = [...this.hooks, { id: e.hookId, text: e.text }];
        const locale = ui.getState().settings.locale;
        this.linesLocale = locale;
        patchUi(ui, { contractHooks: hookLines(this.hooks, locale) });
        ctx.toast("system", translate(locale, "contract.newLead"), contentText(locale, e.text));
      }),
      bus.on("GuardBark", (e) => this.bark(e.knot)),
    ];
  }

  /** A language change rewrites the tracker lines (ADR-0056). */
  frame(): HudPatch {
    const locale = this.ctx.ui.getState().settings.locale;
    if (this.hooks.length === 0 || locale === this.linesLocale) return {};
    this.linesLocale = locale;
    return { contractHooks: hookLines(this.hooks, locale) };
  }

  reset(): HudPatch {
    const domain = this.ctx.hooks.domain();
    this.hooks = savedHooks(domain);
    this.contractId = domain.contracts.active?.id ?? null;
    this.linesLocale = this.ctx.ui.getState().settings.locale;
    return { contractHooks: hookLines(this.hooks, this.linesLocale) };
  }

  /** What a guard says within earshot, as a subtitle toast (the phone renderer's fallback is never shown). */
  private bark(knot: string): void {
    const locale = this.ctx.ui.getState().settings.locale;
    const lines = this.ctx.hooks.renderKnot(knot, this.ctx.hooks.domain());
    // The phone renderer's stand-in line, in either language, is not something a guard says.
    const filler = new Set([translate("en", "phone.newMessage"), translate("pl", "phone.newMessage")]);
    const said = lines.filter((l) => l.text && !filler.has(l.text));
    if (said.length === 0) return;
    this.ctx.toast("system", said[0]?.speaker ?? translate(locale, "contract.guard"), said.map((l) => l.text).join(" "));
  }
}
