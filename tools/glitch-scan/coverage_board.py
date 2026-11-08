"""Plansza pokrycia przeglądów mapy (docs/mapa-pokrycie.md).

Rysuje komórki rejestru w kolorach statusów, z liczbą trafień skanu, otwartych wierszy T
i najczęstszym rodzajem glitcha. Czyta `reports/map-coverage.json` z
`node tools/glitch-scan/src/coverage-report.ts`.

    python3 -I tools/glitch-scan/coverage_board.py reports/map-coverage.json plansza.png
"""

import json
import sys

from PIL import Image, ImageDraw, ImageFont

# Status jako stan (paleta statusów: od krytycznego do dobrego); kolor nigdy sam: etykieta w komórce.
STATUS_COLOURS = {
    "nieprzejrzane": "#d03b3b",
    "przejrzane": "#ec835a",
    "poprawione": "#fab219",
    "czyste": "#0ca30c",
}
INK = {"nieprzejrzane": "#ffffff", "przejrzane": "#0b0b0b", "poprawione": "#0b0b0b", "czyste": "#ffffff"}
SURFACE = "#fafaf7"
TEXT = "#0b0b0b"
MUTED = "#5f5e57"
SCALE = 1.2  # px na metr
# Nabrzeże leży ok. 1,2 km na wschód od Podzamcza: przesunięte na planszy, z przerwą zaznaczoną linią.
EAST_FROM = 2000
EAST_SHIFT = -1100
MARGIN = 40
TOP = 90


def font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    try:
        return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}", size)
    except OSError:
        return ImageFont.load_default()


def board(data, out):
    cells = data["register"]["komorki"]
    hits = data["hits"]["cells"]
    shift = lambda x: x + EAST_SHIFT if x >= EAST_FROM else x
    min_x = min(shift(c["bounds"]["minX"]) for c in cells)
    max_x = max(shift(c["bounds"]["maxX"]) for c in cells)
    min_z = min(c["bounds"]["minZ"] for c in cells)
    max_z = max(c["bounds"]["maxZ"] for c in cells)
    width = int((max_x - min_x) * SCALE) + 2 * MARGIN
    height = int((max_z - min_z) * SCALE) + TOP + MARGIN + 60
    img = Image.new("RGB", (width, height), SURFACE)
    draw = ImageDraw.Draw(img)
    px = lambda x, z: (MARGIN + (shift(x) - min_x) * SCALE, TOP + (z - min_z) * SCALE)
    summary = data["summary"]
    draw.text((MARGIN, 18), f"Pokrycie przeglądów mapy: {summary['cells']} komórek (chunki importu)", fill=TEXT, font=font(22, True))
    city = summary["city"]
    draw.text((MARGIN, 50), "miasto: " + ", ".join(f"{k} {v:.0f}%" for k, v in city.items()) + "   |   trafienie = rodzaj glitcha w kwadracie 10 × 10 m", fill=MUTED, font=font(14))
    queue = {q["id"]: k + 1 for k, q in enumerate(summary["queue"])}
    for c in cells:
        b = c["bounds"]
        x0, z0 = px(b["minX"], b["minZ"])
        x1, z1 = px(b["maxX"], b["maxZ"])
        draw.rectangle([x0 + 1, z0 + 1, x1 - 1, z1 - 1], fill=STATUS_COLOURS[c["status"]], outline=SURFACE, width=2)
        ink = INK[c["status"]]
        h = hits.get(c["id"], {"hits": 0, "findings": 0, "kinds": {}})
        top = sorted(h["kinds"].items(), key=lambda kv: (-kv[1], kv[0]))[:2]
        lines = [
            (c["id"], font(14, True)),
            (c["status"], font(12)),
            (f"trafienia {h['hits']}", font(20, True)),
            (f"znaleziska {h['findings']}", font(12)),
            (f"otwarte T {len(c['wierszeT']['otwarte'])}", font(12)),
            *((f"{k} {n}", font(11)) for k, n in top),
        ]
        y = z0 + 8
        for text, f in lines:
            while draw.textlength(text, font=f) > x1 - x0 - 16 and len(text) > 4:
                text = text[:-2] + "…"
            draw.text((x0 + 8, y), text, fill=ink, font=f)
            y += f.size + 4
        if c["id"] in queue:
            draw.text((x0 + 8, z1 - 30), f"kolejka #{queue[c['id']]}", fill=ink, font=font(16, True))
    # Przerwa między Podzamczem a Nabrzeżem.
    west = max(c["bounds"]["maxX"] for c in cells if c["bounds"]["maxX"] < EAST_FROM)
    east = min(shift(c["bounds"]["minX"]) for c in cells if c["bounds"]["minX"] >= EAST_FROM)
    gap_x = MARGIN + ((west + east) / 2 - min_x) * SCALE
    draw.line([gap_x, TOP, gap_x, height - MARGIN - 60], fill=MUTED, width=1)
    draw.text((gap_x - 60, height - MARGIN - 56), "przerwa ok. 1,2 km", fill=MUTED, font=font(11))
    # Legenda: kolor i nazwa razem; numer #k to miejsce w kolejce opiekuna.
    lx = MARGIN
    ly = height - MARGIN - 20
    for status, colour in STATUS_COLOURS.items():
        draw.rectangle([lx, ly, lx + 16, ly + 16], fill=colour)
        draw.text((lx + 22, ly), status, fill=TEXT, font=font(13))
        lx += 22 + int(draw.textlength(status, font=font(13))) + 24
    draw.text((lx + 10, ly), "kolejka #k = miejsce w kolejce opiekuna mapy", fill=MUTED, font=font(13))
    img.save(out)


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf8") as f:
        board(json.load(f), sys.argv[2])
