import { useT } from "../i18n/use-t";
import { useSessionIntents, useUi } from "../use-ui";

export const SAVE_SLOTS = ["slot-1", "slot-2", "slot-3"] as const;

/** What persistence puts as the objective of an unreadable slot: a catalog key, said here. */
const CORRUPT_SLOT = "save.corrupt";

/** The slot the app autosaves to (only listed when loading: the player never saves into it). */
export const AUTOSAVE_SLOT = "auto";

const slotName = (slot: string, t: ReturnType<typeof useT>): string => {
  if (slot === AUTOSAVE_SLOT) return t("slots.auto");
  if (slot === "quick") return t("slots.quick");
  if (slot === "import") return t("slots.imported");
  return t("slots.slot", { n: slot.replace("slot-", "") });
};

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
        const exportable = mode === "load" && info !== undefined && info.objective !== CORRUPT_SLOT;
        return (
          <div key={slot} className="slots__row">
            <button type="button" className="slots__slot" disabled={disabled} onClick={() => (mode === "save" ? intents.save(slot) : intents.load(slot))}>
              <span className="slots__name">
                {slotName(slot, t)}
                {info?.difficulty && (
                  <span className="slots__difficulty" data-testid="slot-difficulty" aria-label={t("difficulty.slot", { preset: t(`difficulty.preset.${info.difficulty}`) })}>
                    {t(`difficulty.preset.${info.difficulty}`)}
                  </span>
                )}
              </span>
              <span className="slots__meta">{info ? `${info.savedAtLabel} · ${info.objective === CORRUPT_SLOT ? t(CORRUPT_SLOT) : info.objective}` : t("slots.empty")}</span>
            </button>
            {exportable && (
              <button type="button" className="slots__export" disabled={busy} aria-label={`${t("slots.export")}: ${slotName(slot, t)}`} onClick={() => intents.exportSave(slot)}>
                {t("slots.export")}
              </button>
            )}
          </div>
        );
      })}
      {mode === "load" && <ImportButton busy={busy} onText={(text) => intents.importSave(text)} />}
    </div>
  );
};

/** Picks a save file (an export) and hands its text over; the app checks it like any save. */
const ImportButton = ({ busy, onText }: { busy: boolean; onText: (text: string) => void }) => {
  const t = useT();
  const read = (file: File | undefined) => {
    if (!file) return;
    void file.text().then(onText);
  };
  return (
    <label className={`slots__import${busy ? " slots__import--busy" : ""}`}>
      <input type="file" accept=".json,application/json" disabled={busy} data-testid="save-import" onChange={(e) => read(e.currentTarget.files?.[0])} />
      {t("slots.import")}
    </label>
  );
};
