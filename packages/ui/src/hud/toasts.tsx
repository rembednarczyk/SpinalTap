import { useText } from "../i18n/use-t";
import { useUi } from "../use-ui";

const ICON: Record<string, string> = { quest: "◆", memory: "◎", money: "€$", reputation: "▲", system: "■", cyberware: "⌬" };

export const Toasts = () => {
  const toasts = useUi((s) => s.toasts);
  const text = useText();
  const talking = useUi((s) => s.dialogue !== null);
  // The contract card takes the middle of the screen (G-846): the column keeps its newest line.
  const briefing = useUi((s) => s.debrief !== null) && !talking;
  return (
    <div className={`toasts${talking ? " toasts--talk" : ""}${briefing ? " toasts--brief" : ""}`} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <span className="toast__icon">{ICON[t.kind]}</span>
          <div>
            <div className="toast__title">
              {text(t.title)}
              {(t.count ?? 1) > 1 && <span className="toast__count"> ×{t.count}</span>}
            </div>
            {t.text && <div className="toast__text">{text(t.text)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};
