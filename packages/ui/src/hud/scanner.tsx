import { type CSSProperties } from "react";
import { type HackTargetKind, QUICKHACKS, type QuickhackCategory, type QuickhackSlotInput, quickhacksFor } from "@seki/core";
import type { RamVm } from "../store/hud-vm";
import { useHackIntents, useUi } from "../use-ui";

/** The quickhacks a target kind takes, in the order of the number keys (shared with the sim). */
export { quickhacksFor };

const KIND_LABEL: Readonly<Record<HackTargetKind, string>> = { camera: "Kamera", device: "Urządzenie", person: "Osoba" };
const CATEGORY_LABEL: Readonly<Record<QuickhackCategory, string>> = { covert: "ukryty", control: "kontrola", combat: "bojowy" };

const RamBar = ({ ram }: { ram: RamVm }) => {
  const cells = Math.max(1, Math.round(ram.max));
  return (
    <div className="ram" data-testid="ram" aria-label={`RAM ${Math.floor(ram.current)} z ${ram.max}`}>
      <span className="ram__label">RAM</span>
      <span className="ram__cells">
        {Array.from({ length: cells }, (_, i) => (
          <span key={i} className={`ram__cell${i < Math.floor(ram.current) ? " ram__cell--on" : ""}`} />
        ))}
      </span>
      <span className="ram__value">
        {Math.floor(ram.current)}/{ram.max}
      </span>
    </div>
  );
};

/** Upload of the running quickhack: a bar that fills over its upload time. */
const UploadBar = () => {
  const upload = useUi((s) => s.upload);
  if (!upload) return null;
  const style = { "--upload": `${upload.seconds}s` } as CSSProperties;
  return (
    <div className="upload" data-testid="upload" style={style}>
      <span className="upload__label">Upload: {QUICKHACKS[upload.hackId].title}</span>
      <span className="upload__bar">
        <span key={upload.seq} className="upload__fill" />
      </span>
    </div>
  );
};

const ScanNote = () => {
  const note = useUi((s) => s.scanNote);
  if (!note) return null;
  const icon = note.tone === "traced" ? "⚠" : note.tone === "fail" ? "✗" : "✓";
  return (
    <div key={note.seq} className={`scan-note scan-note--${note.tone}`} data-testid="scan-note" role="status">
      <span aria-hidden="true">{icon}</span> {note.text}
    </div>
  );
};

/** The target card and the quickhack list; a tap on a row uploads it (touch). */
const ScanTarget = ({ touch }: { touch: boolean }) => {
  const target = useUi((s) => s.scanTarget);
  const ram = useUi((s) => s.ram);
  const intents = useHackIntents();
  if (!target) return <div className="scan-card scan-card--empty">Brak celu w polu skanu</div>;
  const hacks = quickhacksFor(target.kind);
  return (
    <div className={`scan-card${target.hostile ? " scan-card--hostile" : ""}`} data-testid="scan-card">
      <div className="scan-card__kind">
        <span aria-hidden="true">{target.hostile ? "▲" : "●"}</span> {KIND_LABEL[target.kind]}
      </div>
      <div className="scan-card__name">{target.name}</div>
      {target.faction && <div className="scan-card__faction">{target.faction}</div>}
      {target.profile && (
        <ul className="scan-card__profile">
          {target.profile.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <ol className="hacks" aria-label="Quickhacki">
        {hacks.map((id, i) => {
          const def = QUICKHACKS[id];
          const short = ram.current < def.ram;
          const slot = (i + 1) as Exclude<QuickhackSlotInput, 0>;
          const body = (
            <>
              <kbd className="hacks__key">{slot}</kbd>
              <span className="hacks__title">{def.title}</span>
              <span className="hacks__cat">{CATEGORY_LABEL[def.category]}</span>
              <span className="hacks__ram">{def.ram} RAM</span>
            </>
          );
          return (
            <li key={id} className={`hacks__row hacks__row--${def.category}${short ? " hacks__row--short" : ""}`} data-testid={`hack-${id}`}>
              {touch ? (
                <button type="button" className="hacks__btn" disabled={short} aria-label={`${def.title}, ${def.ram} RAM`} onClick={() => intents.pickQuickhack(slot)}>
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/**
 * Scanner mode (ADR-0028), in the frame of the Kiroshi optics: corner brackets, the target
 * card with its quickhacks and the RAM bar. The upload bar and the result notes stay after the
 * scanner is let go.
 */
export const ScannerHud = ({ touch = false }: { touch?: boolean }) => {
  const scanning = useUi((s) => s.scanning);
  const uploading = useUi((s) => s.upload !== null);
  const ram = useUi((s) => s.ram);
  return (
    <>
      {scanning && (
        <div className="scanner" data-testid="scanner">
          <div className="scanner__frame" aria-hidden="true">
            <span className="scanner__corner scanner__corner--tl" />
            <span className="scanner__corner scanner__corner--tr" />
            <span className="scanner__corner scanner__corner--bl" />
            <span className="scanner__corner scanner__corner--br" />
            <span className="scanner__brand">KIROSHI · SKAN</span>
          </div>
          <div className="scanner__panel">
            <ScanTarget touch={touch} />
          </div>
        </div>
      )}
      <div className="scanner__status">
        {(scanning || uploading) && <RamBar ram={ram} />}
        <UploadBar />
        <ScanNote />
      </div>
    </>
  );
};
