import { patchUi } from "@seki/ui";
import type { ContractHookVm } from "@seki/ui";
import type { HudPart, HudPartContext, HudPatch } from "./hud-part";

/** Observation hooks of the running contract (ADR-0032): into the tracker as they are found. */
export class ContractIntel implements HudPart {
  readonly offs: readonly (() => void)[];
  private hooks: readonly ContractHookVm[] = [];
  private contractId: string | null = null;

  constructor(ctx: HudPartContext) {
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
    ];
  }

  reset(): HudPatch {
    this.hooks = [];
    this.contractId = null;
    return { contractHooks: [] };
  }
}
