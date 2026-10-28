import { useEffect, useState } from "react";
import type { PhoneMessageVm, PhoneThreadVm } from "../store/hud-vm";
import { useIntents, useUi } from "../use-ui";

/** The phone key; kept out of the key bindings (menus.RESERVED_KEYS). */
export const PHONE_KEY = "KeyT";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

const Portrait = ({ name, big = false }: { name: string; big?: boolean }) => (
  <span className={`phone__portrait${big ? " phone__portrait--big" : ""}`} aria-hidden="true">
    {initials(name)}
  </span>
);

const firstLine = (m: PhoneMessageVm) => m.lines.find((l) => l.text)?.text ?? "";

/**
 * On top of the HUD: a holocall (story, interrupts anything) with the caller's portrait and the
 * caption, or one short notification at a time (contracts and news, only when it is quiet).
 */
export const PhoneNotice = ({ touch = false }: { touch?: boolean }) => {
  const notice = useUi((s) => s.phoneNotice);
  if (!notice) return null;
  const m = notice.message;
  if (notice.holocall) {
    return (
      <div className="holocall" data-testid="holocall" role="status" aria-live="assertive" key={m.id}>
        <Portrait name={m.contact} big />
        <div className="holocall__body">
          <div className="holocall__who">
            <span className="holocall__tag">{m.kind === "call" ? "Holorozmowa" : "Pilne"}</span> {m.contact}
          </div>
          {m.lines.map((l, i) => (
            <p key={i} className="holocall__line">
              {l.speaker && l.speaker !== m.contact && <b>{l.speaker}: </b>}
              {l.text}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={`phone-notice phone-notice--${m.priority}`} data-testid="phone-notice" role="status" aria-live="polite" key={m.id}>
      <span className="phone-notice__icon" aria-hidden="true">
        {m.kind === "call" ? "☏" : "✉"}
      </span>
      <div className="phone-notice__body">
        <div className="phone-notice__who">{m.contact}</div>
        <div className="phone-notice__text">{firstLine(m)}</div>
      </div>
      {!touch && <kbd className="phone-notice__key">T</kbd>}
    </div>
  );
};

const Thread = ({ thread }: { thread: PhoneThreadVm }) => (
  <div className="phone__thread" data-testid="phone-thread">
    <div className="phone__thread-head">
      <Portrait name={thread.contact} />
      <span>{thread.contact}</span>
    </div>
    <ol className="phone__messages">
      {thread.messages.map((m) => (
        <li key={m.id} className={`phone__message phone__message--${m.priority}`}>
          <span className="phone__time">
            {m.time} · {m.kind === "call" ? "rozmowa" : "SMS"}
          </span>
          {m.lines.map((l, i) => (
            <p key={i} className="phone__text">
              {l.speaker && l.speaker !== thread.contact && <b>{l.speaker}: </b>}
              {l.text}
            </p>
          ))}
        </li>
      ))}
    </ol>
  </div>
);

/**
 * The phone (T): an inbox with one thread per contact. Opening a thread marks it read. T or Esc
 * closes it. Not available in a conversation, a shop or a menu.
 */
export const PhonePanel = () => {
  const open = useUi((s) => s.phoneOpen);
  const phone = useUi((s) => s.phone);
  const blocked = useUi((s) => s.dialogue !== null || s.shopOpen || s.loot !== null || s.characterTab !== null || s.breach !== null);
  const intents = useIntents();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === PHONE_KEY && !e.repeat) {
        if (open) intents.closePhone();
        else if (!blocked) intents.openPhone();
      } else if (e.code === "Escape" && open) {
        e.preventDefault();
        intents.closePhone();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, blocked, intents]);

  const current = phone.threads.find((t) => t.from === selected) ?? phone.threads[0] ?? null;
  // The shown thread is read.
  const unreadShown = open && current !== null && current.unread > 0 ? current.from : null;
  useEffect(() => {
    if (unreadShown) intents.readThread(unreadShown);
  }, [unreadShown, intents]);

  if (!open) return null;
  return (
    <div className="phone" role="dialog" aria-label="Telefon" data-testid="phone">
      <header className="phone__bar">
        <span className="phone__title">Telefon</span>
        <button type="button" className="phone__close" aria-label="Zamknij telefon" onClick={() => intents.closePhone()}>
          ✕
        </button>
      </header>
      {phone.threads.length === 0 ? (
        <p className="phone__empty">Brak wiadomości.</p>
      ) : (
        <div className="phone__body">
          <ul className="phone__contacts" role="tablist" aria-label="Kontakty">
            {phone.threads.map((t) => (
              <li key={t.from}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={current?.from === t.from}
                  className={`phone__contact${current?.from === t.from ? " phone__contact--on" : ""}`}
                  onClick={() => setSelected(t.from)}
                >
                  <Portrait name={t.contact} />
                  <span className="phone__contact-name">{t.contact}</span>
                  {t.unread > 0 && (
                    <span className="phone__unread" aria-label={`Nieprzeczytane: ${t.unread}`}>
                      {t.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {current && <Thread thread={current} />}
        </div>
      )}
    </div>
  );
};
