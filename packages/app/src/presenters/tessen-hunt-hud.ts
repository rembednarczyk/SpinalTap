import { tessenSquadDue } from "@seki/core";
import { translate } from "@seki/ui";
import type { HudPart, HudPartContext, HudPatch } from "./hud-part";

/**
 * Tessen's hunt after W-3's loud way (ADR-0082 stage 3b): the toast of a squad on its way, read
 * from its flag, so she knows before it comes in (G-911: heat stays 0, nothing else told her).
 * Again after a load while it is on its way.
 */
export class TessenHuntHud implements HudPart {
  readonly offs: readonly (() => void)[] = [];
  private warned: string | null = null;

  constructor(private readonly ctx: HudPartContext) {}

  frame(): HudPatch {
    const due = tessenSquadDue(this.ctx.hooks.domain().flags);
    if (due && due.flag !== this.warned) {
      const locale = this.ctx.ui.getState().settings.locale;
      this.ctx.toast("heat", translate(locale, "heat.tessenHunt"), translate(locale, "heat.tessenHuntText"));
    }
    this.warned = due?.flag ?? null;
    return {};
  }

  reset(): HudPatch {
    this.warned = null;
    return {};
  }
}
