// Seki Senshi, ADR-0032: street encounters at Targ pod estakadą (see enc-shinsekai.ink for the rules).

// Kiku reads fortunes from a cracked AR deck. The cards show other people's memories.
=== enc_targ_fortune ===
Między straganami siedzi kobieta w chuście z diodami. Na stoliku leży talia kart AR, jedna pęknięta na pół.
KIKU: Siadaj, dziecko. Karty same mi powiedziały, że przyjdziesz. Albo przyjdzie ktoś w twojej kurtce.
-> ask

= ask
* [Powróż mi. Co widzisz?]
    SEKI: Powróż mi. Co widzisz?
    Kiku odwraca kartę. Hologram pokazuje dach w deszczu i dwie sylwetki przy krawędzi. Karta gaśnie, zanim zdążysz się przyjrzeć.
    KIKU: Dziwne. Ta karta pokazuje przeszłość, a powinna przyszłość. Twoja przeszłość jest jeszcze przed tobą, dziecko.
    ~ set_flag("enc_targ_fortune_read")
    -> END
* [Skąd masz te karty?]
    SEKI: Skąd masz te karty?
    KIKU: Z kontenera Kagami, który spadł z ciężarówki. Każda karta to kawałek czyjegoś wspomnienia. Ja tylko nadaję im znaczenie.
    -> ask
* [Nie wierzę we wróżby.]
    SEKI: Nie wierzę we wróżby.
    KIKU: Karty też w ciebie nie wierzą. Remis. Idź z bogami, albo z kim tam chodzisz.
    -> END

// Daigo's synthetic chicken has escaped. It is worth more than his stall.
=== enc_targ_chicken ===
Między nogami klientów pędzi kura. Kurze pióra błyszczą jak folia, a z kupra wystaje antena.
DAIGO: Łapcie ją! To nie jest zwykła kura, to Kurczak Premium, z licencją!
DAIGO: Znosi jajka z certyfikatem. Bez niej jestem facetem z pustą klatką i długiem w banku.
-> chase

= chase
* [Łapiesz kurę w locie.]
    Rzucasz się. Kura robi unik jak profesjonalistka, ale ląduje ci prosto w rękach i oburzona gdacze binarnie.
    ~ set_flag("enc_targ_chicken_caught")
    ~ change_rep("civilians", 2)
    DAIGO: Moja ty! Proszę, weź jajko. Certyfikat jest w środku. Nie pytaj, jak go tam włożyli.
    -> END
* [Czemu ona ucieka?]
    SEKI: Czemu ona ucieka?
    DAIGO: Bo jest mądrzejsza ode mnie. Firma dała jej ten sam procesor co w kasie fiskalnej.
    -> chase
* [Patrzysz, jak kura wbiega pod estakadę i znika.]
    Kura wskakuje na schody na estakadę i przez chwilę stoi na tle neonów jak na plakacie. Potem jej nie ma.
    ~ set_flag("enc_targ_chicken_free")
    DAIGO: Wolność. Zawsze o niej mówiła. Znaczy, gdakała. Co ja teraz powiem w banku?
    -> END

// Akane pays her late husband's debt to Hebi. This month she is short.
=== enc_targ_debt ===
Przy wschodniej ścianie targu kobieta w fartuchu liczy monety na dłoni. Nad nią stoi chłopak Hebi z tabletem.
POBORCA: Brakuje stu dwudziestu. Twój mąż wiedział, na co się pisze, kiedy pożyczał.
AKANE: Mój mąż nie żyje od roku. Pisał się na wiele rzeczy. Ja na nic się nie pisałam.
-> ask

= ask
* { hebi_stance == "friendly" } [Ona jest ze mną. Daj jej miesiąc.]
    SEKI: Ona jest ze mną. Daj jej miesiąc.
    POBORCA: Skoro ty mówisz. Miesiąc. Ale Kenji się dowie, że to od ciebie.
    ~ set_flag("enc_targ_debt_delayed")
    ~ change_rep("civilians", 2)
    AKANE: Nie wiem, kim jesteś, ale dziękuję. Mam stragan z marynatami, jak coś.
    -> END
* [Kładziesz dłoń na rękojeści. Poborca to widzi.]
    POBORCA: Spokojnie. Ja tylko liczę. Liczenie nie jest karalne.
    POBORCA: Dobra. Zapiszę, że nikogo nie zastałem. Ale to nie koniec, rozumiesz?
    ~ set_flag("enc_targ_debt_scared")
    ~ change_rep("hebi", -3)
    ~ change_rep("civilians", 3)
    AKANE: Wrócą. Ale może za miesiąc, a nie jutro. To już coś.
    -> END
* [Ile on był winien?]
    SEKI: Ile on był winien?
    AKANE: Na początku trzysta. Po roku spłacania jest tysiąc. Hebi mają ciekawą matematykę.
    -> ask
* [Odchodzisz. To nie twoja sprawa.]
    Za plecami słyszysz brzęk monet przesypywanych na tablet.
    -> END

// Riko sings under a hologram of a face that is not quite hers any more.
=== enc_targ_idol ===
Przy północnym rzędzie śpiewa dziewczyna. Nad nią unosi się hologram idolki, która wygląda jak ona, tylko młodsza i szczęśliwsza.
RIKO: Kupisz płytę? Nie mam płyt. Mam kod do pobrania i dobrą wolę.
-> ask

= ask
* [Kto jest na tym hologramie?]
    SEKI: Kto jest na tym hologramie?
    RIKO: Ja. Pięć lat temu, zanim wytwórnia sprzedała moją twarz innej dziewczynie. Ona teraz gra stadiony. Ja targ.
    -> ask
* [Zaśpiewaj tę, którą śpiewałaś przed wytwórnią.]
    SEKI: Zaśpiewaj tę, którą śpiewałaś przed wytwórnią.
    Riko gasi hologram. Śpiewa ciszej, bez podkładu. Kilku straganiarzy przestaje ważyć towar.
    ~ set_flag("enc_targ_idol_song")
    ~ change_rep("civilians", 1)
    RIKO: Nikt mnie o nią nie prosił od pięciu lat. Masz, to ten kod. Prawdziwy.
    -> END
* [Wrzucasz jej coś do puszki i idziesz dalej.]
    RIKO: Dzięki! Wróć jutro, będę tu z tym samym repertuarem i tą samą twarzą.
    -> END
