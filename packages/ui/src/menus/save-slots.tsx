import { useT } from "../i18n/use-t";
import { useSessionIntents, useUi } from "../use-ui";

export const SAVE_SLOTS = ["slot-1", "slot-2", "slot-3"] as const;

export const SaveSlots = ({ mode }: { mode: "save" | "load" }) => {
  const slots = useUi((s) => s.slots);
  const busy = useUi((s) => s.busy);
  const intents = useSessionIntents();
  const t = useT();
  const names = mode === "load" ? [...new Set([...slots.map((s) => s.slot), ...SAVE_SLOTS])].sort() : SAVE_SLOTS;
  return (
    <div className="slots">
      {names.map((slot) => {
        const info = slots.find((s) => s.slot === slot);
        const disabled = busy || (mode === "load" && !info);
        return (
          <button
            key={slot}
            type="button"
            className="slots__slot"
            disabled={disabled}
            onClick={() => (mode === "save" ? intents.save(slot) : intents.load(slot))}
          >
            <span className="slots__name">{slot === "quick" ? t("slots.quick") : t("slots.slot", { n: slot.replace("slot-", "") })}</span>
            <span className="slots__meta">{info ? `${info.savedAtLabel} · ${info.objective}` : t("slots.empty")}</span>
          </button>
        );
      })}
    </div>
  );
};
