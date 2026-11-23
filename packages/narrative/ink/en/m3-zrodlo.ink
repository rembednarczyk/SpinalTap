// Seki Senshi, M3: act III of the main thread, "Źródło" (ADR-0095).
// Starts after act II. The opening and the trail follow the act-II ending (act2_ending): Ume after
// "street", Ren after "hebi", Kurosawa on the Castle after "kagami". The three meet at the archive's
// core by the Trinity Chapel (branch and bottleneck). The act-III ending follows from choice_core;
// end_act3() asks the sim to resolve it, and the epilogue plays on its own afterwards.

VAR choice_core = ""
// The act-III ending actually reached, empty until end_act3() was applied.
VAR act3_ending = ""

EXTERNAL end_act3()

// Plays on its own once act III has started (pendingScene in core).
=== act3_opening ===
{
- act2_ending == "street": -> chips_vanish
- act2_ending == "hebi": -> buyers_gone
}
-> calibration

= chips_vanish
Three nights after the overpass, Ume calls you for the first time in her life. She speaks quietly, as if someone stood behind her door.
UME: Mr Sato is gone. Yesterday Mrs Nowak. Both of them got chips from the archive.
UME: The neighbours saw a white van with no plates. Come over, child. Not on the phone.
~ set_flag("seen:act3_opening")
-> END

= buyers_gone
Ren writes at night. No full stops, no commas, the way he always writes when he's scared.
REN: three hebi buyers stopped answering yesterday
REN: every copy of the archive calls somewhere at night like a lost phone
REN: come to the roof ill show you where
~ set_flag("seen:act3_opening")
-> END

= calibration
The chip from the white case runs warm at night. In the morning a message signed Kagami Biotech waits on your optics.
KUROSAWA: Your recording has a gap. Two days of childhood we cannot rebuild.
KUROSAWA: Calibration today at the Castle. The courtyard, by the Chapel. Please come alone.
The castle hill lights up on your map. You don't remember ever being there. But someone in you does.
~ set_flag("seen:act3_opening")
-> END

// Ume's trail after the "street" ending (diverted to from her knot in m0.ink).
=== zrodlo_ume ===
UME: Sit down. The tea is bitter, there's been no sugar for a week.
UME: Mr Sato listened to his wife's voice every evening. Yesterday his window was shut and he was gone.
UME: The van drove up Zamkowa. Up where Kagami sits now, in the old castle.
{ choice_crash == "wheel":
    UME: You always chose your own road. Choose this one too.
}
* [I'll go to the Castle. #tone:main]
    SEKI: I'll go to the Castle. If they keep them there, the archive's there too.
    UME: Your fights aren't for me. But come back. Someone has to tell me how it ended.
    ~ set_flag("castle_lead")
    -> END
* [I need a moment. #tone:leave]
    SEKI: I need a moment.
    UME: A moment is all those people have. Don't take too long.
    -> END

// Ren's trail after the "hebi" ending (diverted to from his knot in m3-lustro.ink).
=== zrodlo_ren ===
REN: Look. Every chip we sold sends a packet once a night. Always to the same address.
Ren shows you a map on his palm. A dot pulses over the castle hill, over the Chapel.
REN: Kagami isn't getting anything back. The archive never left them. We only carried copies.
{ choice_voice == "listened":
    REN: I know what you're thinking. Yes, my voice is in there too. First drawer, probably.
}
* [I'm going there. #tone:main]
    SEKI: I'm going there. It has to be shut down at the source.
    REN: Hebi won't go up to the Castle, too expensive. Neither will I. Sorry.
    ~ set_flag("castle_lead")
    -> END
* [Not yet. #tone:leave]
    SEKI: Not yet.
    REN: Every night is one buyer fewer. Remember that.
    -> END

// Kurosawa on the Castle's courtyard after the "kagami" ending (present until act III ends).
=== kurosawa_castle ===
{ quest_step == "source_lead":
    -> invite
}
{ quest_step == "chapel" || quest_step == "core_choice":
    KUROSAWA: The archivist is waiting by the Chapel. Let's not keep her waiting.
    -> END
}
KUROSAWA: The Castle is open to you, for now at least.
-> END

= invite
KUROSAWA: On time. I appreciate that.
KUROSAWA: Everything in your recording checks out but one thing. Two days when Aya was seven. A black hole.
KUROSAWA: Our core stands in the Trinity Chapel. Thick walls, frescoes, no signal. The perfect place for a server.
{ choice_job == "taken":
    KUROSAWA: Kaito says you always see things through.
}
- (ask)
* [What happens when you find those two days? #tone:optional]
    SEKI: What happens when you find those two days?
    KUROSAWA: The recording will be complete. A complete recording can be sold. An incomplete one only stored.
    -> ask
* [Lead the way. #tone:main]
    SEKI: Lead the way.
    KUROSAWA: The archivist will plug you in. I'll wait here.
    ~ set_flag("castle_lead")
    -> END

// The archivist of Kagami at the core by the Trinity Chapel's door (from the trail on).
=== kagami_core ===
{
- act3_ending != "": -> after
- quest_step == "chapel": -> plug_in
- quest_step == "core_choice" && has_flag("recalled:chapel"): -> decide
}
ARCHIWISTKA: Please don't touch the cables. The core doesn't like visitors.
-> END

= plug_in
{ act2_ending == "kagami":
    ARCHIWISTKA: Ms Seki. Kurosawa said you'd come. Please sit, the jack is cold.
- else:
    ARCHIWISTKA: Don't shoot. I just keep it from overheating.
    ARCHIWISTKA: Want to see what they keep in here? Go ahead. Nobody asks my opinion anyway.
}
Behind the Chapel's door server racks hum, lined up under the frescoes like pews. The saints watch the LEDs.
ARCHIWISTKA: It's all here. Fifty thousand people. And Aya's original, record zero of the series.
ARCHIWISTKA: Every copy you carry in your head counts from it. You too.
The jack touches your neck. For a moment there is nothing, then the smell of wax and cold stone under your knees.
~ set_flag("core_reached")
-> END

= decide
ARCHIWISTKA: You found those two days. The core doesn't have them and never will.
ARCHIWISTKA: You have the original's clearance. Do what you want with it. I'll look away.
{ act2_ending == "street":
    Ume goes door to door with chips, and this core takes every one of them back.
}
{ act2_ending == "hebi":
    Hebi buyers vanish because their copies call here. Ren is waiting for word.
}
{ act2_ending == "kagami":
    Kurosawa stands on the courtyard. He knows you hold the key now, and he can do nothing.
}
- (ask)
* [What happens to the people in the archive? #tone:optional]
    SEKI: What happens to the people in the archive?
    ARCHIWISTKA: Wipe it and they keep what's in their heads. Let it out and they get everything at once.
    -> ask
* [I'm wiping it all. The original too. #tone:main]
    ~ choice_core = "erase"
    ~ story_choice("core", "erase")
    SEKI: I'm wiping it all. The original too.
    ARCHIWISTKA: Aya will be gone for good. Only you will be left.
    SEKI: It was always only me.
    ~ end_act3()
    The LEDs go dark rack by rack, from the altar to the door. The frescoes stay.
    -> END
* [I'm letting the archive out on the city's net. #tone:main]
    ~ choice_core = "release"
    ~ story_choice("core", "release")
    SEKI: Let the archive out on the city's net. Everyone gets their own.
    ARCHIWISTKA: And other people's. It can't be split cleanly.
    SEKI: Then they'll learn to live with other people's. I did.
    ~ end_act3()
    Over Lublin windows light up one after another, as if the whole city woke from the same dream.
    -> END
* [I'm staying by the core. I decide who gets what back. #tone:main]
    ~ choice_core = "keep"
    ~ story_choice("core", "keep")
    SEKI: I'm staying by the core. I decide who gets what back.
    ARCHIWISTKA: That's how Kurosawa started. Good luck.
    ~ end_act3()
    You sit down under the fresco with the angel. The jack on your neck is warm already.
    -> END

= after
{ act3_ending == "keep":
    ARCHIWISTKA: The core listens to you now. Strange thing to watch.
- else:
    ARCHIWISTKA: The Chapel is quiet again. For the first time in years I can hear the floor creak.
}
-> END

// Plays on its own after the core's first connection (memory "chapel").
=== recall_chapel ===
You are seven. Your mother holds your hand in the Trinity Chapel, and the guide says the frescoes are six hundred years old.
The angel on the wall has the face of the neighbour from the third floor. You laugh too loud and your mother squeezes your hand.
There's no signal in the chapel. Your mother's phone stays silent for two days, while you come back here again and again.
Nobody recorded it and nobody corrected it. It's yours, whatever they say about you.
~ set_flag("recalled:chapel")
-> END

// Plays on its own once act III has ended: what became of everyone, from the choices of all three acts.
=== act3_epilogue ===
{ act3_ending:
- "erase":
    A week later Kagami packs up its office on the Castle. The hill keeps the frescoes and the marks of the racks on the floor.
- "release":
    For a week Lublin dreams other people's dreams. In the Old Town someone cries on a bench, remembering a wedding they never had.
- "keep":
    Kagami doesn't pack up. It only changes the sign on the Chapel's door: "Archive. Entry by permission."
}
{ act2_ending == "kagami":
    Ren never comes back from that night on the roof. Kurosawa sends you flowers, no card.
- else:
    { choice_rooftop == "together":
        Ren calls from the Vistula. He says it isn't the sea, but it'll do for now.
    - else:
        Ren disappears from Alchemia's roof. All he leaves behind is the tarp.
    }
}
{ act2_ending == "street":
    Ume still goes door to door. People open up more often now.
- else:
    Ume asks if it's over. You say yes. She doesn't believe you, but she pours the tea.
}
{ choice_job == "taken":
    Kaito pays you a bonus for a job you never did. He says it's for the trouble.
- else:
    Kaito buys you sake and asks nothing. For the first time.
}
// After "seki" Mori sold the module to Ren (act II): Ren hands it back in the finale, Kagami takes it with him after "kagami".
{
- story_ending == "aya":
    The module behind your ear is silent. The name Aya still sounds strange, but you turn when you hear it now.
- act2_ending == "kagami":
    Your module went back to Kagami along with Ren. You stay Seki, the woman from the wreck.
- else:
    The vial with the module sits on your shelf. You stay Seki, the woman from the wreck.
}
This is the end of the main thread. The city goes on, and Kaito has jobs waiting.
~ set_flag("seen:act3_epilogue")
-> END
