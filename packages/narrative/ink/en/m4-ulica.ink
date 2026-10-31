// Seki Senshi, ADR-0026: the people of Stare Miasto (ex Ulica Kanałowa, ADR-0042) and the market stalls on Podzamcze.
// Small talk with a pinch of rumour: each knot has one question that points at a find or a job
// (the bag behind the dumpster, the car on the al. Tysiąclecia viaduct, the Hebi under the Grodzka footbridge).
// No knot pays or hands out items; trade goes through the shop panel, the rest through flags.

// Hideo, a clerk from the Tessen office on the Bystrzyca. Over the Grodzka footbridge to work, back to SAKE at night.
=== hideo ===
{ civilians_stance == "hostile":
    HIDEO: I don't have any money on me. Really. Please keep walking.
    -> END
}
{
- game_hour >= 2 && game_hour < 7:
    HIDEO: Bus in four hours, shift in five. Not worth lying down, and I lie down anyway.
- game_hour >= 7 && game_hour < 19:
    HIDEO: Sorry, I'm in a hurry. A shift at the Tessen office starts whenever the manager says so.
- else:
    HIDEO: At SAKE they pour to the brim and nobody asks how your day went. The Trybunał across the Rynek doesn't ask either. That's why I stand here.
}
-> talk

= talk
+ [What do you do at Tessen? #tone:optional]
    SEKI: What do you do at Tessen?
    HIDEO: I count containers that don't exist. I log them into the system, then I log them out. They pay me to forget.
    -> talk
+ { not has_flag("hideo_bridge") } [Why take the footbridge? #tone:optional]
    SEKI: Why do you go over the top, across the footbridge?
    ~ set_flag("hideo_bridge")
    HIDEO: Because under the footbridge, on Grodzka, the Hebi stand around counting people's wallets. From up top at least you see them coming.
    HIDEO: Kaito supposedly pays for the ones dealing down there. I'm just saying what I see.
    -> talk
+ [Take care. #tone:leave]
    SEKI: Take care.
    HIDEO: Of the handrail. Every morning and every evening.
    -> END

// Tetsu keeps DENKI, the electronics shop on the north kerb.
=== tetsu ===
{ civilians_stance == "hostile":
    TETSU: Shutter's down. For you, DENKI is closed.
    -> END
}
{ not has_flag("met_tetsu"):
    TETSU: Tetsu, DENKI. I fix anything with a battery. Not people, that's Mori.
    ~ set_flag("met_tetsu")
- else:
    TETSU: You again. Still buzzing in your head? I mean the implants, not your life.
}
-> talk

= talk
+ [What's the word on the street? #tone:optional]
    SEKI: What's the word on the street?
    { game_hour >= 20 || game_hour < 5:
        TETSU: They're dealing under the footbridge again. Hebi to Hebi, chips for cash. Kaito pays for news like that, I give it away cheaper.
    - else:
        TETSU: By day, nothing, just tours to the Archikatedra. Stare Miasto only wakes up after dark, when Mei lights up KARAOKE.
    }
    -> talk
+ { not has_flag("tetsu_alley") } [Anything interesting nearby? #tone:optional]
    SEKI: Anything interesting around here?
    ~ set_flag("tetsu_alley")
    TETSU: The dumpster under Brama Krakowska, on the promenade side. Hebi couriers stash bags behind it when someone's on their tail.
    TETSU: They don't always come back for them. You didn't hear it from me.
    -> talk
+ [See you. #tone:leave]
    TETSU: If anything starts sparking, you know where to find me.
    -> END

// Mei sings at KARAOKE from eight in the evening to four in the morning.
=== mei ===
{ civilians_stance == "hostile":
    MEI: Go find company somewhere else.
    -> END
}
{ game_hour >= 20 || game_hour < 4:
    MEI: Break between sets. Three songs about broken hearts and one about a train, because the boss likes it.
- else:
    MEI: KARAOKE opens at eight in the evening. Right now I'm just a girl who can't sleep.
}
-> talk

= talk
+ [You sing here every night? #tone:optional]
    SEKI: You sing here every night?
    MEI: Three years now. Before they shut the cellars under the Rynek, I sang in the Trasa Podziemna vaults for spare change. Better acoustics.
    -> talk
+ { not has_flag("mei_song") } [Sing something for me? #tone:optional]
    SEKI: Will you sing something for me?
    ~ set_flag("mei_song")
    Mei hums a few bars under her breath. The tune sounds familiar, though you don't know from where.
    MEI: An old song from the rooftops. You look like you used to know it. Maybe you did.
    -> talk
+ [Good night. #tone:leave]
    MEI: You say good night in the morning. But fine.
    -> END

// Sachiko keeps the kiosk at the market gate. She sees everyone who comes in.
=== sachiko ===
{ civilians_stance == "hostile":
    SACHIKO: No papers, no cigarettes, nothing for you.
    -> END
}
{ time_of_day == "night":
    SACHIKO: Night kiosk, sweetheart. Yesterday's papers, tomorrow's cigarettes.
- else:
    SACHIKO: Papers, slot cards, lighters, yesterday's cebularze. Ramen's further on, at Fumiko's, but not till four. For zapiekanki, go up by the Brama.
}
-> talk

= talk
+ [What's new at the market? #tone:optional]
    SEKI: What's new at the market?
    { hebi_stance == "hostile":
        SACHIKO: The Hebi talk about you. Not by name, more in curses. Watch yourself under the viaduct.
    - else:
        SACHIKO: Hana's got new stock, Oyaji old prices, and the Hebi the same faces. Nothing ever changes here.
    }
    -> talk
+ { not has_flag("sachiko_car") } [Seen anything odd here? #tone:optional]
    SEKI: Have you seen anything strange around here?
    ~ set_flag("sachiko_car")
    SACHIKO: There's a car parked on the viaduct over Tysiąclecia. Someone left it the night of the blockade and never came back for it.
    SACHIKO: Nobody's looked inside. At least nobody who'd admit it.
    -> talk
+ [Thanks for everything. #tone:leave]
    SEKI: Thanks for everything.
    SACHIKO: Don't thank me. Buy something next time.
    -> END

// Goro sells umbrellas at the east end of the north row.
=== goro ===
{ civilians_stance == "hostile":
    GORO: No umbrella for you. Get wet.
    -> END
}
{ game_hour >= 8 && game_hour < 22:
    GORO: Umbrellas, raincoats, implant wrap. Here it rains even when it doesn't.
- else:
    GORO: The stall's closed, but I'm not asleep. Making sure nobody borrows my awning.
}
-> talk

= talk
+ [Business good? #tone:optional]
    SEKI: Business good?
    GORO: When it rains, I sell. When it doesn't, I tell people it's about to pour. In this city I'm always right.
    -> talk
+ { not has_flag("goro_oyaji") } [Known Oyaji long? #tone:optional]
    SEKI: Have you known Oyaji long?
    ~ set_flag("goro_oyaji")
    GORO: Thirty years we've traded at this market. He fixes, I sell, we both pay the Hebi. Neighborly friendship.
    -> talk
+ [Gotta run. #tone:leave]
    GORO: Take an umbrella next time. I mean it.
    -> END

// Kenta fries okonomiyaki in the north row, under the OKONOMI sign.
=== kenta ===
{ civilians_stance == "hostile":
    KENTA: The griddle's hot, and I've got a spatula. Better move along.
    -> END
}
KENTA: Okonomiyaki! Cabbage, batter, sauce and whatever you like. Meat costs extra, because the meat's almost real.
-> talk

= talk
+ [Almost real? #tone:optional]
    SEKI: Almost real?
    KENTA: Really something. I don't ask the supplier, the supplier doesn't ask me.
    -> talk
+ { not has_flag("kenta_overpass") } [What's up on the viaduct? #tone:optional]
    SEKI: What's up on the viaduct?
    ~ set_flag("kenta_overpass")
    KENTA: Wind, dust and a Hebi lookout drone that circles the pillars at night. Nobody's driven up there since the blockade.
    KENTA: People take the stairs on the west side to look at the Zamek and Stare Miasto. Or to look for something.
    -> talk
+ [Some other time. #tone:leave]
    KENTA: The griddle will be hot. It always is.
    -> END

// Fumiko's ramen stall, the market's food shop: 16:00 to 4:00. The shop panel opens first;
// "Porozmawiaj z Fumiko" leads here. The rest of the day the schedule swaps in `fumiko_closed`.
=== fumiko ===
{ civilians_stance == "hostile":
    FUMIKO: Eat somewhere else. My seats are for people who don't shoot at dinner.
    -> END
}
{ not has_flag("met_fumiko"):
    FUMIKO: Fumiko. Ramen from four in the afternoon to four in the morning. Whoever eats here doesn't get sick. Almost nobody.
    ~ set_flag("met_fumiko")
}
{ civilians_stance == "friendly":
    FUMIKO: Sit, sit. Free broth refill for you, just don't tell anyone at the market.
- else:
    FUMIKO: Tonkotsu or yakitori. There's no other menu and there won't be.
}
-> talk

= talk
+ [Does ramen really heal? #tone:optional]
    SEKI: Does ramen really heal?
    FUMIKO: Hunger and tiredness. For bullets, get a medkit from Mori. You can't patch up with mine on the run, you have to sit down and eat.
    -> talk
+ { not has_flag("fumiko_night") } [Why open so late? #tone:optional]
    SEKI: Why don't you open until the afternoon?
    ~ set_flag("fumiko_night")
    FUMIKO: By day people eat at their offices, at night it's the ones with no offices. The second kind pay cash and complain less.
    -> talk
+ [I'll be back hungry. #tone:leave]
    SEKI: I'll be back hungry.
    FUMIKO: Everyone comes back. The pot's on till four in the morning.
    -> END

=== fumiko_closed ===
{ civilians_stance == "hostile":
    FUMIKO: Closed. And don't come back this evening either.
    -> END
}
FUMIKO: The pot's gone cold, the burner too. I open at four in the afternoon.
{ game_hour >= 4 && game_hour < 8:
    FUMIKO: I've been on my feet all night. Give me a moment's peace, all right?
}
-> END
