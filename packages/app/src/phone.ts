import type { DomainState, Locale, PhonePriority } from "@seki/core";
import { NarrativeRuntime, type StorySources } from "@seki/narrative";
import { narrativeText } from "./content-text";
import { type PhoneLineVm, type PhoneMessageVm, type PhoneNoticeVm, type PhoneThreadVm, type PhoneVm, isMessageKey, translate } from "@seki/ui";

/** Display names of the phone contacts, or catalog keys for the ones with a role (ADR-0056); an unknown id is shown capitalised. */
export const CONTACT_NAMES: Readonly<Record<string, string>> = {
  kaito: "Kaito",
  hana: "Hana",
  genzo: "Genzō",
  mori: "speaker.mori",
  oyaji: "Oyaji",
  mika: "Mika",
  fumiko: "Fumiko",
};

export const contactName = (from: string, locale: Locale = "en"): string => {
  const name = CONTACT_NAMES[from];
  if (name) return isMessageKey(name) ? translate(locale, name) : name;
  return from ? from[0]!.toUpperCase() + from.slice(1) : translate(locale, "phone.unknown");
};

/** Seconds a banner stays up: a text 5 s, a holocall about as long as it takes to read. */
export const noticeSeconds = (m: Pick<PhoneMessageVm, "kind" | "priority" | "lines">): number => {
  if (m.priority !== "story" && m.kind === "text") return 5;
  const chars = m.lines.reduce((n, l) => n + l.text.length, 0);
  return Math.min(12, Math.max(4, 2 + chars * 0.05));
};

/** Seconds of quiet after a banner before an `info` message may show. */
export const INFO_GAP = 8;

export interface PhoneMoment {
  /** Seconds of game time (the simulation's ticks). */
  readonly t: number;
  /** A conversation, a shop, a breach or combat: only story gets through. */
  readonly busy: boolean;
  /** Nothing going on at all (no heat, no scanner): news may come in. */
  readonly calm: boolean;
}

const RANK: Readonly<Record<PhonePriority, number>> = { story: 0, contract: 1, info: 2 };

/**
 * The one notification queue of the phone (ADR-0028, Cyberpunk 2077 after 2.0): `story`
 * interrupts anything as a holocall, `contract` waits until the player is out of a
 * conversation and out of combat, `info` waits for a quiet moment. One banner at a time; a
 * banner pushed aside by a story call comes back after it.
 */
export class PhoneQueue {
  private pending: PhoneMessageVm[] = [];
  private current: { readonly notice: PhoneNoticeVm; readonly until: number } | null = null;
  private quietSince = -Infinity;

  push(message: PhoneMessageVm): void {
    // Stable by priority: story first, then contracts, then news, each in arrival order.
    const i = this.pending.findIndex((m) => RANK[m.priority] > RANK[message.priority]);
    if (i < 0) this.pending.push(message);
    else this.pending.splice(i, 0, message);
  }

  get waiting(): number {
    return this.pending.length;
  }

  clear(): void {
    this.pending = [];
    this.current = null;
    this.quietSince = -Infinity;
  }

  /** What shows now; the same object as long as nothing changes. */
  update(now: PhoneMoment): PhoneNoticeVm | null {
    const cur = this.current;
    if (cur && now.t >= cur.until) {
      this.current = null;
      this.quietSince = now.t;
    } else if (cur && !cur.notice.holocall) {
      // A story call, a fight or a conversation pushes a banner aside; it comes back later.
      const story = this.pending[0]?.priority === "story";
      if (story || now.busy) {
        this.current = null;
        this.push(cur.notice.message);
      }
    }
    if (this.current) return this.current.notice;
    const next = this.pending[0];
    if (!next) return null;
    const allowed = next.priority === "story" || (next.priority === "contract" ? !now.busy : now.calm && now.t - this.quietSince >= INFO_GAP);
    if (!allowed) return null;
    this.pending.shift();
    const notice = { message: next, holocall: next.priority === "story" };
    this.current = { notice, until: now.t + noticeSeconds(next) };
    return notice;
  }
}

/** Every message, one thread per contact; a thread is read when the phone shows it. */
export class PhoneInbox {
  private threads = new Map<string, { messages: PhoneMessageVm[]; read: number }>();
  private vm: PhoneVm = { threads: [], unread: 0 };
  private order: string[] = [];

  add(m: PhoneMessageVm): PhoneVm {
    const t = this.threads.get(m.from) ?? { messages: [], read: 0 };
    t.messages = [...t.messages, m];
    this.threads.set(m.from, t);
    this.order = [m.from, ...this.order.filter((f) => f !== m.from)];
    return this.build();
  }

  read(from: string): PhoneVm {
    const t = this.threads.get(from);
    if (!t || t.read === t.messages.length) return this.vm;
    t.read = t.messages.length;
    return this.build();
  }

  clear(): PhoneVm {
    this.threads.clear();
    this.order = [];
    return this.build();
  }

  get view(): PhoneVm {
    return this.vm;
  }

  private build(): PhoneVm {
    const threads: PhoneThreadVm[] = this.order.map((from) => {
      const t = this.threads.get(from)!;
      // The name the latest message came under, in the language it was rendered in, like its lines.
      return { from, contact: t.messages[t.messages.length - 1]?.contact ?? contactName(from), messages: t.messages, unread: t.messages.length - t.read };
    });
    this.vm = { threads, unread: threads.reduce((n, t) => n + t.unread, 0) };
    return this.vm;
  }
}

/**
 * Renders a phone knot to lines with a runtime of its own (compiled on first use), so a text
 * never disturbs the conversation in progress or the ink state that goes into the save, and
 * any command the knot would send is dropped. A missing knot shows a short fallback, in the
 * language `locale` gives at that moment (ADR-0056).
 */
export const createKnotRenderer = (source: string | KnotLines, locale: () => Locale) => {
  const lines = typeof source === "string" ? createKnotLines(source, locale) : source;
  return (knot: string, domain: DomainState): PhoneLineVm[] => {
    const out = lines(knot, domain);
    return out && out.length > 0 ? out : [{ speaker: null, text: translate(locale(), "phone.newMessage") }];
  };
};

/** The lines of a knot, or null when there is no such knot (or ink fails on it). */
export type KnotLines = (knot: string, domain: DomainState) => PhoneLineVm[] | null;

/**
 * Renders knots to lines with a runtime of its own (compiled on first use), as the phone does:
 * the conversation in progress and the saved ink state are never touched, commands are dropped.
 * Shared by the phone, the metro ride and the radio (ADR-0035). The lines and the speakers' roles
 * come in the language `locale` gives when they are rendered (ADR-0056).
 */
export const createKnotLines = (source: string | StorySources, locale: () => Locale): KnotLines => {
  let runtime: NarrativeRuntime | null = null;
  return (knot, domain) => {
    try {
      runtime ??= new NarrativeRuntime(source, () => {}, { locale: locale(), text: narrativeText(locale) });
      runtime.setLanguage(locale());
      const view = runtime.start(knot, domain);
      runtime.interrupt();
      return view.lines.map((l) => ({ speaker: l.speaker, text: l.text }));
    } catch {
      // Unknown knot (content not written yet) or an ink error.
      return null;
    }
  };
};

/** Most numbered knots of one pool (`metro_ride_1`, `radio_koi_1`...) the app looks for. */
export const KNOT_POOL_LIMIT = 12;

/**
 * A numbered pool of knots, `<prefix>1` up to the first missing one: the content can grow
 * without the app knowing. `next()` walks through them in turn and gives null for an empty
 * pool, so a missing knot is simply skipped.
 */
export const createKnotPool = (lines: KnotLines, prefix: string, domain: () => DomainState) => {
  let size: number | null = null;
  let turn = 0;
  const count = (): number => {
    if (size !== null) return size;
    let n = 0;
    while (n < KNOT_POOL_LIMIT && lines(`${prefix}${n + 1}`, domain()) !== null) n++;
    size = n;
    return n;
  };
  return {
    get size(): number {
      return count();
    },
    next(): PhoneLineVm[] | null {
      const n = count();
      if (n === 0) return null;
      const knot = `${prefix}${(turn++ % n) + 1}`;
      const out = lines(knot, domain());
      return out && out.length > 0 ? out : null;
    },
  };
};

export type KnotPool = ReturnType<typeof createKnotPool>;
