// Seki Senshi, ADR-0101: small talk with Alchemia's sellers, every open shop of the gallery and the front
// and every open kitchen of the food hall without a keeper of the story. One knot per trade or kitchen,
// a stitch per voice (`v1`..): the simulation gives each shop of a trade a voice of its own (`sellers.ts`).
// A greeting by the time of day, warmer once she is a regular (a flag per voice, set on the first talk),
// three topics (the goods, a rumour of the district, the seller), a goodbye. No knot pays or hands out items.

VAR seller_voice = 0
VAR seller_goods = false
VAR seller_gossip = false
VAR seller_self = false

// Every seller's opening, as a tunnel: the topics afresh, the street's view of her, the greeting by the hour
// (a regular's once `met` is set), then `met` set.
=== seller_open(met) ===
~ seller_goods = false
~ seller_gossip = false
~ seller_self = false
{ civilians_tier == "hostile":
    LADA: Nie obsługuję takich jak ty. Ochrona galerii ma twoje zdjęcie przy kasie.
    -> END
}
{
- has_flag(met) && time_of_day == "night":
    LADA: Znowu ty. Nocą przychodzą tu tylko stali klienci i kłopoty, a ty na razie jesteś tym pierwszym.
- has_flag(met) && time_of_day == "dawn":
    LADA: Ty o tej godzinie? Kasa ledwo się obudziła, ale dla stałych klientów zawsze jest otwarta.
- has_flag(met) && time_of_day == "day":
    LADA: O, stała klientka. Dla ciebie bez kolejki.
- has_flag(met):
    LADA: Wróciłaś przed zmrokiem. Rozsądnie, za godzinę galeria pełna jest ludzi, którzy nic nie kupują.
- time_of_day == "night":
    LADA: Nocą? Mów cicho, kamery ochrony słyszą lepiej, niż widzą.
- time_of_day == "dawn":
    LADA: Świt, a ty już na nogach. Pierwsza klientka dnia przynosi szczęście albo pecha.
- time_of_day == "day":
    LADA: Dzień dobry. Rozglądaj się śmiało, tylko nie wszystko, co świeci, jest na sprzedaż.
- else:
    LADA: Dobry wieczór. Neony już grzeją, ceny jeszcze nie.
}
~ set_flag(met)
->->

// Pharmacies: MEDIFARM, MEDIX, APTEKA NOVA, FARMA PLUS.
=== seller_pharmacy ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_pharmacy_1") ->
LADA: Apteka. Plastry, filtry do płuc, tabletki na sen, którego i tak nie będzie.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_pharmacy_2") ->
LADA: Witaj w aptece, gdzie recepta to tylko sugestia.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_pharmacy_3") ->
LADA: Apteka całodobowa. Prawie całodobowa, bo ochrona wyłącza prąd o czwartej.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_pharmacy_4") ->
LADA: Mów, co boli. Resztę wyczytam z twoich źrenic.
-> talk

= talk
+ { not seller_goods } [Co masz na receptę, a co bez? #tone:optional]
    ~ seller_goods = true
    SEKI: Co masz na receptę, a co bez?
    {
    - seller_voice == 1:
        LADA: Inhalatory na smog znad Bystrzycy i krople do oczu po neonach. Na wszczepy nic nie mam, z tym idź do Mori na deptak.
    - seller_voice == 2:
        LADA: Środki przeciwbólowe w trzech mocach: na dzień, na noc i na rozmowę z Hebi.
    - seller_voice == 3:
        LADA: Elektrolity dla tych, co tańczą do rana na Krakowskim, i melatonina dla tych, co mieszkają nad nimi.
    - else:
        LADA: Syntetyczna kofeina, plaster na chrom, coś na kaca po sake. Najlepiej schodzi to ostatnie.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Po deszczu ludzie kaszlą na czarno. Mówią, że to kominy Tessen nad rzeką, a Tessen mówi, że to pogoda.
    - seller_voice == 2:
        LADA: Hebi przychodzą tu po opatrunki w każdy piątek. Płacą gotówką i nikt nie pyta, skąd te rany.
    - seller_voice == 3:
        LADA: Ktoś wykupił cały zapas leków na odrzut wszczepów. Gotówką, w masce, z naszywką firmy, której nikt tu nie zna.
    - else:
        LADA: Na billboardach Kagami obiecują, że zapamiętają za ciebie. Ja sprzedaję tabletki, żeby zapomnieć. Konkurencja.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Dwanaście godzin za szybą, potem dwanaście snu na tabletkach. Rachunek się zgadza.
    - seller_voice == 2:
        LADA: Farmacja na UMCS skończyła się na trzecim roku. Resztę uczy lada.
    - seller_voice == 3:
        LADA: Mama miała aptekę przy Lubartowskiej. Lubartowska jeszcze stoi, apteki już nie ma.
    - else:
        LADA: Ja tylko stoję za ladą na zmiany. Właściciel mieszka na Wieniawie i nikt go tu nie widział.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Pij wodę z butelek. Kranówka na Starym Mieście pamięta jeszcze rury Czechówki.
    - seller_voice == 2:
        LADA: Zdrowia. Tu to najdroższy towar.
    - seller_voice == 3:
        LADA: Wracaj zdrowa. Albo chociaż wracaj.
    - else:
        LADA: Uważaj na schodach ruchomych. Trzeci stopień od góry gryzie.
    }
    -> END

// Tattoo studios: IREZUMI, INKSPOT, SUMI INK, BLACK LOTUS.
=== seller_tattoo ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_tattoo_1") ->
LADA: Studio. Igły sterylne, tusz świecący, klient trzeźwy. Dwa z trzech gwarantuję.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_tattoo_2") ->
LADA: Siadaj, jeśli masz odwagę. Stój, jeśli masz tylko pytania.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_tattoo_3") ->
LADA: Atrament, nie hologram. Tutaj wszystko jest na stałe.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_tattoo_4") ->
LADA: Kolejka na dwa tygodnie, ale dla ciebie znajdę pół godziny. Albo i nie.
-> talk

= talk
+ { not seller_goods } [Co możesz mi wytatuować? #tone:optional]
    ~ seller_goods = true
    SEKI: Co możesz mi wytatuować?
    {
    - seller_voice == 1:
        LADA: Tusz reaktywny: śpi za dnia, świeci pod neonem. Na skórę z chromem kładę inny, bo zwykły się łuszczy.
    - seller_voice == 2:
        LADA: Wzory z karpiem koi, z Bramą Krakowską, z Koziołkiem. Turyści z Warszawy biorą Koziołka.
    - seller_voice == 3:
        LADA: Kreski kodowe dla tych, co chcą, żeby skaner ich czytał, i szum dla tych, co nie chcą.
    - else:
        LADA: Kaligrafia, ornamenty z kamienic Starego Miasta, napisy po japońsku, które naprawdę coś znaczą.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Hebi zamawiają tu węże na przedramionach. Kto od nich odchodzi, wraca je zamalować. Zawsze nocą.
    - seller_voice == 2:
        LADA: W Neon Koi mówią, że fixer znowu szuka ludzi do roboty. Tacy jak ty zwykle wracają potem tutaj, z bliznami do zakrycia.
    - seller_voice == 3:
        LADA: Tessen zakazało tatuaży swoim strażnikom na Nabrzeżu. Teraz robię im je tam, gdzie mundur zakrywa.
    - else:
        LADA: Ktoś maluje po nocach Wieżę Trynitarską na murach galerii. Ochrona zamalowuje rano, a on wraca. Szanuję.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Pierwszy tatuaż zrobiony igłą krawiecką, w piwnicy na Podzamczu. Ręka wtedy drżała, dziś drży tylko klientom.
    - seller_voice == 2:
        LADA: Tatuuję od dwudziestu lat. Od dziesięciu głównie zakrywam to, co ktoś inny spartaczył.
    - seller_voice == 3:
        LADA: Studio przyszło po wujku. Razem z długami i z kotem, który śpi na fotelu dla klientów.
    - else:
        LADA: Kiedyś komiksy, dziś skóra. Papier płacił gorzej i nie krzyczał.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Przemyśl wzór. Skóra pamięta dłużej niż ludzie.
    - seller_voice == 2:
        LADA: Wróć z pomysłem, nie z wódką.
    - seller_voice == 3:
        LADA: Smaruj maścią przez tydzień. I nie pływaj w Bystrzycy, w ogóle.
    - else:
        LADA: Jak zmienisz zdanie, igła poczeka.
    }
    -> END

// Pawnshops: LOMBARD, SKUP.
=== seller_pawn ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_pawn_1") ->
LADA: Lombard. Wszystko ma swoją cenę, a ja znam ją lepiej od właściciela.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_pawn_2") ->
LADA: Skup złota, srebra i wspomnień. Żart. Wspomnień nie biorę, nie da się ich odsprzedać.
-> talk

= talk
+ { not seller_goods } [Co skupujesz, a co sprzedajesz? #tone:optional]
    ~ seller_goods = true
    SEKI: Co skupujesz, a co sprzedajesz?
    {
    - seller_voice == 1:
        LADA: Zegarki, wszczepy po odrzucie, obrączki po rozwodach. Pytań nie zadaję, pokwitowań nie wystawiam.
    - else:
        LADA: Pistolet bez numerów, laptop z cudzą historią, medal z czasów, o których nikt nie mówi.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Targ spod wiaduktu na Tysiąclecia przeprowadził się tu razem ze swoimi długami. Hebi przyszli w pakiecie.
    - else:
        LADA: Wczoraj ktoś przyniósł sygnet z herbem Kagami. Rano przyszło dwóch w garniturach i go odkupiło. Za podwójną cenę.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Ojciec miał komis na Ruskiej. Ja mam lombard w galerii. Awans społeczny.
    - else:
        LADA: Kiedyś licytacje komornicze, teraz lombard. Ta sama praca, mniej papierów.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Jak będziesz w potrzebie, wiesz, gdzie stoję. Wszyscy w końcu są.
    - else:
        LADA: Nie sprzedawaj niczego, czego nie da się odkupić.
    }
    -> END

// Synthetic food: SYNTHMART, SOYA MAX, KONBINI, NOODLE BOX.
=== seller_synth_food ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_synth_food_1") ->
LADA: Konbini całą dobę. Wszystko z drukarki, nic z pola.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_synth_food_2") ->
LADA: Syntetyki tanio. Prawdziwe jedzenie jest na górze, w food hallu, i kosztuje jak wszczep.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_synth_food_3") ->
LADA: Gorąca woda za darmo, reszta za kredyty.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_synth_food_4") ->
LADA: Przecena po dwudziestej, ale wtedy zostają tylko sosy.
-> talk

= talk
+ { not seller_goods } [Co tu da się zjeść? #tone:optional]
    ~ seller_goods = true
    SEKI: Co tu da się zjeść?
    {
    - seller_voice == 1:
        LADA: Cebularz z białka grzybowego, onigiri z algami z Zalewu, kawa z puszki, która smakuje jak kawa z puszki.
    - seller_voice == 2:
        LADA: Zupy w proszku, makaron w kostce, chipsy z owadów. Owady lubelskie, z certyfikatem.
    - seller_voice == 3:
        LADA: Ramen instant w dziewięciu smakach. Wszystkie smakują jak glutaminian, tylko w różnych kolorach.
    - else:
        LADA: Batony proteinowe dla najemników, mleko sojowe dla dzieci, sake w woreczkach dla wszystkich.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Dostawy przychodzą dronem, bo ciężarówki Tessen stoją na Nabrzeżu w korku z własnymi ciężarówkami.
    - seller_voice == 2:
        LADA: Oyaji w food hallu na górze sprzedaje coś więcej niż noże. Wszyscy wiedzą, nikt nie mówi.
    - seller_voice == 3:
        LADA: Taras na dachu przecieka prosto na trzecie piętro. Kelnerzy stawiają wiadra i udają, że to fontanny.
    - else:
        LADA: Na parkingu pod galerią roboty magazynu jeżdżą po nocach, choć nikt im nie kazał. Ochrona nie schodzi tam po dwudziestej drugiej.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Nocne zmiany, bo w dzień kasę obsługują automaty. W nocy automaty boją się Hebi.
    - seller_voice == 2:
        LADA: Jedzenie dla pracowników jest za darmo. Po roku to już żadna zaleta.
    - seller_voice == 3:
        LADA: Po politechnice pracy nie ma. Po ramenie zawsze jest.
    - else:
        LADA: Sklep jest w rodzinie od trzech pokoleń. Dziadek sprzedawał ziemniaki, ja sprzedaję coś, co udaje ziemniaki.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Smacznego. Mniej więcej.
    - seller_voice == 2:
        LADA: Nie bierz nic z zieloną naklejką. Zielone znaczy wczoraj.
    - seller_voice == 3:
        LADA: Uważaj, gorące. Kubek też.
    - else:
        LADA: Do jutra. Zawsze jest jakieś jutro, przecena też.
    }
    -> END

// Electronics: VOLTAGE, OMNIBYTE, CYBERDECK.
=== seller_electronics ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_electronics_1") ->
LADA: Elektronika. Nowa, używana i taka, o której lepiej nie wiedzieć, skąd jest.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_electronics_2") ->
LADA: Szukasz czegoś konkretnego czy tylko grzejesz się przy serwerach?
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_electronics_3") ->
LADA: Wszystko z wtyczką, wszystko na baterię, wszystko na sprzedaż.
-> talk

= talk
+ { not seller_goods } [Co masz z elektroniki? #tone:optional]
    ~ seller_goods = true
    SEKI: Co masz z elektroniki?
    {
    - seller_voice == 1:
        LADA: Kable, czujniki, modemy satelitarne, ekrany zwinięte w rulon. Gwarancja do drzwi.
    - seller_voice == 2:
        LADA: Decki, karty pamięci z zapasem, filtry na kamery Tessen. Te ostatnie spod lady.
    - else:
        LADA: Drony dostawcze po kolizji, naprawione i przemalowane. Latają prawie prosto.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Sieć w galerii pada co wieczór o tej samej porze. Ktoś na górze ściąga coś wielkiego i nikt nie wie co.
    - seller_voice == 2:
        LADA: Kamery na deptaku podpięto do nowej sieci. Teraz widzą też to, czego nie powinny.
    - else:
        LADA: Po nocy blokady pół okolicy kupowało tu anteny. Nikt nie wierzył w to, co mówiło Tessen Info.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Lutowanie od dziecka. Pierwsze radio poskładane z części ze śmietnika pod Bramą Krakowską.
    - seller_voice == 2:
        LADA: Kiedyś serwis telefonów na Krakowskim. Potem przyszły telefony, których nie da się otworzyć.
    - else:
        LADA: Sklep po ojcu, długi po ojcu, klienci po ojcu. Tylko towar nowy.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Nie podłączaj niczego, czego nie rozumiesz. I tak ci to sprzedam.
    - seller_voice == 2:
        LADA: Wracaj, jak coś zacznie dymić.
    - else:
        LADA: Trzymaj się z dala od wody. Ty i twój sprzęt.
    }
    -> END

// Florists: PLASTIFLORA, BONSAI.
=== seller_florist ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_florist_1") ->
LADA: Kwiaciarnia. Plastikowe nie więdną, prawdziwe kosztują majątek.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_florist_2") ->
LADA: Bonsai, mech, paprocie. Zielono jak w Ogrodzie Saskim po deszczu, tylko taniej i bez kaczek.
-> talk

= talk
+ { not seller_goods } [Masz tu coś żywego? #tone:optional]
    ~ seller_goods = true
    SEKI: Masz tu coś żywego?
    {
    - seller_voice == 1:
        LADA: Róże z drukarki, storczyki na prąd, bonsai z czujnikiem, który mówi, kiedy podlać.
    - else:
        LADA: Drzewka w doniczkach z czujnikiem wilgoci. Mech na ściany, żeby mieszkanie oddychało za ciebie.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: W ogrodzie na dachu ktoś zasadził prawdziwe pomidory. Ochrona pilnuje ich lepiej niż kas.
    - else:
        LADA: Drzewa na Placu Litewskim mają po trzy kamery każde. Podobno przez ludzi, którzy zimą wycinają je na opał.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Kwiaty kocham od dziecka, alergię mam od dziecka. Plastik to kompromis.
    - else:
        LADA: Kiedyś praca w parku na Czechowie. Park zamknęli, a ręce zostały w ziemi.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Weź choć jeden. Nawet sztuczny kwiat zmienia pokój.
    - else:
        LADA: Podlewaj z umiarem. To samo z kawą.
    }
    -> END

// Repair shops: FIXPOINT, REBOOT, CHIPFIX, DATAFIX.
=== seller_repair ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_repair_1") ->
LADA: Serwis. Jeśli się psuje, naprawię. Jeśli nie, poczekaj, zepsuje się.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_repair_2") ->
LADA: Naprawa na już, na jutro albo na nigdy. Ceny od prawej.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_repair_3") ->
LADA: Chcesz coś naprawić czy tylko się poskarżyć? Za drugie też biorę.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_repair_4") ->
LADA: Zostaw sprzęt, weź numerek, wróć za tydzień. Albo poczekaj, dziś mało ludzi.
-> talk

= talk
+ { not seller_goods } [Co naprawiasz? #tone:optional]
    ~ seller_goods = true
    SEKI: Co naprawiasz?
    {
    - seller_voice == 1:
        LADA: Telefony, decki, protezy, mikrofalówki. Raz przynieśli drona z Hebi w środku. Hebi też dało się naprawić.
    - seller_voice == 2:
        LADA: Wymieniam baterie we wszczepach, czyszczę porty, prostuję ekrany po upadku z wiaduktu.
    - seller_voice == 3:
        LADA: Zasilacze, kable, zawiasy od protez. Mam części do wszystkiego, co wyprodukowano przed siedemdziesiątym.
    - else:
        LADA: Odzyskuję dane z kart, które ktoś próbował złamać, spalić albo utopić w Bystrzycy.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Windy w galerii stają między piętrami, kiedy ktoś na dole puszcza muzykę za głośno. Nie pytaj, dlaczego. Sprawdzone.
    - seller_voice == 2:
        LADA: Ktoś z Tessen przynosi tu sprzęt z nalepką „własność firmy”. Płaci podwójnie, żeby nikt nie czytał nalepek.
    - seller_voice == 3:
        LADA: Na Nabrzeżu dźwig Tessen chodzi nawet w nocy. Mówią, że ładuje coś, czego nikt nie zamawiał.
    - else:
        LADA: Neon ALCHEMIA nad wejściem pije prądu tyle co pół Czechowa. Jak zgaśnie, wiesz, że miasto ma problem.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Ręce mam do roboty, głowę do liczenia długów. Obie się przydają.
    - seller_voice == 2:
        LADA: Dwadzieścia lat w zakładzie na Zemborzycach. Zakład zautomatyzowali, mnie się nie dało.
    - seller_voice == 3:
        LADA: Kiedyś lutowanie płyt w fabryce, dziś wszystko, co ludzie przyniosą w reklamówce.
    - else:
        LADA: Klucz w ręku od czternastego roku życia. Szkoła się skończyła, klucz został.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Przynieś, zanim całkiem padnie. Taniej wychodzi.
    - seller_voice == 2:
        LADA: Jak coś stuka, nie stukaj w to bardziej.
    - seller_voice == 3:
        LADA: Wpadaj. Zawsze coś się zepsuje.
    - else:
        LADA: Uważaj na siebie. Ciebie nie naprawię.
    }
    -> END

// Implant shops: NEUROTEK, CHROMEDOC, SYNAPSE.
=== seller_implants ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_implants_1") ->
LADA: Wszczepy z certyfikatem. Certyfikat też jest wszczepem, ale to inna rozmowa.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_implants_2") ->
LADA: Witaj w przyszłości. Raty na sześćdziesiąt miesięcy, gwarancja na dwanaście.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_implants_3") ->
LADA: Chrom z gwarancją, chrom bez gwarancji. Różnica w cenie i w spaniu.
-> talk

= talk
+ { not seller_goods } [Jaki chrom masz na stanie? #tone:optional]
    ~ seller_goods = true
    SEKI: Jaki chrom masz na stanie?
    {
    - seller_voice == 1:
        LADA: Oczy z zoomem, palce z czujnikiem, porty pod czaszką. Montaż robi Mori na deptaku, tutaj tylko sprzedaż.
    - seller_voice == 2:
        LADA: Wzmacniacze refleksu z demobilu Tessen, płytki pamięci, kolana do biegania po schodach ruchomych.
    - else:
        LADA: Cyberoko z widzeniem w nocy, filtr krwi na sake, sztuczna skóra w czterdziestu odcieniach.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Coraz więcej ludzi przychodzi z wszczepami, których kupna nie pamiętają. Mówią, że to przez stres.
    - seller_voice == 2:
        LADA: Kliniki Kagami otwierają filie w każdej dzielnicy. U nich za darmo, jeśli podpiszesz zgodę. Nikt nie czyta zgody.
    - else:
        LADA: W Neon Koi barman zbiera plotki lepiej niż ja wszczepy. Spytaj go o ripperdoków ze Starego Miasta.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Sprzedaję chrom, a we mnie ani grama. Ktoś tu musi zostać człowiekiem.
    - seller_voice == 2:
        LADA: Kiedyś etat przy aparaturze w szpitalu na Jaczewskiego. Szpital przeszedł pod korporację, a ludzie od aparatury pod ladę.
    - else:
        LADA: Mam tylko jeden wszczep, w uchu. Słyszę przez niego kasę z drugiego końca galerii.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Nie kupuj oczu na raty. Potem patrzą tylko na rachunki.
    - seller_voice == 2:
        LADA: Wracaj w całości. Najlepiej w tej, z którą przyszłaś.
    - else:
        LADA: Jeśli coś zacznie swędzieć pod skórą, wróć od razu, nie po tygodniu.
    }
    -> END

// Exchanges: BITKANTOR, KOINEX, KANTOR, BITBANK.
=== seller_crypto ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_crypto_1") ->
LADA: Kantor. Kredyty, złoto, tokeny korporacji. Złotówki tylko na pamiątkę.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_crypto_2") ->
LADA: Wymiana anonimowa, prowizja jawna. To jedyna jawna rzecz w tym lokalu.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_crypto_3") ->
LADA: Kurs dnia na ekranie, kurs dla ciebie w mojej głowie.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_crypto_4") ->
LADA: Kredyty za gotówkę, gotówka za kredyty. Uczciwie, jak na galerię.
-> talk

= talk
+ { not seller_goods } [Po ile dziś kredyty? #tone:optional]
    ~ seller_goods = true
    SEKI: Po ile dziś kredyty?
    {
    - seller_voice == 1:
        LADA: Kredyty Tessen idą w górę, odkąd na Nabrzeżu znowu pracują na trzy zmiany. Tokeny Kagami lepiej trzymać, niż sprzedawać.
    - seller_voice == 2:
        LADA: Portfele na chipie, sejfy w chmurze, które nie są w żadnej chmurze, tylko w piwnicy.
    - seller_voice == 3:
        LADA: Kredyty, punkty lojalnościowe galerii, bony na obiad w food hallu. Wymieniam wszystko na wszystko.
    - else:
        LADA: Złoto w sztabkach po gramie. Lubelska klasyka: każdy ma trochę i nikt się nie chwali.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Hebi wymieniają tu co tydzień tę samą sumę. Myślą, że nikt tego nie liczy. Liczę, to mój zawód.
    - seller_voice == 2:
        LADA: Ktoś wykupuje długi ludzi z Krakowskiego. Nie ściąga ich, tylko trzyma. Czeka na coś.
    - seller_voice == 3:
        LADA: Bankomat przy wejściu od Świętoduskiej czasem wypłaca dwa razy. Kolejka ustawia się od piątej rano.
    - else:
        LADA: Fixer z Neon Koi płaci swoim w kredytach, nie w gotówce. Ślad zostaje, ale tylko u niego.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Matematyka na UMCS, potem bank, potem ten kantor. Każdy krok o piętro niżej.
    - seller_voice == 2:
        LADA: Praca po nocach, bo w dzień kursy zmieniają się za szybko dla ludzi.
    - seller_voice == 3:
        LADA: Zaczęło się od handlu kartami telefonicznymi na dworcu. Skala ta sama, karty droższe.
    - else:
        LADA: Rodzina z Wieniawy, szkoła w Warszawie, kantor w Alchemii. Taki los.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Kurs się zmieni, zanim dojdziesz do schodów. Zawsze się zmienia.
    - seller_voice == 2:
        LADA: Nie trzymaj wszystkiego na jednym chipie. Chipy giną, ludzie też.
    - seller_voice == 3:
        LADA: Licz resztę przy ladzie. Za drzwiami już nikt jej nie odda.
    - else:
        LADA: Wracaj, jak będziesz bogatsza. Albo biedniejsza, też obsłużę.
    }
    -> END

// Clothes shops: KAWAII WEAR, NEONSKIN, NIGHT SILK, SHIBUYA.
=== seller_clothing ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_clothing_1") ->
LADA: Ubrania. Kurtki z siatką, która zatrzymuje deszcz i spojrzenia.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_clothing_2") ->
LADA: Moda z Tokio, szyta na Bronowicach. Nikt nie zauważy.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_clothing_3") ->
LADA: Wszystko w twoim rozmiarze, a jak nie, to dopasuję.
-> talk

= v4
~ seller_voice = 4
-> seller_open("met_seller_clothing_4") ->
LADA: Shibuya w Lublinie. Brzmi głupio, sprzedaje się świetnie.
-> talk

= talk
+ { not seller_goods } [Co dziś nosi ulica? #tone:optional]
    ~ seller_goods = true
    SEKI: Co dziś nosi ulica?
    {
    - seller_voice == 1:
        LADA: Płaszcze odporne na kwaśny deszcz, buty na mokre płyty deptaka, kaptury, pod którymi kamera cię nie pozna.
    - seller_voice == 2:
        LADA: Kurtki z diodami, spódnice z kevlaru, koszulki z napisami, których nie rozumiem i nie chcę rozumieć.
    - seller_voice == 3:
        LADA: Stroje na noc w klubie i na noc na dachu. Ta sama kurtka, inna kieszeń na broń.
    - else:
        LADA: Bluzy z kapturem, w których chłodzenie wszczepów nie paruje. Za dopłatą paruje na różowo.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Na deptaku znowu zbierają podpisy przeciw nowym kamerom. Podpisy zbiera ktoś z kamerą na czole.
    - seller_voice == 2:
        LADA: Młodzi z Czechowa noszą na rękawach nazwę Hebi, żeby nikt ich nie zaczepiał. Hebi to nie bawi.
    - seller_voice == 3:
        LADA: Ochrona galerii dostała nowe mundury. Wyglądają jak Tessen bez naszywek. Może to nie przypadek.
    - else:
        LADA: Idolka z Lubelskiego Festiwalu kupiła tu kurtkę. Od tamtej pory pół Placu Litewskiego chodzi w tej samej.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Połowę towaru szyję po nocach na zapleczu. Druga połowa przyjeżdża z Łodzi i rozpada się po praniu.
    - seller_voice == 2:
        LADA: Kiedyś projekty dla korporacji. Teraz sprzedaję to, czego korporacje nie chcą.
    - seller_voice == 3:
        LADA: Babcia szyła sukienki na Lubartowskiej. Ja szyję kurtki, które przetrwają Lubartowską.
    - else:
        LADA: Sklep jest mój od roku. Wcześniej był kogoś, kto za długo nie płacił Hebi.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Ubierz się ciemno. W tym mieście jasne kolory przyciągają złe oczy.
    - seller_voice == 2:
        LADA: Przymierz następnym razem. Lustro jest szczere, tylko światło kłamie.
    - seller_voice == 3:
        LADA: Nie zakładaj nowego na robotę. Robota lubi brudzić.
    - else:
        LADA: Jak zobaczę cię w moich ciuchach na deptaku, dam rabat.
    }
    -> END

// VR rooms and arcades: DREAMDECK, HOLODROM, ARCADIA.
=== seller_vr ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_vr_1") ->
LADA: Salon VR. Godzina w innym życiu, płatna z góry.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_vr_2") ->
LADA: Gogle są czyste, fotele prawie. Wybierz, kim chcesz być.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_vr_3") ->
LADA: Witaj w arkadzie. Automaty z prawdziwymi przyciskami, gogle dla leniwych.
-> talk

= talk
+ { not seller_goods } [Co dziś grają w goglach? #tone:optional]
    ~ seller_goods = true
    SEKI: Co dziś grają w goglach?
    {
    - seller_voice == 1:
        LADA: Morze, góry, Lublin bez deszczu. To ostatnie schodzi najlepiej.
    - seller_voice == 2:
        LADA: Wyścigi po Krakowskim, randki, wojny. Jest nawet taka, w której się po prostu śpi.
    - else:
        LADA: Stare automaty z Japonii i nowe gogle z Chin. Na jednych grają dziadkowie, na drugich wnuki.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Dzieciaki z Kalinowszczyzny siedzą tu po szesnaście godzin. Rodzice myślą, że w szkole, szkoła myśli, że u rodziców.
    - seller_voice == 2:
        LADA: Na serwerach ktoś puścił program, w którym chodzi się po starym Lublinie, sprzed korporacji. Kasują go co tydzień, a on wraca.
    - else:
        LADA: W zeszłym tygodniu ktoś zemdlał w goglach na trzecim stanowisku. Twierdził potem, że widział wspomnienia, których nie miał.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Gogli prawie nie zakładam. Wystarczy patrzeć na klientów, jak wychodzą.
    - seller_voice == 2:
        LADA: Kiedyś scenariusze do gier, teraz pilnowanie, żeby nikt nie zwymiotował na fotel.
    - else:
        LADA: Rekord na automacie przy drzwiach jest mój. Od jedenastu lat nikt go nie pobił, bo nikt nie gra.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Wracaj, jak ci się tu przestanie podobać. Wszyscy wracają.
    - seller_voice == 2:
        LADA: Uważaj po wyjściu. Prawdziwe schody nie mają poręczy z danych.
    - else:
        LADA: Wpadnij zagrać. Pierwszy żeton na koszt firmy.
    }
    -> END

// Gun shops: HAGANE ARMS, TETSU, OKAMI ARMS (Oyaji's on P3 is a keeper of the story).
=== seller_arms ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_arms_1") ->
LADA: Broń z licencją galerii. Licencję wydaje ochrona, a ochrona kupuje tutaj.
-> talk

= v2
~ seller_voice = 2
-> seller_open("met_seller_arms_2") ->
LADA: Ostrza, lufy, pancerz. Na życzenie pakuję na prezent.
-> talk

= v3
~ seller_voice = 3
-> seller_open("met_seller_arms_3") ->
LADA: Ochrona osobista. Bez pytań o to, przed kim.
-> talk

= talk
+ { not seller_goods } [Co masz do obrony? #tone:optional]
    ~ seller_goods = true
    SEKI: Co masz do obrony?
    {
    - seller_voice == 1:
        LADA: Pistolety, paralizatory, kamizelki. Amunicja tylko z kamizelką, taka polityka.
    - seller_voice == 2:
        LADA: Noże kute w Kraśniku, bo tam jeszcze ktoś umie. Pancerze z demobilu, łatane, ale z certyfikatem.
    - else:
        LADA: Kompaktowe pistolety, które przechodzą przez bramkę w metrze, i takie, które nie muszą.
    }
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    {
    - seller_voice == 1:
        LADA: Hebi tu nie kupują. Kupują u Oyajiego na górze i myślą, że nikt nie wie.
    - seller_voice == 2:
        LADA: Strażnicy Tessen na Nabrzeżu dostali nowe karabiny. Starych nikt nie oddał do magazynu. Ciekawe, gdzie są.
    - else:
        LADA: Kaito z Neon Koi kupuje tu tylko jedną rzecz: ciszę. Tłumiki, żeby było jasne.
    }
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    {
    - seller_voice == 1:
        LADA: Dziesięć lat w wojsku, pięć w ochronie Tessen, rok tutaj. Najspokojniejszy rok.
    - seller_voice == 2:
        LADA: Rusznikarstwo to rodzinny fach. Dziadek naprawiał strzelby myśliwym, ja naprawiam to, czym poluje się na ludzi.
    - else:
        LADA: Od lat nie strzelam. Sprzedaję tym, którzy jeszcze muszą.
    }
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    {
    - seller_voice == 1:
        LADA: Strzelaj tylko, jeśli musisz. Amunicja drożeje.
    - seller_voice == 2:
        LADA: Trzymaj palec z dala od spustu. I od kłopotów.
    - else:
        LADA: Wracaj żywa, to cię znowu obsłużę.
    }
    -> END

// The food hall's KAWA on P3.
=== seller_coffee ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_coffee_1") ->
LADA: Kawa. Prawdziwa, z ziaren z przemytu, i ta druga, z drukarki, dla tych, co nie pytają.
-> talk

= talk
+ { not seller_goods } [Co dziś z garnka? #tone:optional]
    ~ seller_goods = true
    SEKI: Co dziś z garnka?
    LADA: Espresso, flat white, kawa z mlekiem owsianym. Do tego cebularz, bo to jednak Lublin.
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    LADA: Z okien food hallu widać deptak aż po Bramę Krakowską. W nocy liczę, ile neonów zgaśnie przed świtem.
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    LADA: Barista to praca na całe życie albo do pierwszej poparzonej ręki. Na razie mam obie ręce.
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    LADA: Następna kawa mocniejsza. Wyglądasz, jakby była ci potrzebna.
    -> END

// The food hall's THAI on P3.
=== seller_thai ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_thai_1") ->
LADA: Kuchnia tajska na trzecim piętrze lubelskiej galerii. Chili prawdziwe, reszta lokalna.
-> talk

= talk
+ { not seller_goods } [Co dziś z garnka? #tone:optional]
    ~ seller_goods = true
    SEKI: Co dziś z garnka?
    LADA: Pad thai z makaronem ryżowym z Hrubieszowa, curry tak ostre, że zapomnisz o deszczu.
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    LADA: Kucharze z całego food hallu płacą komuś za ochronę. Nie Hebi. Komuś w garniturze, kto nigdy nic nie je.
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    LADA: Matka z Bangkoku, ojciec z Kalinowszczyzny. Kuchnia po matce, humor po ojcu.
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    LADA: Jak będzie za ostre, nie pij wody. Pij mleko kokosowe. Albo płacz.
    -> END

// The food hall's GYROS on P3.
=== seller_greek ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_greek_1") ->
LADA: Gyros, póki mięso jest prawie mięsem.
-> talk

= talk
+ { not seller_goods } [Co dziś z garnka? #tone:optional]
    ~ seller_goods = true
    SEKI: Co dziś z garnka?
    LADA: Gyros z syntetycznej jagnięciny, tzatziki z prawdziwym czosnkiem, frytki z tłuszczu, który pamięta lepsze czasy.
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    LADA: Wieczorem na dziedzińcu w dachu tańczą przy lampionach. Ochrona przymyka oko, bo lampiony kupiła ochrona.
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    LADA: Dziadek przyjechał z Salonik i postawił budkę przy dworcu. Budka stoi do dziś, dziadka już nie ma, rożen ten sam.
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    LADA: Wróć głodna. Tylko tak się tu przychodzi.
    -> END

// The food hall's WOK on P3.
=== seller_wok ===
= v1
~ seller_voice = 1
-> seller_open("met_seller_wok_1") ->
LADA: Wok. Ogień duży, porcje większe, czekanie krótkie.
-> talk

= talk
+ { not seller_goods } [Co dziś z garnka? #tone:optional]
    ~ seller_goods = true
    SEKI: Co dziś z garnka?
    LADA: Smażony makaron, ryż z jajkiem z fermy pionowej na Zemborzycach, warzywa z hydroponiki. Wszystko z jednego woka.
    -> talk
+ { not seller_gossip } [Co słychać w okolicy? #tone:optional]
    ~ seller_gossip = true
    SEKI: Co słychać w okolicy?
    LADA: Kiedy na dole w galerii gaśnie prąd, tu na górze gaz dalej działa. Wtedy cały food hall przychodzi tutaj i nagle wszyscy są przyjaciółmi.
    -> talk
+ { not seller_self } [A ty? Długo za tą ladą? #tone:optional]
    ~ seller_self = true
    SEKI: A ty? Długo za tą ladą?
    LADA: Wok po ojcu, nóż po matce, długi własne.
    -> talk
+ [Wpadnę jeszcze. #tone:leave]
    SEKI: Wpadnę jeszcze.
    LADA: Uważaj na schodach. Po mojej porcji ludzie chodzą wolniej.
    -> END
