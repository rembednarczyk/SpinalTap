import type { DomainEvents } from "@seki/core";
import { patchUi } from "@seki/ui";
import { PhoneInbox, PhoneQueue, contactName } from "../phone";
import type { HudPart, HudPartContext, HudPartFrame, HudPatch } from "./hud-part";

/** The phone (ADR-0028): messages into the inbox, and the holocall or notification banner. */
export class PhoneHud implements HudPart {
  readonly queue = new PhoneQueue();
  readonly inbox = new PhoneInbox();
  readonly offs: readonly (() => void)[];
  private messageSeq = 0;

  constructor(private readonly ctx: HudPartContext) {
    this.offs = [ctx.bus.on("PhoneMessage", (e) => this.receive(e))];
  }

  readThread(from: string): void {
    patchUi(this.ctx.ui, { phone: this.inbox.read(from) });
  }

  frame(f: HudPartFrame): HudPatch {
    return { phoneNotice: this.queue.update({ t: f.tick / this.ctx.hooks.ticksPerSecond, busy: f.busy, calm: f.calm }) };
  }

  reset(): HudPatch {
    this.queue.clear();
    return { phoneNotice: null, phone: this.inbox.clear() };
  }

  private receive(e: DomainEvents["PhoneMessage"]): void {
    const { hooks, ui } = this.ctx;
    const message = {
      id: ++this.messageSeq,
      from: e.from,
      contact: contactName(e.from, ui.getState().settings.locale),
      kind: e.kind,
      priority: e.priority,
      lines: hooks.renderKnot(e.knot, hooks.domain()),
      time: hooks.clock(),
    };
    this.queue.push(message);
    patchUi(ui, { phone: this.inbox.add(message) });
  }
}
