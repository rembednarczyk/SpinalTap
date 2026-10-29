// Seki Senshi, ADR-0026: the people of Stare Miasto (ex Ulica Kanałowa, ADR-0042) and the market stalls on Podzamcze.
// Small talk with a pinch of rumour: each knot has one question that points at a find or a job
// (the bag behind the dumpster, the car on the highway deck, the Hebi under the footbridge).
// No knot pays or hands out items; trade goes through the shop panel, the rest through flags.

// Hideo, a clerk from the Tessen office on the Bystrzyca. Over the Grodzka footbridge to work, back to SAKE at night.
=== hideo ===
{ civilians_stance == "hostile":
    HIDEO: Nie mam przy sobie pieniędzy. Naprawdę. Proszę iść dalej.
    -> END
}
{
- game_hour >= 2 && game_hour < 7:
    HIDEO: Za cztery godziny autobus, za pięć zmiana. Nie warto się kłaść, a i tak się kładę.
- game_hour >= 7 && game_hour < 19:
    HIDEO: Przepraszam, spieszę się. Zmiana w biurze Tessen zaczyna się wtedy, kiedy kierownik tak powie.
- else:
    HIDEO: Pod SAKE nalewają do pełna i nikt nie pyta, jak minął dzień. Trybunał po drugiej stronie Rynku też nie pyta. Dlatego tu stoję.
}
-> talk

= talk
+ [Co robisz w Tessen? #tone:optional]
    SEKI: Co robisz w Tessen?
    HIDEO: Liczę kontenery, których nie ma. Wpisuję je do systemu, a potem wypisuję. Płacą za to, żebym nie pamiętał.
    -> talk
+ { not has_flag("hideo_bridge") } [Czemu chodzisz górą, przez kładkę? #tone:optional]
    SEKI: Czemu chodzisz górą, przez kładkę?
    ~ set_flag("hideo_bridge")
    HIDEO: Bo pod kładką, na Grodzkiej, stoją Hebi i liczą ludziom portfele. Z góry przynajmniej widać ich z daleka.
    HIDEO: Kaito podobno płaci za takich, co tam handlują. Ja tylko mówię, co widzę.
    -> talk
+ [Trzymaj się. #tone:leave]
    SEKI: Trzymaj się.
    HIDEO: Poręczy. Codziennie rano i codziennie wieczorem.
    -> END

// Tetsu keeps DENKI, the electronics shop on the north kerb.
=== tetsu ===
{ civilians_stance == "hostile":
    TETSU: Roleta w dół. Dla ciebie DENKI jest zamknięte.
    -> END
}
{ not has_flag("met_tetsu"):
    TETSU: Tetsu, DENKI. Naprawiam wszystko, co ma baterię. Ludzi nie, to do Mori.
    ~ set_flag("met_tetsu")
- else:
    TETSU: Znowu ty. Szumi ci jeszcze w głowie? Pytam o implanty, nie o życie.
}
-> talk

= talk
+ [Co słychać na ulicy? #tone:optional]
    SEKI: Co słychać na ulicy?
    { game_hour >= 20 || game_hour < 5:
        TETSU: Pod kładką znowu handlują. Hebi z Hebi, chipy za gotówkę. Kaito płaci za takie wieści, ja oddaję je taniej.
    - else:
        TETSU: Za dnia nic, tylko wycieczki do Archikatedry. Stare Miasto budzi się dopiero po zmroku, jak Mei zapali KARAOKE.
    }
    -> talk
+ { not has_flag("tetsu_alley") } [Coś ciekawego w okolicy? #tone:optional]
    SEKI: Coś ciekawego w okolicy?
    ~ set_flag("tetsu_alley")
    TETSU: Kontener na śmieci pod Bramą Krakowską, od strony deptaka. Kurierzy Hebi chowają tam za nim torby, kiedy ktoś ich goni.
    TETSU: Nie zawsze po nie wracają. Ja nic nie mówiłem.
    -> talk
+ [Na razie. #tone:leave]
    TETSU: Jak coś zacznie iskrzyć, wiesz, gdzie mnie szukać.
    -> END

// Mei sings at KARAOKE from eight in the evening to four in the morning.
=== mei ===
{ civilians_stance == "hostile":
    MEI: Szukaj towarzystwa gdzie indziej.
    -> END
}
{ game_hour >= 20 || game_hour < 4:
    MEI: Przerwa między zestawami. Trzy piosenki o złamanym sercu i jedna o pociągu, bo szef tak lubi.
- else:
    MEI: KARAOKE otwieramy o ósmej wieczorem. Teraz jestem tylko dziewczyną, która nie może zasnąć.
}
-> talk

= talk
+ [Śpiewasz tu co noc? #tone:optional]
    SEKI: Śpiewasz tu co noc?
    MEI: Od trzech lat. Zanim zamknęli piwnice pod Rynkiem, śpiewałam w lochach Trasy Podziemnej za drobne. Akustyka była lepsza.
    -> talk
+ { not has_flag("mei_song") } [Zaśpiewasz coś dla mnie? #tone:optional]
    SEKI: Zaśpiewasz coś dla mnie?
    ~ set_flag("mei_song")
    Mei nuci pod nosem kilka taktów. Melodia brzmi znajomo, choć nie wiesz skąd.
    MEI: Stara piosenka z dachów. Patrzysz, jakbyś ją kiedyś znała. Może znałaś.
    -> talk
+ [Dobranoc. #tone:leave]
    MEI: Dobranoc to się mówi rano. Ale niech będzie.
    -> END

// Sachiko keeps the kiosk at the market gate. She sees everyone who comes in.
=== sachiko ===
{ civilians_stance == "hostile":
    SACHIKO: Gazet nie ma, papierosów nie ma, dla ciebie niczego nie ma.
    -> END
}
{ time_of_day == "night":
    SACHIKO: Kiosk nocny, kochana. Gazety z wczoraj, papierosy z jutra.
- else:
    SACHIKO: Gazety, karty do automatów, zapalniczki. Ramen jest dalej, u Fumiko, ale dopiero od czwartej.
}
-> talk

= talk
+ [Co słychać na targu? #tone:optional]
    SEKI: Co słychać na targu?
    { hebi_stance == "hostile":
        SACHIKO: Hebi o tobie mówią. Nie po imieniu, raczej przekleństwami. Uważaj pod estakadą.
    - else:
        SACHIKO: Hana ma nowy towar, Oyaji stare ceny, a Hebi te same twarze. Nic się tu nie zmienia.
    }
    -> talk
+ { not has_flag("sachiko_car") } [Widziałaś tu coś dziwnego? #tone:optional]
    SEKI: Widziałaś tu coś dziwnego?
    ~ set_flag("sachiko_car")
    SACHIKO: Na estakadzie stoi auto. Ktoś je zostawił w noc blokady i już po nie nie wrócił.
    SACHIKO: Do środka nikt nie zaglądał. Przynajmniej nikt, kto by się przyznał.
    -> talk
+ [Dzięki za wszystko. #tone:leave]
    SEKI: Dzięki za wszystko.
    SACHIKO: Nie dziękuj. Następnym razem coś kup.
    -> END

// Goro sells umbrellas at the east end of the north row.
=== goro ===
{ civilians_stance == "hostile":
    GORO: Parasola dla ciebie nie mam. Moknij.
    -> END
}
{ game_hour >= 8 && game_hour < 22:
    GORO: Parasole, płaszcze, folia na implanty. Tu pada nawet wtedy, kiedy nie pada.
- else:
    GORO: Stragan zamknięty, ale ja nie śpię. Pilnuję, żeby nikt nie pożyczył sobie markizy.
}
-> talk

= talk
+ [Dobrze idzie interes? #tone:optional]
    SEKI: Dobrze idzie interes?
    GORO: Jak pada, sprzedaję. Jak nie pada, opowiadam, że zaraz lunie. W tym mieście zawsze mam rację.
    -> talk
+ { not has_flag("goro_oyaji") } [Długo znasz Oyajiego? #tone:optional]
    SEKI: Długo znasz Oyajiego?
    ~ set_flag("goro_oyaji")
    GORO: Trzydzieści lat handlujemy na tym targu. On naprawia, ja sprzedaję, obaj płacimy Hebi. Sąsiedzka przyjaźń.
    -> talk
+ [Muszę lecieć. #tone:leave]
    GORO: Weź parasol następnym razem. Mówię poważnie.
    -> END

// Kenta fries okonomiyaki in the north row, under the OKONOMI sign.
=== kenta ===
{ civilians_stance == "hostile":
    KENTA: Płyta jest gorąca, a ja mam łopatkę. Lepiej idź.
    -> END
}
KENTA: Okonomiyaki! Kapusta, ciasto, sos i co tylko chcesz. Z mięsem drożej, bo mięso jest prawie prawdziwe.
-> talk

= talk
+ [Prawie prawdziwe? #tone:optional]
    SEKI: Prawie prawdziwe?
    KENTA: Prawdziwie jakieś. Ja nie pytam dostawcy, dostawca nie pyta mnie.
    -> talk
+ { not has_flag("kenta_overpass") } [Co jest na estakadzie? #tone:optional]
    SEKI: Co jest na estakadzie?
    ~ set_flag("kenta_overpass")
    KENTA: Wiatr, pył i czujka Hebi, która w nocy krąży wokół filarów. Od blokady nikt tam nie jeździ.
    KENTA: Ludzie wchodzą schodami od zachodu, żeby popatrzeć na miasto. Albo żeby czegoś poszukać.
    -> talk
+ [Innym razem. #tone:leave]
    KENTA: Płyta będzie gorąca. Zawsze jest.
    -> END

// Fumiko's ramen stall, the market's food shop: 16:00 to 4:00. The shop panel opens first;
// "Porozmawiaj z Fumiko" leads here. The rest of the day the schedule swaps in `fumiko_closed`.
=== fumiko ===
{ civilians_stance == "hostile":
    FUMIKO: Zjesz gdzie indziej. U mnie siadają ludzie, którzy nie strzelają przy jedzeniu.
    -> END
}
{ not has_flag("met_fumiko"):
    FUMIKO: Fumiko. Ramen od czwartej po południu do czwartej rano. Kto je u mnie, ten nie choruje. Prawie nikt.
    ~ set_flag("met_fumiko")
}
{ civilians_stance == "friendly":
    FUMIKO: Siadaj, siadaj. Dla ciebie dolewka bulionu gratis, tylko nie mów nikomu na targu.
- else:
    FUMIKO: Tonkotsu albo yakitori. Innego menu nie ma i nie będzie.
}
-> talk

= talk
+ [Ramen naprawdę leczy? #tone:optional]
    SEKI: Ramen naprawdę leczy?
    FUMIKO: Głód i zmęczenie. Na kule weź apteczkę od Mori. Moim się nie opatrzysz w biegu, trzeba usiąść i zjeść.
    -> talk
+ { not has_flag("fumiko_night") } [Czemu otwierasz dopiero po południu? #tone:optional]
    SEKI: Czemu otwierasz dopiero po południu?
    ~ set_flag("fumiko_night")
    FUMIKO: Za dnia ludzie jedzą w biurach, a w nocy ci, którzy biur nie mają. Ci drudzy płacą gotówką i mniej narzekają.
    -> talk
+ [Wrócę głodna. #tone:leave]
    SEKI: Wrócę głodna.
    FUMIKO: Wszyscy wracają. Garnek stoi do czwartej rano.
    -> END

=== fumiko_closed ===
{ civilians_stance == "hostile":
    FUMIKO: Zamknięte. I wieczorem też nie wracaj.
    -> END
}
FUMIKO: Garnek wystygł, palnik zimny. Otwieram o czwartej po południu.
{ game_hour >= 4 && game_hour < 8:
    FUMIKO: Jestem po nocy na nogach. Daj mi chwilę spokoju, dobrze?
}
-> END
