# Research: darmowe assety dla Seki Senshi

Stan na: 2026-10-26. Cel: zastąpić proceduralne prymitywy i syntezowany WebAudio prawdziwymi assetami
o licencji pozwalającej trzymać je w **publicznym repozytorium git** i używać komercyjnie.
Preferowane CC0. Formaty: GLB/glTF > FBX/OBJ (konwersja w Blenderze).

Legenda werdyktu: **use** (bierzemy), **maybe** (warunkowo / do części zadań), **avoid** (licencja lub styl wykluczają).
Kolumna "Pobranie": **direct** = stały URL do .zip/.glb/.ogg (da się skryptem w `tools/`),
**itch** = strona itch.io "name your own price" (wpisać 0, klik), **gdrive** = folder Google Drive (ręcznie),
**login** = wymaga konta.

Ważna obserwacja techniczna: nasz `ShaderMaterial` (`packages/engine/src/npr/toon-material.ts`) ma dziś tylko
atrybuty `position` + `normal` i kolor bazowy per materiał. Najlepiej pasują więc paczki z **płaskimi kolorami
per materiał** (starsze Quaternius, Neon Town). Kenney i KayKit używają **jednej tekstury-palety** (`colormap.png`,
UV wskazuje komórkę koloru), więc wymagają albo samplera w shaderze, albo wypieczenia palety do koloru wierzchołka
(szczegóły w sekcji Integracja). Postacie z animacją wymagają dodania skinningu do shadera.

---

## 1. Postacie

| Nazwa | Autor | Licencja | Zawartość | Formaty | Styl / fit pod cel-shading | Pobranie | Werdykt |
|---|---|---|---|---|---|---|---|
| [Ultimate Modular Women](https://quaternius.com/packs/ultimatemodularwomen.html) | Quaternius | CC0 | 10 postaci, każda z 4 wymiennych części (głowa/tors/nogi/stopy), 24 animacje, wersja z rigiem humanoid | FBX, OBJ, glTF, Blend | Low-poly, płaskie kolory per materiał, bez tekstur. Idealne pod nasz shader. Na podglądzie: postać sci-fi w kombinezonie z pistoletem i krótkimi ciemnymi włosami (baza bohaterki), kobieta w garniturze (fixerka), punk, robotnica, casual | gdrive ([folder](https://drive.google.com/drive/folders/1720N9IGyQHXYvtvZJzazhxtTTlz-y2Vf)) | **use**: najlepsza baza na bohaterkę i NPC |
| [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) | Quaternius | CC0 | 11 postaci, 4 wymienne części, 24 animacje | FBX, OBJ, glTF, Blend | Jak wyżej. Na podglądzie: garnitur (fixer), SWAT (ochrona korpo), punk z irokezem, casual, postać w masce konia (dobry punkt wyjścia na maski gangu Hebi po przemalowaniu) | gdrive ([folder](https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX)) | **use**: gangerzy, fixer, ripperdoc (przemalowany "suit"/"worker") |
| [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) ([itch](https://quaternius.itch.io/universal-animation-library)) | Quaternius | CC0 | Wersja Standard za darmo: 45 animacji (całość 120+: lokomocja 8 kierunków, sprint, śmierć, walka, broń palna, emotki). Pro 9,99 USD, Source 14,99 USD | FBX, GLB (Pro), Blend (Source) | Rig "universal humanoid", do retargetu | itch | **use**: dodatkowe klipy (śmierć, trafienie, celowanie), jeśli 24 animacje z modular nie wystarczą |
| [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations) | Kay Lousberg | CC0 | 161 animacji humanoidalnych, w tym strzelanie/celowanie/przeładowanie broni jedno- i dwuręcznej | FBX, glTF | Rig KayKit (Rig_Medium), na innych postaciach wymaga retargetu | itch | **maybe**: najbogatszy darmowy zestaw "shooter", ale inny rig niż Quaternius |
| [Universal Base Characters](https://quaternius.itch.io/universal-base-characters) | Quaternius | CC0 | Darmowo: 2 bazy (M/K) + 5 fryzur. Pełne (19,99 USD): 6 baz, 20 fryzur | FBX, glTF | ~13k tris, bardziej realistyczne proporcje, bez ubrań (bielizna) | itch | **maybe**: ładniejsza topologia, ale trzeba samemu modelować płaszcz i ubrania |
| [VRoid Studio CC0 models](https://opengameart.org/content/vroid-studio-cc0-models) (mirror) | pixiv / VRoid (upload: OGA) | CC0 wg uploadera i [strony pomocy pixiv](https://vroid.pixiv.help/hc/en-us/articles/4402614652569-Do-VRoid-Studio-s-sample-models-come-with-conditions-of-use) (strona zwraca 403 dla naszego fetchera, **niezweryfikowane u źródła**) | AvatarSample D, D_Darkness, E, F, G, bazy M/K, próbki włosów, Sakurada Fumiriya, Sendagaya Shino. **AvatarSample A-C wyłączone** (bardziej restrykcyjne warunki) | VRM 0.x (= glTF binary, można zmienić rozszerzenie na .glb) | Prawdziwy styl anime, ale ciężkie (11-17 MB zip), tekstury MToon, rig humanoid VRM | direct (np. `https://opengameart.org/sites/default/files/avatarsample_e.zip`) | **maybe**: jedyna opcja "prawdziwe anime" na CC0; przed użyciem potwierdzić licencję na stronie pixiv. To postacie-maskotki pixiv, więc lepiej jako baza do przerobienia niż 1:1 |
| [100Avatars R1-R3](https://github.com/ToxSam/open-source-avatars) | Polygonal Mind | CC0 (wg `data/projects.json` rejestru) | 300 awatarów (np. Olivia, Kate, Erika, Lydia, OldMoustache, Mafiossini, Cyberpal), każdy jako VRM + FBX | VRM, FBX (Arweave) | Low-poly, tekstura-paleta, styl "cartoon/memiczny", wiele postaci-żartów (warzywa, przedmioty) | direct (URL-e Arweave w `data/avatars/100avatars-r*.json`) | **maybe**: tło/tłum, nie główne postacie |
| Mixamo (Adobe) | Adobe | Własna licencja Adobe: użycie w grze OK, ale **zakaz dystrybucji surowych plików postaci i animacji** ([FAQ](https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/m-p/13234775)), zakaz treningu ML | Postacie + tysiące animacji | FBX | Rig Mixamo | login (Adobe ID) | **avoid**: publiczne repo = dystrybucja surowych plików |
| VRoid Hub (modele innych twórców), postacie VTuberów | różni | Warunki per model, zwykle zakaz redystrybucji | | VRM | | login | **avoid**: licencje per model, często postacie znanych VTuberów (wizerunek/marka) |
| Kenney [Animated Characters](https://kenney.nl/assets/animated-characters-protagonists) | Kenney | CC0 | Proste postacie "blokowe" z kilkoma animacjami | FBX/GLB | Bardzo uproszczone, odstaje od stylu GitS | direct | **avoid** (styl) |

Uwagi:
- Quaternius modular: 24 animacje to standardowy zestaw autora (idle, walk, run, strzał z broni, trafienie, śmierć, cios itd.). Dokładną listę klipów sprawdzić po pobraniu.
- Babcia z parasolem: casual z Modular Women + parasol jako prosty prop (proceduralnie lub z CC0 propsów); gotowego CC0 modelu nie znalazłem.
- Bohaterka "anime": realna ścieżka bez ryzyka licencyjnego to własny model z VRoid Studio (eksport VRM) albo Quaternius Sci-Fi Woman przemalowana (płaszcz trzeba domodelować). Presety w VRoid Studio mają własne warunki (gotowe itemy z BOOTH często zabraniają publicznej redystrybucji), więc używać tylko domyślnych presetów pixiv i sprawdzić ich warunki.

## 2. Środowisko / miasto

| Nazwa | Autor | Licencja | Zawartość | Formaty | Styl / fit | Pobranie | Werdykt |
|---|---|---|---|---|---|---|---|
| [Neon Town](https://opengameart.org/content/neon-town) | leonkin | CC0 | Fragment miasta nocą: bank, bar, apteka, restauracja, sklep, billboard, samochód, radiowóz, taxi, latarnia, sygnalizator, kontener na śmieci, płot, stół, krzesło, ground | .blend + każdy obiekt jako .glb | Sprawdzone: płaskie kolory + materiały emisyjne (neony), 78-2000 tris na obiekt. Wygląda jak nasz docelowy klimat (neon "BAR" ze strzałką) | direct (`https://opengameart.org/sites/default/files/NeonTown.zip`, 5,9 MB) | **use**: najlepszy fit stylu, gotowe neony |
| [Cyberpunk Game Kit](https://quaternius.com/packs/cyberpunkgamekit.html) | Quaternius | CC0 | 71 modeli: postać animowana, wrogowie (roboty), moduły platform, wieżyczki, klimatyzatory, anteny satelitarne, rury, skrzynie, latarnie, szyldy (m.in. z japońskimi znakami) | FBX, OBJ, glTF, Blend | Płaskie kolory, sci-fi industrial. Propsy idealne do zaułków | gdrive ([folder](https://drive.google.com/drive/folders/1GyKLypoBxrpLN6GERF9U610Wiub48v9y)) | **use**: propsy do zaułków i dachów (AC, rury, szyldy, skrzynie) |
| [Downtown City MegaKit](https://quaternius.com/packs/downtowncitymegakit.html) ([itch](https://quaternius.itch.io/downtown-city-megakit)) | Quaternius | CC0 | Maj 2026. Modułowe kamienice w stylu Boston/NYC, ulice, schody przeciwpożarowe, 7 gotowych budynków. Standard darmowy (~153 assety), Source 14,99 USD | FBX, OBJ, glTF | Wspólne zestawy tekstur (trim sheets), półrealistyczne. Trzeba sampler tekstury lub przemapowanie | itch | **maybe**: najlepsze darmowe modułowe budynki, ale teksturowane |
| [City Kit Roads](https://kenney.nl/assets/city-kit-roads) | Kenney | CC0 | 98 modeli: odcinki dróg, chodniki, skrzyżowania, latarnie, sygnalizatory, **dumpster**, słupy energetyczne, przewody, znaki, pachołki | GLB, FBX, OBJ | Low-poly, tekstura-paleta `colormap.png` (zewnętrzny plik, nie osadzony w GLB) | direct (`https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1791628607/kenney_city-kit-roads.zip`) | **use**: ulica, chodniki, latarnie, dumpstery, kable |
| [Car Kit 3.1](https://kenney.nl/assets/car-kit) | Kenney | CC0 | 53 modele: sedan, hatchback, SUV, **van**, **delivery**, taxi, police, ambulance, garbage-truck, truck, pachołki, debris | GLB, FBX, OBJ | ~2k tris/pojazd, tekstura-paleta | direct (`https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip`) | **use**: zaparkowane auta i vany |
| [City Kit Commercial 2.1](https://kenney.nl/assets/city-kit-commercial) | Kenney | CC0 | 44 modele: 14 budynków, 5 wieżowców, markizy, daszki, **14 wersji low-detail** | GLB, FBX, OBJ | ~1,2k tris, tekstura-paleta, kolorowy "cartoon" | direct (`https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip`) | **maybe**: sylwetki wieżowców w tle (low-detail) po przemalowaniu na teal/szary |
| [KayKit City Builder Bits](https://kaylousberg.itch.io/city-builder-bits) | Kay Lousberg | CC0 | 32+ modeli darmowo: budynki, drogi, auta, elementy ulicy | OBJ, FBX, glTF | Tekstura gradient atlas 1024², styl "zabawkowy" | itch | **maybe**: alternatywa dla Kenney, styl mniej pasuje |
| [Cyber City](https://papptimus.itch.io/cyber-city) | papptimus | **CC-BY 4.0** (atrybucja wymagana, autor nie podał formuły; użyć "Cyber City by papptimus, CC BY 4.0") | 4 budynki + 16 modułów, 10 tekstur budynków z emisją (pixel-art) | FBX, PNG | Low-poly cyberpunk, ale pixel-art tekstury | itch (530 kB) | **maybe**: dobry klimat, ale atrybucja i tekstury |
| [Simple 3D Neon Building](https://opengameart.org/content/simple-3d-neon-building) | Eon Cire | CC0 | 1 budynek z neonami; glow tylko jako cząsteczki w prefabie Unity | FBX, Blend, unitypackage | Prosty | direct | **maybe**: tylko geometria budynku, neony trzeba odtworzyć |
| Poly Haven modele: `street_lamp_01/02`, `fire_hydrant`, `utility_box_01/02`, `power_box_01`, `plastic_crate_01-03`, `cardboard_box_01`, `barrel_03`, `medical_box`, `metal_toolbox`, `industrial_wall_lamp` ([API listy](https://api.polyhaven.com/assets?t=models)) | Poly Haven | CC0 | Pojedyncze fotoskanowe propsy | glTF + tekstury PBR | Realistyczne, wysoki poly, PBR | direct (API) | **maybe**: tylko jeśli zabraknie propsów; odbiegają od stylu |

Szyldy neonowe: poza Neon Town nie znalazłem dobrego CC0 zestawu. [Sci-Fi Signs Pack](https://siris-pendrake.itch.io/sci-fi-signs-pack) jest płatny (3 USD, licencja royalty-free, nie CC0). Rekomendacja: robić szyldy sami (emisyjne płaszczyzny/krzywe + tekst z naszych fontów i własnych kanji), bez nazw prawdziwych marek. Przy okazji: **avoid** dla wszystkiego, co kopiuje branding Cyberpunk 2077 (logo Arasaka, Militech, NCPD), Ghost in the Shell (Section 9, logo Hanka) czy Blade Runnera; na itch/Sketchfab jest sporo takich "fan assetów".

## 3. Broń

| Nazwa | Autor | Licencja | Zawartość | Formaty | Styl / fit | Pobranie | Werdykt |
|---|---|---|---|---|---|---|---|
| [Ultimate Gun Pack / Low Poly Guns Pack](https://opengameart.org/content/low-poly-guns-pack) (też [quaternius.com](https://quaternius.com/packs/ultimategun.html)) | Quaternius | CC0 | Sprawdzone w zipie: `Pistol_1..6`, `SubmachineGun_1..5`, `Revolver_1..5`, AssaultRifle, Bullpup, Shotgun, Sniper + akcesoria (tłumiki, celowniki, latarka, chwyt) | FBX, OBJ, Blend (bez glTF, konwersja w Blenderze) | Low-poly, bez tekstur (płaskie kolory). Idealne pod toon | direct (`https://opengameart.org/sites/default/files/ultimate_gun_pack_by_quaternius.zip`, 7,4 MB) | **use**: pistolet i SMG z jednej paczki |
| [Sci-Fi Modular Guns](https://quaternius.com/packs/scifimodularguns.html) | Quaternius | CC0 | 78 modeli: modułowe części + złożone bronie sci-fi | FBX, OBJ, glTF, Blend | Bez tekstur, futurystyczne | gdrive/itch z quaternius.com | **maybe**: wariant "cyber" pistoletu/SMG |
| [Sci-Fi Essentials Kit](https://quaternius.itch.io/sci-fi-essentials-kit) | Quaternius | CC0 | 60+ modeli: teksturowane bronie, skrzynie, ekrany, roboty | FBX, OBJ, glTF | Teksturowane | itch | **maybe**: propsy kliniki ripperdoca (ekrany, skrzynie) |
| [Blaster Kit 2.1](https://kenney.nl/assets/blaster-kit) | Kenney | CC0 | 43 modele: blaster-a..r, magazynki, tłumiki, celowniki, granaty, skrzynie | GLB, FBX, OBJ | ~470 tris, tekstura-paleta, wygląd zabawek (foam blasters) | direct (`https://kenney.nl/media/pages/assets/blaster-kit/261d80a716-1753959510/kenney_blaster-kit_2.1.zip`) | **avoid** dla broni (styl zabawkowy); skrzynie ewentualnie |
| [Toon Shooter Game Kit](https://quaternius.com/packs/toonshootergamekit.html) | Quaternius | CC0 | 74 modele: chibi postacie (17 animacji), bronie, auta, skrzynie, płoty | FBX, OBJ, glTF, Blend | Chibi/cartoon | gdrive | **avoid** dla postaci (proporcje chibi); propsy ewentualnie |

## 4. Tekstury (CC0, głównie podłoże i ściany)

Obie biblioteki: **CC0**, bez logowania, stałe URL-e i publiczne API, łatwe do skryptu w `tools/`.

| Asset | Źródło | Co to | Bezpośredni URL (przykład 1K) | Werdykt |
|---|---|---|---|---|
| [Asphalt 025 C](https://ambientcg.com/view?id=Asphalt025C) | ambientCG | Ciemny **mokry** asfalt (tagi: rain, wet) | `https://ambientcg.com/get?file=Asphalt025C_1K-JPG.zip` | **use**: jezdnia w deszczu |
| [Road 012 A](https://ambientcg.com/view?id=Road012A) | ambientCG | Ciemny asfalt industrialny | `https://ambientcg.com/get?file=Road012A_1K-JPG.zip` | **use** |
| [Concrete 034](https://ambientcg.com/view?id=Concrete034) / [042 A](https://ambientcg.com/view?id=Concrete042A) | ambientCG | Gładki beton (chodnik, ściany) | `https://ambientcg.com/get?file=Concrete034_1K-JPG.zip` | **use** |
| [Ground 050](https://ambientcg.com/view?id=Ground050) | ambientCG | Błoto z kałużami | jw. | **maybe**: zaułki |
| [Metal Plates 006](https://ambientcg.com/view?id=MetalPlates006), [Corrugated Steel 005](https://ambientcg.com/view?id=CorrugatedSteel005), [Metal 063](https://ambientcg.com/view?id=Metal063) | ambientCG | Blachy, blacha falista, stary ciemny metal | jw. | **use**: rolety, kontenery |
| [Facade 018 A](https://ambientcg.com/view?id=Facade018A) | ambientCG | Fasada wieżowca (okna) | jw. | **maybe**: tło |
| `asphalt_05`, `dirty_concrete`, `concrete_wall_008`, `rusted_shutter`, `rusty_corrugated_iron`, `metal_grate_rusty`, `dirty_tiles` | [Poly Haven](https://polyhaven.com/textures) | Asfalt, brudny beton, zardzewiała roleta, kratka, brudne kafle (klinika) | `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_05/asphalt_05_diff_1k.jpg` (pliki z `https://api.polyhaven.com/files/<id>`) | **use**: `rusted_shutter` i `dirty_tiles` szczególnie |

Pod nasz styl: z zestawów PBR brać głównie **albedo** (ewentualnie roughness jako maska "mokrości"), przyciemnić i zredukować do palety teal w `tools/`, potem KTX2. Normal mapy kłócą się z płaskim cieniowaniem toon; używać najwyżej do subtelnych odbić na mokrym asfalcie.

## 5. HDRI / skybox (opcjonalne)

| Asset | Źródło | Licencja | Uwagi | URL | Werdykt |
|---|---|---|---|---|---|
| [Shanghai Bund](https://polyhaven.com/a/shanghai_bund) | Poly Haven | CC0 | Nocna panorama z wieżowcami i neonami | `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/shanghai_bund_1k.hdr` (zweryfikowane, 200) | **maybe**: tylko jako źródło odbić w mokrym asfalcie |
| [Hansaplatz](https://polyhaven.com/a/hansaplatz), [Neuer Zollhof](https://polyhaven.com/a/neuer_zollhof), [Cobblestone Street Night](https://polyhaven.com/a/cobblestone_street_night) | Poly Haven | CC0 | Nocne ulice miejskie | analogicznie | **maybe** |

Przy płaskim kolorze tła + mgle HDRI nie jest potrzebne. Fotograficzne niebo psuje look anime; jeśli tło, to raczej własny gradient + sylwetki low-detail wieżowców Kenney.

## 6. Audio

| Nazwa | Autor | Licencja | Zawartość | Format | Pobranie | Werdykt |
|---|---|---|---|---|---|---|
| [Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney | CC0 | 100 klików, potwierdzeń, błędów, **glitch_001-004**, scroll, toggle | OGG | direct (`https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip`) | **use**: UI/HUD, dialogi |
| [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 | 130 plików: kroki (beton, drewno...), uderzenia metal/szkło/generic | OGG | direct (`https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip`) | **use**: trafienia, kroki |
| [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | Kenney | CC0 | 73 pliki: computerNoise, drzwi, forceField, lasery, silniki | OGG | direct (`https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip`) | **use**: klinika, drzwi, cyberoptyka |
| [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | freefirearmsfx.com (mirror OGA) | CC0 | Nagrania broni: pistolety, karabinki, broń automatyczna, rewolwery, strzelby (prepared) | WAV/OGG w .7z | direct (`https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z`, 194 MB) | **use**: strzały pistoletu i SMG (wybrać kilka, reszty nie commitować) |
| [Rain (loopable)](https://opengameart.org/content/rain-loopable) | Ylmir | CC0 | 4 pętle deszczu 25-45 s | MP3, OGG | direct (`https://opengameart.org/sites/default/files/Rain%20OGG.zip`) | **use**: baza deszczu |
| [steady rain in the city](https://freesound.org/people/roofusj/sounds/217236/) | roofusj | CC0 | 3:05 deszcz na parapecie z tłem miasta, WAV 96 kHz | WAV | login (Freesound) | **use**: warstwa "miejska" deszczu |
| [Seamless City Loop](https://freesound.org/people/qubodup/sounds/223093/) | qubodup | CC0 | 30 s bezszwowa pętla nocnego miasta | FLAC | login | **use**: city hum |
| [T & T Free Cyberpunk Pack 2](https://opengameart.org/node/119238) | tricksntraps (Alexander Ehlers) | CC0 | 10 utworów: night_club_chill (100 bpm), strange_experiments (80), ai_fight (120), system_overload (154) i in. | OGG | direct (np. `https://opengameart.org/sites/default/files/night_club_chill_100bpm.ogg`) | **use**: muzyka eksploracja/walka |
| [Mirrorshade](https://opengameart.org/content/mirrorshade), [PYNCHON](https://opengameart.org/content/pynchon) | cinameng (James Gargette) | CC0 | Krótkie pętle dub-techno / glitch lo-fi "cyberpunk ambience" | MP3 | direct (`https://opengameart.org/sites/default/files/mirrorshade_1.mp3`, `.../pynchon.mp3`) | **use**: ambient menu, klinika |
| [Corrupt Data Stream](https://opengameart.org/content/corrupt-data-stream) | Tsorthan Grove | CC0 | Dark ambient cyberpunk | MP3 | direct (`https://opengameart.org/sites/default/files/corrupt_data_stream.mp3`) | **maybe**: napięcie/hakowanie |
| [Gunshot sounds](https://opengameart.org/content/gunshot-sounds) | Tabasco | CC0 | CZ-52, Mosin, SKS, strzelba | zip | direct | **avoid**: słaba jakość (przester, szum) |
| Sonniss #GameAudioGDC bundles ([licencja](https://sonniss.com/gdc-bundle-license/)) | Sonniss | Własna: użycie komercyjne bez atrybucji, **zakaz udostępniania plików jako efektów** poza zespołem | Dziesiątki GB profesjonalnych SFX | WAV | direct (torrent/strona) | **avoid** w publicznym repo (raw pliki w git = redystrybucja). OK tylko w prywatnym storage zespołu |
| Freesound z CC-BY / CC-BY-NC | różni | BY wymaga atrybucji, **NC zabrania użycia komercyjnego** | | | login | BY: maybe z plikiem CREDITS; NC: **avoid** |
| OGA "2am in Sector 3", "HIGH_TECH_LOW_LIFE" i podobne | Eric Matyas i in. | CC-BY 3.0/4.0 | Klimatyczne pętle cyberpunk | | direct | **maybe**: tylko z atrybucją |

Uwaga do Freesound: przy niektórych nagraniach CC0 autor w opisie prosi o kredyt przy użyciu komercyjnym; licencja CC0 tego nie wymaga, ale warto i tak wpisać ich do CREDITS. Każdy dźwięk Freesound przed commitem sprawdzić na jego stronie (licencję mają per plik).

## 7. Fonty

Pominięte zgodnie z briefem. Rajdhani + Share Tech Mono (OFL) są OK.

---

## Rekomendowany zestaw startowy (najmniej tarcia licencyjnego, wszystko CC0)

| # | Pick | Zastępuje | Pobranie |
|---|---|---|---|
| 1 | Quaternius **Ultimate Modular Women** | bohaterka (Sci-Fi Woman z krótkimi włosami), fixerka, babcia (casual) | gdrive |
| 2 | Quaternius **Ultimate Modular Men** | gangerzy Hebi (punk/casual przemalowane na zielone bluzy + maski), fixer, ripperdoc, SWAT | gdrive |
| 3 | Quaternius **Universal Animation Library** (Standard) | brakujące klipy: śmierć, trafienie, celowanie | itch |
| 4 | **Neon Town** (leonkin) | neony, bar, sklepy, latarnie, kontener, taxi/radiowóz | direct |
| 5 | Quaternius **Cyberpunk Game Kit** | propsy zaułków: AC, rury, anteny, skrzynie, szyldy | gdrive |
| 6 | Kenney **City Kit Roads** | jezdnia, chodniki, latarnie, dumpstery, kable | direct |
| 7 | Kenney **Car Kit** | zaparkowane auta, vany | direct |
| 8 | Quaternius **Ultimate Gun Pack** | pistolet (`Pistol_*`) i SMG (`SubmachineGun_*`) | direct |
| 9 | ambientCG **Asphalt025C** + **Concrete034** + Poly Haven **rusted_shutter**/**dirty_tiles** | podłoże, ściany, klinika | direct |
| 10 | Kenney **Interface + Impact + Sci-fi Sounds** | UI, kroki, trafienia, drzwi/klinika | direct |
| 11 | **Free Firearm Sound Library** (wybrane strzały) + **Rain (loopable)** + Freesound **Seamless City Loop** | strzały, deszcz, szum miasta | direct / login |
| 12 | **T & T Free Cyberpunk Pack 2** + **Mirrorshade** | muzyka | direct |

Dodać `assets/CREDITS.md` (lista źródeł i licencji, także CC0, dla porządku) i trzymać oryginalne paczki poza gitem;
w repo tylko wybrane, zoptymalizowane pliki. Skrypt w `tools/` może pobierać źródła z URL-i "direct" powyżej.

## Integracja z Babylon.js 9 (krótko)

1. **Loader**: dodać `@babylonjs/loaders@9.32.0` (ta sama wersja co `@babylonjs/core`) i reeksportować potrzebne symbole
   (`SceneLoader`/`LoadAssetContainerAsync`, rejestracja `@babylonjs/loaders/glTF/2.0`) wyłącznie przez
   `packages/engine/src/babylon.ts` (reguła twarda). `LoadAssetContainerAsync` + `instantiateModelsToScene()` daje
   tanie klony postaci/propsów.
2. **Konwersja**: FBX/OBJ/VRM -> GLB przez Blender w trybie headless (`blender -b -P tools/fbx2glb.py`).
   VRM 0.x to glTF binary: wystarczy zmienić rozszerzenie (rozszerzenia VRM i MToon zostaną zignorowane).
   `babylon-vrm-loader` jest porzucony (ostatnio 2023, peer `@babylonjs/core ^5`), **nie używać**.
3. **Optymalizacja**: `@gltf-transform/cli` 4.5.x:
   `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2`
   (ktx2 wymaga zainstalowanego KTX-Software). Kenney GLB odwołują się do zewnętrznego `Textures/colormap.png`;
   `gltf-transform copy` z poprawną ścieżką osadzi teksturę. Dekodery meshopt i KTX2
   (`@babylonjs/ktx2decoder`) hostować lokalnie zamiast domyślnego CDN.
4. **Zachowanie looku toon**: po załadowaniu przejść po `container.meshes`, odczytać z oryginalnego `PBRMaterial`
   `albedoColor` (i `emissiveColor` dla neonów), przypisać nasz `ShaderMaterial` z tym kolorem bazowym
   (cache po kolorze, żeby nie mnożyć materiałów i draw calli), oryginały `dispose()`. Najlepiej robić to raz
   offline w `tools/` (np. zapis presetu w `extras` materiału), a w runtime tylko mapować.
   - Paczki z teksturą-paletą (Kenney, KayKit, 100Avatars): albo dodać do toon shadera opcjonalny atrybut `uv` +
     sampler `baseMap` (próbka koloru zamiast `baseColor`), albo w `tools/` wypiec kolor z palety do atrybutu
     `color` wierzchołka. To zmiana w obszarze Rendering/NPR.
   - Postacie: shader trzeba rozszerzyć o skinning (`matricesIndices`/`matricesWeights`, include'y
     `bonesDeclaration`/`bonesVertex`, ewentualnie `bakedVertexAnimation` dla tłumu). Animacje z Universal Animation
     Library / KayKit nakładać przez retargeting na rig Quaternius albo wypiekać w Blenderze.
   - Zmiana wyglądu NPR wymaga odświeżenia migawki `e2e/npr-perf.spec.ts` (patrz CLAUDE.md).
5. **Audio**: OGG/MP3 ładować przez istniejący moduł `packages/engine/src/audio` (Web Audio `decodeAudioData`);
   pętle deszczu i miasta przyciąć do zera przejścia, muzykę przekonwertować do OGG ~96-128 kbps.
