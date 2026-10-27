# ADR-0015: Ekwipunek, uzbrojenie i łupy

## Kontekst
Backlog zapowiada lootowanie wrogów i menu postaci na telefonie. Dziś ekwipunek to licznik apteczek, broń nie ma amunicji ani przeładowania, pancerz to jedna liczba, a pokonany wróg znika bez śladu. Równolegle pakiet walki wprowadza strefy trafień (głowa, tors, ręce, nogi), rozrzut zależny od postawy i statystykę `aimStability`, a harmonogramy dobowe zajmują zapis v7. Pełny projekt z liczbami: [`docs/ekwipunek-i-uzbrojenie.md`](../ekwipunek-i-uzbrojenie.md).

## Decyzja
- **Model przedmiotów w `core/items`**: definicje w katalogach, w ekwipunku stosy (licznik po id) dla przedmiotów bez stanu i instancje z `uid` (z licznika w domenie, bez RNG) dla broni, odzieży, modów i nieinstalowanych wszczepów. Rzadkość (`common`, `uncommon`, `rare`, `unique`) daje stałe mnożniki zamiast losowych afiksów, więc zapis trzyma tylko poziom.
- **Limit ekwipunku: sloty**, 24 komórki (do 36 z ulepszeniem plecaka), bez wagi i bez siatki kształtów. Amunicja w osobnej ładownicy z limitem per typ, przedmioty fabularne poza limitem. Układ siatki nie jest stanem domeny: UI tylko sortuje.
- **Trzy sloty broni** (`primary`, `secondary`, `melee`), jeden aktywny. `WeaponDefinition` zastępuje `Weapon`: magazynek, przeładowanie (`magazine` lub `per-round`), rozrzut bazowy i odrzut jako wejście dla pakietu walki, mnożniki stref, czas dobycia, sloty modów. Naboje w magazynku należą do instancji broni. NPC używają profilu `npc` tej samej definicji, co zachowuje dzisiejszy balans gangera.
- **Pancerz per strefa**: `stats.armor` (wszczepy, wspomnienia) działa wszędzie, odzież tylko na swoich strefach (tors pokrywa też ręce). Redukcja dalej płaska przez `mitigate`; suma strefy ograniczona do 8. Odzież ma stan techniczny, broń nie.
- **Łupy**: `rollLoot(table, rng)` w `core` zużywa stałą liczbę liczb losowych. Sim podaje osobny `RandomPort` na pojemnik, wyprowadzony z ziarna gry i klucza wroga, więc łup nie przesuwa głównego strumienia RNG. Losowanie raz, przy śmierci; wynik w `domain.loot`.
- **Torba zamiast ciała** jako obiekt interakcji (`Interactable.kind = "loot"`, `ViewDescriptor { kind: "loot" }`), czas życia 300 s czasu symulacji, limit 12 toreb. Fabryka świata odtwarza torby z domeny przy wczytaniu i streamingu, jak cele kontraktów.
- **Wszczep jako przedmiot**: łup trafia do ekwipunku, montaż tylko w klinice za 25% wartości; zastąpiony implant wraca do ekwipunku zamiast przepadać.
- **Ekonomia**: skup 25% wartości (złom 100%), korekta progiem reputacji właściciela, naprawa 30% wartości za brakujący stan. Łup ma dawać 20 do 30% wypłaty kontraktu; pilnuje tego analityczny test balansu w `core`. Drugi handlarz: stragan Oyaji na targu (`shopId`).
- **RenderPort.setAppearance(entityId, AppearanceDescriptor)**: broń w slotach (`WeaponLook`), odzież (`tint` i dodatki na punktach zaczepienia) i widoczne wszczepy. Deskryptor buduje `appearanceOf(domain)` w `core`; `RenderSync` wysyła go przy zmianie. Rozdzielenie od `spawn` pozwala zmieniać strój bez respawnu i bez ponownego ładowania VRM. Modele VRM dostają w pierwszym etapie tylko dodatki na kościach.
- **Podgląd 3D w menu**: UI wysyła prostokąt i obrót przez `UiIntents` (`setPreviewViewport`, `rotatePreview`); `app` przekazuje je z deskryptorem wyglądu do `PreviewStage` w `engine`, czyli osobnej `Scene` na tym samym `Engine` i canvasie. Bez drugiego kontekstu WebGL.
- **Menu postaci zatrzymuje symulację**; komendy z menu stosuje `Simulation.applyPendingCommands()`, czyli faza komend następnego kroku wykonana wcześniej. Komendy z menu nie zużywają RNG ani czasu, więc wynik i replay są takie same. Panel łupu i sklep zatrzymują tylko gracza.
- **Nowe komendy, wejście i zdarzenia** w kontraktach `core` (lista w dokumencie, §8.3): m.in. `equip-item`, `use-item`, `drop-item`, `sell-item`, `take-loot`, `install-mod`; `InputFrame.reload` i `weaponSlot`; `ItemAdded`, `ItemEquipped`, `ReloadStarted`, `LootDropped`.
- **Zapis**: kolejna wersja po v7 (numer przy scaleniu). Migracja zamienia `inventory { medkit }` na `InventoryState`, dodaje `equipment` z Unity-9, kurtką i spodniami, `ammo { 9mm: 48 }` i pusty `loot`. Postęp przeładowania, odrzut i magazynki NPC nie są zapisywane.

## Konsekwencje
- Złoty hash determinizmu zmieni się w etapach z amunicją, strefami pancerza i łupami; każdy PR aktualizuje go z uzasadnieniem.
- Zmiana `steady_grip` na `aimStability` (jeśli pakiet walki ją przyjmie) zmienia kryterium z ADR-0010 i test `m1-loop`.
- Płaska redukcja pancerza przy słabych broniach NPC jest głównym ryzykiem balansu; przejście na redukcję procentową wymagałoby osobnego ADR.
- Karta postaci i dziennik stają się zakładkami jednego ekranu „Postać”; sklep współdzieli z nim komponenty komórki, szczegółów i porównania.
