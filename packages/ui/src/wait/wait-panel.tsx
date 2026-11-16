import { useEffect, useState } from "react";
import { useT } from "../i18n/use-t";
import type { WaitIntents } from "../intents";
import type { WaitVm } from "../store/wait-vm";
import { useUi, useWaitIntents } from "../use-ui";
import { WAIT_DEFAULT_HOURS, WAIT_MAX_HOURS, WAIT_MIN_HOURS, clampWaitHours, clockAt, waitEnd } from "./wait-end";
import "./wait.css";

const NO_CODES: readonly string[] = [];

/** The wait key from the bindings (settings, "Wait"): it opens the window and closes it again. */
const useWaitKey = (open: boolean, intents: WaitIntents) => {
  const codes = useUi((s) => s.controls.find((c) => c.action === "wait")?.codes ?? NO_CODES);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !codes.includes(e.code)) return;
      if (open) intents.closeWait();
      else intents.openWait();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [codes, open, intents]);
};

/** The open window's keys: arrows change the hours, Enter waits, Esc closes. */
const useWindowKeys = (open: boolean, hours: number, setHours: (h: number) => void, intents: WaitIntents) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const step = e.code === "ArrowRight" || e.code === "ArrowUp" ? 1 : e.code === "ArrowLeft" || e.code === "ArrowDown" ? -1 : 0;
      if (step !== 0) {
        // The slider under focus would move by itself as well: one step per press.
        e.preventDefault();
        setHours(clampWaitHours(hours + step));
      } else if (e.code === "Enter" || e.code === "NumpadEnter") {
        // A focused button would click on Enter too, and wait twice.
        e.preventDefault();
        intents.waitHours(hours);
      } else if (e.code === "Escape") {
        e.preventDefault();
        intents.closeWait();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hours, setHours, intents]);
};

const WaitWindow = ({ wait, hours, setHours, intents }: { wait: WaitVm; hours: number; setHours: (h: number) => void; intents: WaitIntents }) => {
  const t = useT();
  const now = clockAt(wait.clockSeconds);
  const end = waitEnd(wait.clockSeconds, hours);
  return (
    <div className="screen screen--wait" data-testid="wait-window" role="dialog" aria-modal="true" aria-labelledby="wait-heading">
      <div className="wait">
        <h2 id="wait-heading" className="wait__heading">
          {t("wait.heading")}
        </h2>
        <p className="wait__now">{t("wait.now", { time: now.time, day: now.day })}</p>
        <div className="wait__pick">
          <button type="button" className="wait__step" aria-label={t("wait.less")} disabled={hours <= WAIT_MIN_HOURS} onClick={() => setHours(clampWaitHours(hours - 1))}>
            −
          </button>
          <input
            className="wait__slider"
            type="range"
            min={WAIT_MIN_HOURS}
            max={WAIT_MAX_HOURS}
            step={1}
            value={hours}
            aria-label={t("wait.slider")}
            aria-valuetext={t("wait.hours", { count: hours })}
            onChange={(e) => setHours(clampWaitHours(Number(e.currentTarget.value)))}
          />
          <button type="button" className="wait__step" aria-label={t("wait.more")} disabled={hours >= WAIT_MAX_HOURS} onClick={() => setHours(clampWaitHours(hours + 1))}>
            +
          </button>
        </div>
        <p className="wait__hours" data-testid="wait-hours">
          {t("wait.hours", { count: hours })}
        </p>
        <p className="wait__until" data-testid="wait-until" aria-live="polite">
          {t("wait.until", { time: end.time, day: end.day })}
        </p>
        <div className="wait__actions">
          <button type="button" className="menu__item" onClick={() => intents.waitHours(hours)}>
            {t("wait.confirm")}
          </button>
          <button type="button" className="menu__item menu__item--ghost" onClick={() => intents.closeWait()}>
            {t("wait.cancel")}
          </button>
        </div>
        <p className="wait__keys">{t("wait.keys")}</p>
      </div>
    </div>
  );
};

/**
 * Waiting: a slider of whole hours (1 to 24) and the time it ends, "HH:MM, day N", past midnight
 * onto the next day. Opened from the pause menu or by the wait key; the clock stands while it is up.
 */
export const WaitPanel = () => {
  const wait = useUi((s) => s.wait);
  const intents = useWaitIntents();
  const [hours, setHours] = useState(WAIT_DEFAULT_HOURS);
  const open = wait !== null;
  useWaitKey(open, intents);
  useWindowKeys(open, hours, setHours, intents);
  // Every opening starts from the default.
  useEffect(() => {
    if (open) setHours(WAIT_DEFAULT_HOURS);
  }, [open]);
  if (!wait) return null;
  return <WaitWindow wait={wait} hours={hours} setHours={setHours} intents={intents} />;
};
