import type { Contract } from "@seki/core";
import { patchUi } from "@seki/ui";
import { bonusVm, debriefVm } from "../contract-hud";
import type { HudPart, HudPartContext, HudPatch } from "./hud-part";

/** Contract cards (ADR-0028): the condition bonus while a contract runs, the debrief after it. */
export class ContractCards implements HudPart {
  readonly offs: readonly (() => void)[];
  private lastContract: Contract | null = null;

  constructor({ bus, ui }: HudPartContext) {
    this.offs = [
      bus.on("ContractAccepted", () => patchUi(ui, { contractBonus: null })),
      bus.on("ContractCompleted", (e) => {
        this.lastContract = e.contract;
        patchUi(ui, { contractBonus: null });
      }),
      bus.on("ContractFailed", () => patchUi(ui, { contractBonus: null })),
      bus.on("ContractBonusChanged", (e) => patchUi(ui, { contractBonus: bonusVm(e) })),
      bus.on("ContractDebrief", (e) => {
        const contract = this.lastContract?.id === e.contractId ? this.lastContract : null;
        patchUi(ui, { debrief: debriefVm(e, contract, ui.getState().settings.locale) });
      }),
    ];
  }

  reset(): HudPatch {
    return { contractBonus: null, debrief: null };
  }
}
