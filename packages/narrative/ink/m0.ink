// Seki Senshi, M0: "Pierwsze zlecenie".
// Speaker prefix convention: "KAITO: ...", "SEKI: ...", "UME: ...". Lines without a prefix are narration.
// Variables below are synced from the domain before each conversation (see narrative-runtime.ts).

VAR quest_step = ""
VAR alias = ""
VAR contract_state = ""
VAR contract_site = ""
// The rolled variation of the running contract as one or two sentences (ADR-0032), "" without one.
VAR contract_variation = ""
VAR contracts_done = 0
// Faction stances from the domain: "hostile", "neutral" or "friendly".
VAR fixers_stance = "neutral"
VAR hebi_stance = "neutral"
VAR civilians_stance = "neutral"
VAR clinic_stance = "neutral"

EXTERNAL set_flag(name)
EXTERNAL has_flag(name)
EXTERNAL change_rep(faction, delta)
EXTERNAL set_alias(name)
EXTERNAL unlock_memory(id)
EXTERNAL accept_contract()
EXTERNAL complete_contract()

=== fixer ===
{
- quest_step == "find_fixer": -> first_meeting
- quest_step == "eliminate_courier": -> waiting
- quest_step == "report_back": -> payday
- quest_step == "kaito_job" && not has_flag("kagami_job"): -> ren_job
- else: -> after
}

// The opening (ADR-0038): Seki comes round on the chair in Mori's clinic, Kaito waits by it.
= first_meeting
KAITO: No proszę. Chodzący trup z wraku na Krakowskim.
Biała lampa nad fotelem świeci ci prosto w oczy. Pachnie spirytusem i przypalonym chromem. Ktoś odpina ci pas z nadgarstka.
MORI: Chodzący to za dużo powiedziane. Siadaj powoli, szwy na karku jeszcze się nie zdecydowały.
MORI: Wyciągnąłem z ciebie trzy odłamki szyby, kawałek pasa bezpieczeństwa i pół metra cudzego kabla. Szkło było twoje. Kabel nie.
KAITO: Ripperdoc mówił, że nie przeżyjesz nocy. Pomylił się. Zdarza mu się.
MORI: Mówiłem, że nie przeżyjesz jej za darmo. On zapłacił.
* [Kim jesteś? #tone:main]
    SEKI: Kim ty jesteś?
    KAITO: Kaito. Załatwiam sprawy. A ty, jak słyszę, nie pamiętasz nawet, jak się nazywasz.
* [Co mi się stało? #tone:main]
    SEKI: Co mi się stało?
    KAITO: Wypadek. Twoje auto, czyjś dron, dużo chromu na asfalcie. Resztę musisz sobie przypomnieć sama.
    KAITO: Jestem Kaito, gdybyś pytała. Załatwiam sprawy.
- KAITO: Potrzebujesz imienia. Ulica nie lubi pustych miejsc.
KAITO: Ratownicy mówili, że w tym wraku walczyłaś z pasami jak z wrogiem. Seki Senshi. Wojowniczka z kroniki wypadków.
* [Niech będzie. Seki Senshi. #tone:main]
    ~ set_alias("Seki Senshi")
    ~ change_rep("fixers", 5)
    SEKI: Niech będzie. Na razie.
* [Moje imię gdzieś jest. Odzyskam je. #tone:main]
    ~ set_alias("Seki Senshi")
    SEKI: Moje imię gdzieś jest. Odzyskam je.
    KAITO: Jasne. Do tego czasu jesteś Seki.
- KAITO: Zapłaciłem za twoje łatanie, więc masz dług. U mnie. I zero perspektyw. Ja mam robotę.
KAITO: Kurier gangu Hebi siedzi w podwórku za myjnią, przy Placu Łokietka, na końcu deptaka. Nosi coś, co należy do moich klientów.
KAITO: Zdejmij go. Ma ochronę, więc nie idź tam na spacer. Potem znajdziesz mnie w Neon Koi, po drugiej stronie deptaka.
MORI: Drzwi otwierają się same. Nie kop ich, są droższe od ciebie.
~ set_flag("met_fixer")
-> END

= waiting
KAITO: Kurier dalej oddycha, Seki. Podwórko za myjnią, przy Placu Łokietka.
* [Już idę. #tone:leave]
    -> END
* [Co wiesz o moim wypadku? #tone:optional]
    SEKI: Co wiesz o moim wypadku?
    KAITO: Mniej, niż byś chciała. Więcej, niż powiem za darmo. Najpierw robota.
    -> END

= payday
KAITO: Słyszałem strzały. I ciszę po nich. Lubię taką ciszę.
KAITO: Coś ci się przypomniało, prawda? Widzę po oczach.
* [Pamiętam, jak się strzela. Nie pamiętam skąd. #tone:main]
    SEKI: Pamiętam, jak się strzela. Nie pamiętam skąd.
    KAITO: Mięśnie mają lepszą pamięć niż ludzie. Trzymaj się tego.
    ~ change_rep("fixers", 5)
* [Ile mi płacisz? #tone:main]
    SEKI: Ile mi płacisz?
    KAITO: Tyle, ile wart jest kurier Hebi. Wolisz gadać o pieniądzach niż o wspomnieniach? Zawodowiec. Podoba mi się.
- ~ change_rep("hebi", -15)
~ set_flag("reported_back")
KAITO: Przelew poszedł. Wróć jutro, będzie więcej.
KAITO: I jeszcze jedno, Seki. Ktoś już pytał o kobietę z wraku. Nie tylko ja się tobą interesuję.
-> END

= after
{
- contract_giver == "hana": -> busy_for_hana
- contract_state == "cleared": -> contract_payday
- contract_kind == "delivery": -> delivery_running
- contract_state == "active": -> contract_running
- else: -> contract_offer
}

= contract_offer
{ contracts_done == 0:
    KAITO: Hebi nie wybaczą ci kuriera. To znaczy, że będą się kręcić po Krakowskim. A ja mam klientów, którzy płacą za ciszę.
- else:
    KAITO: Hebi znowu wystawili ludzi na moją ulicę. Robota czeka, {alias}.
}
{
- hebi_stance == "hostile":
    KAITO: Hebi rozpuścili wieść, że strzelają do ciebie bez gadania. Omijaj zaułki, jeśli nie masz w nich roboty.
- hebi_stance == "friendly":
    KAITO: Podobno Hebi już do ciebie nie strzelają. Nie przyzwyczajaj się.
}
{ fixers_stance == "friendly":
    KAITO: Klienci o ciebie pytają. Dla swoich mam lepsze stawki.
}
{
- act2_ending == "kagami" && not has_flag("kaito_after_act2"):
    KAITO: Kagami zapłaciło za Rena co do eddie. Nie pytam, jak się z tym czujesz.
    ~ set_flag("kaito_after_act2")
- (act2_ending == "street" || act2_ending == "hebi") && not has_flag("kaito_after_act2"):
    KAITO: Kagami zerwało ze mną umowę przez twój numer na estakadzie. Dobrze, że Hebi i ulica płacą w gotówce.
    ~ set_flag("kaito_after_act2")
}
{ contracts_done >= 1 && not has_flag("met_hana"):
    KAITO: Na targu pod estakadą handluje Hana. Bierze ode mnie towar, a czasem szuka kogoś, kto umie strzelać.
}
-> contract_menu

// The choices alone: side questions come back here without repeating Kaito's opening lines.
= contract_menu
+ [Biorę robotę. #tone:main]
    SEKI: Biorę.
    ~ accept_contract()
    KAITO: Lokalizację wysłałem ci na optykę. Wróć, jak będzie po wszystkim.
    -> END
+ { contracts_done >= 1 } [Masz coś do przewiezienia? #tone:main]
    SEKI: Masz coś do przewiezienia?
    ~ offer_contract("delivery")
    KAITO: Chłodzone moduły dla Hany na targu pod estakadą. Jak się nagrzeją, nikt za nie nie zapłaci.
    KAITO: Czas masz na optyce. Oddaj paczkę Hanie i wróć do mnie po pieniądze.
    -> END
+ [Gdzie tu się można podrasować? #tone:optional]
    SEKI: Gdzie tu się można podrasować?
    KAITO: Jeśli chcesz lepszego sprzętu, idź do doktora Mori. Klinika naprzeciwko baru. Bierze gotówkę i nie zadaje pytań.
    -> contract_menu
+ [Nie dziś. #tone:leave]
    KAITO: Twoja strata. Hebi nie biorą wolnego.
    -> END
// Unlocked by the "stół" memory (act I, m3-echo.ink).
* { has_memory("operating_table") } [Co wiesz o Kagami Biotech? #tone:lifepath]
    SEKI: Co wiesz o Kagami Biotech?
    KAITO: Kupują od ludzi wspomnienia i sprzedają je bogatym, którzy chcą coś przeżyć bez ryzyka.
    KAITO: Ich kurierzy dobrze zarabiają. Dopóki nie zaczną pytać, co wiozą.
    -> contract_menu

= contract_running
KAITO: Kontrakt dalej otwarty. Cel: {contract_site}.
{ contract_variation != "":
    KAITO: Jeszcze jedno, zanim pójdziesz. {contract_variation}
}
-> END

// Act II (m3-lustro.ink): the hook from a fixer job into the main thread.
= ren_job
KAITO: Siadaj, {alias}. Mam zlecenie, które ci się nie spodoba.
KAITO: Klient w czystych butach płaci pięć tysięcy za Rena Odagiri i walizkę chipów, którą trzyma. Może być żywy, może nie, byle z walizką.
{ choice_rooftop == "together":
    Pięć tysięcy. Prawie tyle, ile Kagami obiecało wam za tamten kurs.
}
KAITO: Posłuchaj, to ich wiadomość. Przyszła wczoraj.
Kaito puszcza nagranie. Mówi Ren, spokojnie i trochę za równo: przekazanie w nocy, na estakadzie nad targiem.
KAITO: Twój chłopak sam się umawia z Kagami. Albo ktoś mówi jego głosem.
* [Nie poluję na Rena. #tone:main]
    ~ choice_job = "refused"
    ~ story_choice("job", "refused")
    SEKI: Nie poluję na Rena. Znajdź sobie kogoś innego.
    KAITO: Znajdę. Kagami też znajdzie. Ich człowiek, Kurosawa, czeka dziś na estakadzie.
    ~ change_rep("fixers", -3)
* [Biorę. Chcę zobaczyć tego klienta. #tone:main]
    ~ choice_job = "taken"
    ~ story_choice("job", "taken")
    SEKI: Biorę. Chcę zobaczyć tego klienta.
    KAITO: Rozsądnie. Nazywa się Kurosawa i czeka na estakadzie. Tylko nie rób z tego wojny, to mój klient.
    ~ change_rep("fixers", 3)
- ~ set_flag("kagami_job")
-> END

= delivery_running
KAITO: Moduły miały już być u Hany. Targ pod estakadą, za Ulicą Kanałową.
{ contract_time_left > 0:
    KAITO: Zostało ci {contract_time_left} s. Nie stój tu.
}
{ contract_variation != "":
    KAITO: I pamiętaj. {contract_variation}
}
-> END

= busy_for_hana
KAITO: Słyszałem, że robisz coś dla Hany. Skończ u niej, potem pogadamy.
-> END

= contract_payday
{ contract_kind == "delivery":
    KAITO: Hana pisze, że moduły doszły zimne. Tak ma wyglądać każdy kurs.
- else:
    KAITO: Czysta robota. Klienci są zadowoleni, a ja razem z nimi.
}
~ complete_contract()
{ quest_step == "echo_contract":
    KAITO: Hej. Gdzie odpłynęłaś? Patrzysz przeze mnie jak przez szybę.
}
{ contracts_done >= 2:
    KAITO: Zaczynasz mieć opinię, Seki. Ludzie pytają o kobietę z wraku, która nie chybia.
}
-> contract_offer

=== ume ===
{ civilians_stance == "hostile":
    UME: Nie podchodź do mnie. Widziałam, co robisz na tej ulicy.
    -> END
}
// After 23:00 she stands in her doorway (daily schedule, ADR-0017).
{ game_hour >= 23 || game_hour < 6:
    UME: Nie śpisz, dziecko? Ja też nie. W moim wieku noc jest za długa.
}
{ quest_step == "ren_trail":
    -> ren_trail
}
{ act2_ending == "street" && not has_flag("ume_archive"):
    UME: Pani Sato dostała chip z głosem męża. Słucha go co wieczór przy otwartym oknie.
    UME: Nie wiem, czy to jej pomaga. Ale przynajmniej ten głos należy do niej.
    ~ set_flag("ume_archive")
    -> END
}
{ has_flag("ume_memory"):
    UME: Uważaj na siebie na dachach, dziecko. Tak jak kiedyś.
    { has_memory("courier_case") && not has_flag("ume_ren"):
        -> ren
    }
    -> END
}
UME: Widziałam, jak cię wyciągali z tego auta. Myślałam, że już po tobie.
{ quest_step == "find_fixer":
    UME: Kaito przesiedział całą noc u doktora Mori, przy twoim fotelu. Klinika jest po lewej stronie deptaka, bliżej Placu Litewskiego.
}
* [Znałaś mnie wcześniej? #tone:main]
    SEKI: Znałaś mnie wcześniej?
    UME: Każdy cię tu znał. Biegałaś po dachach z tym chłopakiem od Hebi, aż zrobiło się o was głośno.
    UME: Potem zniknęłaś na dwa lata. Aż do wczoraj.
    Przez moment czujesz deszcz na twarzy i krawędź dachu pod stopami.
    ~ unlock_memory("street_runner")
    ~ change_rep("civilians", 5)
    ~ set_flag("ume_memory")
    -> END
* [Muszę iść. #tone:leave]
    -> END
* { has_memory("courier_case") && not has_flag("ume_ren") } [Pamiętasz Rena? #tone:lifepath]
    -> ren_talk

// Unlocked by the "walizka" memory (act I, m3-echo.ink).
= ren
+ [Pamiętasz Rena? #tone:lifepath]
    -> ren_talk
+ [Muszę iść. #tone:leave]
    -> END

// Act II (m3-lustro.ink): Ren is back and hiding.
= ren_trail
{ story_ending == "aya":
    UME: Słyszałaś go, prawda? Masz to wypisane na twarzy.
- else:
    UME: Szukasz kogoś. Widzę, jak patrzysz po dachach.
}
+ [Gdzie znajdę Rena Odagiri? #tone:main]
    SEKI: Gdzie znajdę Rena Odagiri?
    UME: Wrócił tydzień temu. Chudy, zarośnięty, nie przypomina tego chłopaka sprzed dwóch lat.
    UME: Śpi na dachu nad targiem pod estakadą. Wchodzi się schodami pożarowymi od strony straganów.
    { has_flag("ume_ren"):
        UME: Mówiłam ci, że szukał cię pół roku. Teraz to on się ukrywa.
    }
    ~ set_flag("ren_trail")
    ~ change_rep("civilians", 2)
    -> END
+ [Nieważne. #tone:leave]
    UME: Jak zechcesz pogadać, wiesz, gdzie stoję.
    -> END

= ren_talk
SEKI: Pamiętasz chłopaka imieniem Ren? Widzę go we wspomnieniach. Woziliśmy coś razem.
UME: Ren Odagiri, ten od Hebi, z którym biegałaś po dachach. Szukał cię, kiedy zniknęłaś. Pół roku pytał o ciebie każdego na tej ulicy.
UME: Potem przyszli ludzie w czystych butach i też o ciebie pytali. Od tamtej pory nikt Rena nie widział.
~ set_flag("ume_ren")
~ change_rep("civilians", 3)
-> END

// Neon Koi (ADR-0038): the barman behind the counter and the regulars at the tables.
=== koi_barman ===
{ quest_step == "find_fixer":
    BARMAN: Kaito? Nie było go całą noc. Siedział u Moriego, przy jakiejś dziewczynie z wraku.
    -> END
}
BARMAN: Neon Koi. Pijesz albo słuchasz, oba się liczą.
{ hebi_stance == "hostile":
    BARMAN: I nie strzelaj tu do Hebi. Sprzątam po nich częściej niż po klientach.
}
* [Co polecasz? #tone:optional]
    SEKI: Co polecasz?
    BARMAN: Syntetyczną sake. Smakuje jak prawdziwa, jeśli nigdy nie piłaś prawdziwej.
    -> END
* [Nic, dzięki. #tone:leave]
    -> END

=== koi_regular ===
{ civilians_stance == "hostile":
    BYWALEC: Odsuń się. Słyszałem, co robisz na tej ulicy.
    -> END
}
{ has_flag("reported_back"):
    BYWALEC: To ty zdjęłaś tego kuriera spod myjni? Postawiłbym ci drinka, ale Hebi mają tu uszy.
- else:
    BYWALEC: Jukebox gra trzy kawałki na krzyż i przyśpiewkę Motoru. Ta ostatnia jest najgłośniejsza, zwłaszcza po meczu.
}
-> END
