import { useUi } from "../use-ui";

const ICON: Record<string, string> = { quest: "◆", memory: "◎", money: "€$", reputation: "▲", system: "■" };

export const Toasts = () => {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <span className="toast__icon">{ICON[t.kind]}</span>
          <div>
            <div className="toast__title">{t.title}</div>
            {t.text && <div className="toast__text">{t.text}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};
