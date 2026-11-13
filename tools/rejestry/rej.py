#!/usr/bin/env python3
"""Rejestry glitchy, topografii i backlogu bez skryptów pisanych od nowa (backlog 13.11, punkt 1).

Uruchamiaj z katalogu repozytorium: `python3 -I tools/rejestry/rej.py <polecenie> ...`.
Numery nadaje narzędzie (najwyższy w rejestrze i archiwum + 1), więc kolizje typu G-720 / T-283 nie
powstają. Każde polecenie zmienia tylko swój wpis i drukuje jedną linię wyniku.

  g-new TYTUŁ --waznosc S3 --zasieg ... --opis ... --status ... --pakiet ... [--test ...]
  g-status G-NNN NOWY             status: „NOWY; wcześniej: <stary>”
  g-note G-NNN TEKST              dopisek „- TEKST” na końcu wpisu
  g-archive G-NNN PR              przenosi wpis do archiwum, status „naprawione (data, PR scalony)”
  t-new KOMÓRKA... (5 komórek po numerze: gdzie | w grze | w Lublinie | rodzaj | status)
  t-append T-NNN TEKST            dopisek na końcu ostatniej komórki wiersza
  b-append ZNACZNIK TEKST         dopisek na końcu pozycji backlogu zawierającej ZNACZNIK
  replace PLIK STARY NOWY         jedna dokładna zamiana (musi wystąpić dokładnie raz)
"""
import argparse
import datetime
import re
import sys

GLITCHES = "docs/glitches.md"
ARCHIVE = "docs/glitches-archiwum.md"
TOPO = "docs/topografia.md"
BACKLOG = "docs/backlog.md"
NEW_BEFORE = "### G-132 Smoke"


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(path, text):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def today():
    d = datetime.date.today()
    return f"{d.day}.{d.month:02d}"


def entry(text, gid):
    m = re.search(r"^### " + re.escape(gid) + r" [^\n]*\n(?:[^\n]+\n)*\n?", text, re.M)
    if not m:
        sys.exit(f"brak wpisu {gid}")
    return m


def next_number(prefix, *texts):
    nums = [int(n) for t in texts for n in re.findall(r"\b" + prefix + r"-(\d{3})\b", t)]
    return f"{prefix}-{max(nums) + 1:03d}"


def g_new(a):
    g, arch = read(GLITCHES), read(ARCHIVE)
    gid = next_number("G", g, arch)
    lines = [f"### {gid} {a.tytul}", f"- Ważność: {a.waznosc} · Zasięg: {a.zasieg}", f"- Opis: {a.opis}", f"- Status: {a.status}", f"- Pakiet właściciela: {a.pakiet}"]
    if a.test:
        lines.append(f"- Test przyjęcia: {a.test}")
    if NEW_BEFORE not in g:
        sys.exit(f"brak znacznika {NEW_BEFORE}")
    write(GLITCHES, g.replace(NEW_BEFORE, "\n".join(lines) + "\n\n" + NEW_BEFORE, 1))
    print(gid)


def g_status(a):
    g = read(GLITCHES)
    m = entry(g, a.gid)
    block = m.group(0)
    s = re.search(r"^- Status: ([^\n]*)$", block, re.M)
    if not s:
        sys.exit(f"{a.gid}: brak linii Status")
    new = block[: s.start()] + f"- Status: {a.nowy}; wcześniej: {s.group(1)}" + block[s.end() :]
    write(GLITCHES, g[: m.start()] + new + g[m.end() :])
    print(f"{a.gid} status")


def g_note(a):
    g = read(GLITCHES)
    m = entry(g, a.gid)
    block = m.group(0).rstrip("\n") + f"\n- {a.tekst}\n" + ("\n" if m.group(0).endswith("\n\n") else "")
    write(GLITCHES, g[: m.start()] + block + g[m.end() :])
    print(f"{a.gid} dopisek")


def g_archive(a):
    g, arch = read(GLITCHES), read(ARCHIVE)
    m = entry(g, a.gid)
    block = m.group(0).replace("- Status: ", f"- Status: naprawione ({today()}, {a.pr} scalony); wcześniej: ", 1).rstrip("\n") + "\n\n"
    i = arch.index("### G-")
    write(ARCHIVE, arch[:i] + block + arch[i:])
    write(GLITCHES, g[: m.start()] + g[m.end() :])
    print(f"{a.gid} → archiwum")


def t_new(a):
    if len(a.komorki) != 5:
        sys.exit("t-new: 5 komórek (gdzie | w grze | w Lublinie | rodzaj | status)")
    t = read(TOPO)
    tid = next_number("T", t)
    lines = t.split("\n")
    last = max(k for k, l in enumerate(lines) if re.match(r"^\| T-\d{3} \|", l))
    lines.insert(last + 1, f"| {tid} | " + " | ".join(a.komorki) + " |")
    write(TOPO, "\n".join(lines))
    print(tid)


def t_append(a):
    lines = read(TOPO).split("\n")
    hits = [k for k, l in enumerate(lines) if l.startswith(f"| {a.tid} |")]
    if len(hits) != 1:
        sys.exit(f"{a.tid}: {len(hits)} wierszy")
    k = hits[0]
    lines[k] = lines[k].rstrip()[:-1].rstrip() + f" {a.tekst} |"
    write(TOPO, "\n".join(lines))
    print(f"{a.tid} dopisek")


def b_append(a):
    lines = read(BACKLOG).split("\n")
    hits = [k for k, l in enumerate(lines) if l.startswith("- ") and a.znacznik in l]
    if len(hits) != 1:
        sys.exit(f"backlog: {len(hits)} pozycji z „{a.znacznik}”")
    lines[hits[0]] = lines[hits[0]].rstrip() + " " + a.tekst
    write(BACKLOG, "\n".join(lines))
    print("backlog dopisek")


def replace(a):
    t = read(a.plik)
    n = t.count(a.stary)
    if n != 1:
        sys.exit(f"{a.plik}: {n} wystąpień")
    write(a.plik, t.replace(a.stary, a.nowy, 1))
    print(f"{a.plik} zamiana")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("g-new")
    s.add_argument("tytul")
    for f in ("waznosc", "zasieg", "opis", "status", "pakiet"):
        s.add_argument("--" + f, required=True)
    s.add_argument("--test")
    s.set_defaults(fn=g_new)
    s = sub.add_parser("g-status")
    s.add_argument("gid")
    s.add_argument("nowy")
    s.set_defaults(fn=g_status)
    s = sub.add_parser("g-note")
    s.add_argument("gid")
    s.add_argument("tekst")
    s.set_defaults(fn=g_note)
    s = sub.add_parser("g-archive")
    s.add_argument("gid")
    s.add_argument("pr")
    s.set_defaults(fn=g_archive)
    s = sub.add_parser("t-new")
    s.add_argument("komorki", nargs="+")
    s.set_defaults(fn=t_new)
    s = sub.add_parser("t-append")
    s.add_argument("tid")
    s.add_argument("tekst")
    s.set_defaults(fn=t_append)
    s = sub.add_parser("b-append")
    s.add_argument("znacznik")
    s.add_argument("tekst")
    s.set_defaults(fn=b_append)
    s = sub.add_parser("replace")
    s.add_argument("plik")
    s.add_argument("stary")
    s.add_argument("nowy")
    s.set_defaults(fn=replace)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
