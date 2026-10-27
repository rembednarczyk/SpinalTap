# Miasto: budynki, auta i rekwizyty ulicy (ADR-0022)

`city-kit.glb` to jeden plik z modelami z darmowych paczek **CC0**, przemalowanymi na nocne
Shinsekai (ciemny beton, teal, magenta, świecące okna i neony). Licencja CC0: wolno używać,
zmieniać i rozpowszechniać, także komercyjnie, bez atrybucji (autorom i tak dziękujemy).

| Klucze w pliku | Źródło | Autor | Licencja |
|---|---|---|---|
| `kc-a` … `kc-m`, `kc-sa` … `kc-se` (kamienice, sklepy, wieżowce) | [City Kit Commercial 2.1](https://kenney.nl/assets/city-kit-commercial), `building-a…m`, `building-skyscraper-a…e` | Kenney | CC0 |
| `car-van`, `car-delivery`, `car-sedan`, `car-taxi`, `car-hatchback`, `car-wreck` | [Car Kit 3.1](https://kenney.nl/assets/car-kit), `van`, `delivery`, `sedan`, `taxi`, `hatchback-sports` | Kenney | CC0 |
| `dumpster` | [City Kit Roads](https://kenney.nl/assets/city-kit-roads), `dumpster` | Kenney | CC0 |
| `nt-bar`, `nt-store`, `nt-pharmacy`, `nt-bank` (witryny z neonami) | [Neon Town](https://opengameart.org/content/neon-town), `bar`, `store`, `pharmacy`, `bank` | leonkin | CC0 |

Zmiany względem oryginałów (narzędzie `tools/city_kit.py`):
- kolory z palety Kenneya (`colormap.png`) i z materiałów Neon Town są przypisane do ról
  (ściana, gzyms, okno, markiza, neon…) i przemalowane na wspólną paletę próbek; okna świecą albo
  nie, losowo per szyba (stałe ziarno), ściany i lakier aut barwi renderer per budynek;
- modele obrócone frontem do +Z, wyśrodkowane, w metrach (Kenney ×8: piętro 3,2 m);
- jedna siatka na model, wierzchołki sklejone, normalne i UV skwantowane (`KHR_mesh_quantization`).

Napisy na szyldach (BAR, RAMEN, KARAOKE…) rysuje gra; to zmyślone lokale, bez prawdziwych marek.
Z Neon Town nie bierzemy billboardu (napis „OpenGameArt”).

Odtworzenie pliku (paczki rozpakowane, każda do osobnego katalogu):

```
python3 -I tools/city_kit.py \
  --commercial kenney_city-kit-commercial_2.1/Models/GLB\ format \
  --cars kenney_car-kit/Models/GLB\ format \
  --roads kenney_city-kit-roads/Models/GLB\ format \
  --neontown NeonTown/GLTF --out packages/app/public/city
```

Pobranie: `https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip`,
`https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip`,
`https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1791628607/kenney_city-kit-roads.zip`,
`https://opengameart.org/sites/default/files/NeonTown.zip` (szczegóły: `docs/assets-research.md`).

Wyłączenie w grze: `?city=off` (zostają gołe bryły).
