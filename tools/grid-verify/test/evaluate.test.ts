import { describe, expect, it } from "vitest";
import { CHECKS } from "../src/checklist.ts";
import { type Declaration, type Report, fresh, splitNewPlaces, statusOf, summary, unsettled } from "../src/evaluate.ts";

const decl = (decyzje: Declaration["decyzje"] = {}): Declaration => ({ nazwa: "t", chunki: ["podzamcze-1-2", "podzamcze-2-2"], decyzje });
const auto = CHECKS.find((c) => c.id === "tablice")!;
const manual = CHECKS.find((c) => c.id === "kurator")!;

describe("the checklist of a new grid", () => {
  it("gives every point an id of its own and a phase, and a reason it is there", () => {
    expect(new Set(CHECKS.map((c) => c.id)).size).toBe(CHECKS.length);
    for (const c of CHECKS) expect(c.skad.length, c.id).toBeGreaterThan(0);
  });

  it("settles an automatic point by its run, a failed one only by a decision with a reference", () => {
    expect(statusOf(auto, true, decl())).toBe("ok");
    expect(statusOf(auto, false, decl())).toBe("blad");
    expect(statusOf(auto, false, decl({ tablice: { status: "przyjete", odnosnik: "G-999" } }))).toBe("przyjete");
    expect(statusOf(auto, false, decl({ tablice: { status: "przyjete", odnosnik: " " } }))).toBe("blad");
    expect(statusOf(auto, null, decl())).toBe("nie-uruchomione");
  });

  it("asks a decision for a point no command settles", () => {
    expect(statusOf(manual, null, decl())).toBe("do-zrobienia");
    expect(statusOf(manual, null, decl({ kurator: { status: "zrobione", odnosnik: "przegląd 23.11, T-340–T-343" } }))).toBe("zrobione");
  });

  it("splits the scan's new places into the grid's chunks and the rest", () => {
    const diff = [
      "steps-riser-norm: sum 29 -> 30, +1 new key(s)",
      "  + steps-riser-norm podzamcze-1-2 883,597: tread 0.50 m",
      "  - car-lane-off-road podzamcze-1-2 860..870,600..610",
      "  + kerb-gap-bare podzamcze-1-1 900..910,610..620: kerb gap",
      "  + seam-gap stare-miasto-0-0 10,20",
    ].join("\n");
    const { inside, outside } = splitNewPlaces(diff, decl().chunki);
    expect(inside).toEqual(["steps-riser-norm podzamcze-1-2 883,597: tread 0.50 m"]);
    expect(outside).toEqual(["kerb-gap-bare podzamcze-1-1 900..910,610..620: kerb gap", "seam-gap stare-miasto-0-0 10,20"]);
  });

  it("takes a report of another commit or tree for none, and names what is left", () => {
    const r: Report = { nazwa: "t", head: "abc", brudne: false, kiedy: "", punkty: [{ id: "a", faza: "dane", opis: "A", status: "ok" }, { id: "b", faza: "skan", opis: "B", status: "do-zrobienia" }] };
    expect(fresh(r, "abc", false)).toBe(true);
    expect(fresh(r, "abc", true)).toBe(false);
    expect(fresh(r, "abd", false)).toBe(false);
    expect(unsettled(r).map((p) => p.id)).toEqual(["b"]);
    expect(summary(r)).toContain("1 do rozstrzygnięcia");
  });
});
