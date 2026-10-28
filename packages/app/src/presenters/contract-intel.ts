import type { DomainState } from "@seki/core";
import { CONTRACT_HOOKS } from "@seki/sim";
import { type ContractHookVm, patchUi } from "@seki/ui";
import type { HudPart, HudPartContext, HudPatch } from "./hud-part";

/** The hooks a saved contract had found, back as tracker lines after a load (ADR-0034). */
export const savedHooks = (domain: DomainState): ContractHookVm[] => {
  const ids = domain.contracts.hooks ?? [];
  return ids.flatMap((id) => {
    const def = CONTRACT_HOOKS.find((h) => h.id === id);
    return def ? [{ id, text: def.text }] : [];
  });
};

/**
 * Observation hooks of the running contract (ADR-0032): into the tracker as they are found,
 * and a guard's overheard bark as a subtitle.
 */
export class ContractIntel implements HudPart {
  readonly offs: readonly (() => void)[];
  private hooks: readonly ContractHookVm[] = [];
  private contractId: string | null = null;

  constructor(private readonly ctx: HudPartContext) {
    const { bus, ui } = ctx;
    const clear = () => {
      this.hooks = [];
      this.contractId = null;
      patchUi(ui, { contractHooks: this.hooks });
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
        patchUi(ui, { contractHooks: this.hooks });
        ctx.toast("system", "Nowy trop", e.text);
      }),
      bus.on("GuardBark", (e) => this.bark(e.knot)),
    ];
  }

  reset(): HudPatch {
    const domain = this.ctx.hooks.domain();
    this.hooks = savedHooks(domain);
    this.contractId = domain.contracts.active?.id ?? null;
    return { contractHooks: this.hooks };
  }

  /** What a guard says within earshot, as a subtitle toast (the phone renderer's fallback is never shown). */
  private bark(knot: string): void {
    const lines = this.ctx.hooks.renderKnot(knot, this.ctx.hooks.domain());
    const said = lines.filter((l) => l.text && l.text !== "Nowa wiadomość.");
    if (said.length === 0) return;
    this.ctx.toast("system", said[0]?.speaker ?? "Strażnik", said.map((l) => l.text).join(" "));
  }
}
