// Seki Senshi, M3: act II of the main thread, "Lustro" (ADR-0023).
// Starts right after act I. The opening and Ren's first words follow the act-I ending (story_ending)
// and choices (choice_case, choice_crash). The domain keeps every choice (story_choice) and the
// runtime syncs them back into the choice_* variables before every conversation. The act-II
// ending follows from choice_archive; end_act2() asks the sim to resolve it.

VAR choice_rooftop = ""
VAR choice_voice = ""
VAR choice_job = ""
VAR choice_archive = ""
// The act-II ending actually reached, empty until end_act2() was applied.
VAR act2_ending = ""
VAR kagami_stance = "neutral"

EXTERNAL end_act2()

// Plays on its own once act I is over (pendingScene in core).
=== act2_opening ===
{ story_ending == "aya":
    -> module_voice
}
-> sold_module

= module_voice
Outside the clinic doors the module behind your ear starts to hiss. First like rain, then like a radio between stations.
REN: Aya? If you can hear this, you're still wearing it. Don't tune out, please.
{ choice_crash == "ren":
    The same voice as in the earpiece that night. Only now it's shaking.
}
REN: Kagami listens on this channel too, so I'll keep it short. I'm alive. I've got something that belongs to you.
REN: Grandma Ume knows where to find me. Don't tell anyone else.
The hiss cuts off mid-word. It leaves a headache behind, and a name: Ren.
~ set_flag("seen:act2_opening")
-> END

= sold_module
A message from Kaito blinks on your optics. Short, like always when it's something important.
KAITO: Mori sold the vial with your module. It didn't sit on the shelf long.
KAITO: A boy with a Hebi snake on his neck bought it. Paid cash and asked if you're still alive.
{ choice_crash == "ren":
    A Hebi snake on his neck. Ren had a tattoo like that. Ren, whose voice led you under the viaduct.
}
You told them to sell the module to someone who likes other people's lives. Someone bought it within a day.
~ set_flag("seen:act2_opening")
-> END

// Ren Odagiri on the low roof over the market on Podzamcze (present from ren_trail until the "kagami" ending).
=== ren_odagiri ===
{
- act2_ending == "street": -> after_street
- act2_ending == "hebi": -> after_hebi
- quest_step == "meet_ren": -> first_meeting
- quest_step == "overpass" && choice_archive != "" && cleaners_down(): -> finale
- quest_step == "overpass" && has_flag("kagami_ambush"): -> under_fire
}
-> waiting

= first_meeting
Under a tarp strung between the antennas sits a skinny boy. A Hebi snake is tattooed on the back of his neck.
{ story_ending == "aya":
    REN: Aya. You came after all. I was afraid Kagami would find you first.
- else:
    REN: Mori said you didn't want to remember any of this. And yet here you are.
    Ren turns a glass vial in his fingers. Inside lies your module.
}
- (talk)
* { choice_crash == "ren" } [I heard your voice that night. #tone:lifepath]
    SEKI: That night I heard your voice in my earpiece. You told me to drive straight.
    REN: I know what you heard. I was lying in a Kagami van with a bag over my head. Nobody gave me a mic.
    -> talk
* { choice_crash == "wheel" } [I remember the crash. I turned. #tone:lifepath]
    SEKI: I remember the crash. I turned the wheel myself.
    REN: And that's why you're alive. The drone was meant to steer you under the viaduct. Their crew was waiting there.
    -> talk
* { choice_case == "opened" } [I saw a chip with my name. #tone:lifepath]
    SEKI: I saw a chip with my name on it. In that case.
    REN: I took it out before they took the case off us. I've carried it with me for two years.
    -> talk
* { choice_case == "sealed" } [I never looked in that case. #tone:lifepath]
    SEKI: I never looked inside that case.
    REN: I did. Fifty chips, a name on every one. One of them was yours.
    -> talk
* [What do you want from me? #tone:main]
    SEKI: What do you want from me?
    REN: I want to give you something back. And ask for help, because I can't do this alone anymore.
    -> offer

= offer
REN: Kagami recorded you before they started overwriting. Recording zero. You from before the table and before the crash.
Ren takes a foil-wrapped chip from his pocket. The sticker reads Aya, and a date from two years ago.
{ story_ending == "aya":
    REN: The module behind your ear will read it. Just hold it close.
- else:
    REN: I've got the module here, and there's a connector in the vial. I'll cable you in for a few minutes. Mori said it's safe.
}
REN: The rest of the archive is with me. Kagami wants it back and put a contract out on me. Kaito's holding it.
* [Give me that chip. #tone:main]
    SEKI: Give me that chip. I want to know who I was.
    REN: Sit down. The first time always makes your head spin.
* [How do I know it's real? #tone:main]
    SEKI: How do I know this recording is real?
    REN: You don't. But it's the only recording Kagami didn't get to fix.
- The chip is warm from his pocket. Something trips behind your ear.
~ set_flag("met_ren")
-> END

= waiting
{ quest_step == "kaito_job":
    REN: Go see Kaito. I want to know how much I'm worth to them.
- else:
    REN: Kurosawa's waiting on the viaduct. Whatever you decide, I'll be here.
}
-> END

= under_fire
REN: I can hear the shooting from here. Kurosawa brought people. Come back when it's over.
-> END

= finale
{ choice_archive == "street":
    REN: Sounded like you and Kurosawa didn't come to terms.
    SEKI: The archive goes back to the people they recorded. Ume will know who those names belong to.
    REN: Some of them are dead already. Some won't want to remember.
- else:
    REN: Kurosawa doesn't like being told no. You could hear it all the way here.
    SEKI: The archive stays with you. Sell it through the Hebi or whoever you want, just not Kagami.
    REN: The Hebi will pay well. People will pay even better to buy back their own memories. I know how that sounds.
}
{ choice_voice == "listened":
    SEKI: You sold them your voice, Ren. I heard it in the earpiece.
    REN: A year before that run, for a thousand eddies. They said it was for an ad. I didn't know what they'd use it for.
}
{ choice_rooftop == "together":
    REN: I promised you the sea. It's still out there, just so you know.
- else:
    REN: You said you'd drive alone. I was on the channel anyway.
}
{ story_ending == "aya":
    REN: And watch that module. Kagami knows where to look for it now.
- else:
    Ren hands you the vial with the module. You don't know yet what you'll do with it.
}
~ end_act2()
{ choice_archive == "street":
    You climb down from the roof with a case full of other people's lives. Every chip has someone's name and someone's address.
- else:
    You climb down from the roof with half the pay in your pocket. Behind you, Ren is already calling the Hebi.
}
-> END

= after_street
REN: Ume goes door to door with the chips. Some cry, others slam the door in her face.
-> END

= after_hebi
REN: The Hebi are already taking orders. You know what someone will pay for the memory of their own wedding?
-> END

=== function cleaners_down() ===
~ return has_flag("dead:kagami-cleaner-1") && has_flag("dead:kagami-cleaner-2") && has_flag("dead:kagami-cleaner-3")

// Kurosawa of Kagami on the al. Tysiąclecia viaduct deck (present from kagami_job until the ambush or the ending).
=== kurosawa ===
{ quest_step == "overpass" && choice_archive == "":
    -> deal
}
KUROSAWA: I'm waiting for someone. Please don't block my view.
-> END

= deal
KUROSAWA: Kurosawa, Kagami Biotech, recovery division. I know who you are. We know it better than you do.
{ choice_job == "taken":
    KUROSAWA: Kaito said you accepted the job. That makes this simpler.
- else:
    KUROSAWA: Kaito said you turned it down. And yet here you are.
}
{ story_ending == "aya":
    KUROSAWA: The module in your head belongs to us. For now, let it stay where it is.
- else:
    KUROSAWA: You had our module taken out and sold. Odagiri bought it, so it will come back to us along with him.
}
KUROSAWA: The offer is simple. Odagiri and the archive for us. For you, the full recording from before the table. Childhood, mother, name.
{ choice_voice == "listened":
    You know that tone. The tech in the earpiece sounded just as bored when he switched off the Odagiri filter.
}
- (ask)
* [How much of it is true? #tone:optional]
    SEKI: How much of that recording is true?
    KUROSAWA: As much as you like. What's true is what you remember.
    -> ask
* { choice_voice == "listened" } [Who spoke to me in Ren's voice? #tone:lifepath]
    SEKI: Who spoke to me in Ren's voice that night?
    KUROSAWA: Our technician. Odagiri sold us a voice sample a year earlier. We have a receipt.
    -> ask
* [The archive goes back to the people. #tone:main]
    ~ choice_archive = "street"
    ~ story_choice("archive", "street")
    SEKI: The archive goes back to the people you recorded. Every chip to its owner.
    KUROSAWA: A pity. The recovery division doesn't negotiate twice.
    -> ambush
* [The archive stays with Ren. #tone:main]
    ~ choice_archive = "hebi"
    ~ story_choice("archive", "hebi")
    SEKI: The archive stays with Ren. The Hebi will pay for it more honestly than you.
    KUROSAWA: Honestly. An interesting word from someone who doesn't know whose memories she has.
    -> ambush
* [Take Ren and the archive. I want my recording. #tone:main]
    ~ choice_archive = "kagami"
    ~ story_choice("archive", "kagami")
    SEKI: Take Ren and the archive. I want my recording.
    KUROSAWA: Sensible. Our people will take him off that roof tonight.
    Kurosawa hands you a chip in a white case. It's cold, as if it came out of a fridge.
    { choice_rooftop == "together":
        Ren promised you the sea. Kagami only promises that everything will add up.
    }
    ~ end_act2()
    Kurosawa walks off toward the elevator. He doesn't look back.
    -> END

= ambush
Kurosawa raises two fingers and walks off toward the elevator. From the shaft come people in Kagami vests.
~ set_flag("kagami_ambush")
-> END

// Plays on its own after the "kagami" ending (memory "lustro").
=== recall_mirror ===
The chip from the white case slides in smoothly, as if someone cut it to fit you.
A kitchen with a window on the Bystrzyca. Mother slices fish and hums. School, first job, first run for Kagami.
Everything adds up. Every date, every face. Too neat, like a catalog.
TECH: Recording complete. Carrier accepted the package without rejection.
You don't know if that voice is part of the memory, or if someone is talking to you right now.
~ set_flag("recalled:mirror")
-> END

// Flashback from Ren's chip (memory "dach").
=== recall_rooftop ===
The same roof, two years earlier. It's raining, and the market hums below you.
Ren counts on his fingers money you don't have yet.
REN: Kagami pays for one run what the Hebi pay for a year. A case from the riverside to their lab and we're free.
REN: We go together. You drive, I sit on the channel.
* [You take his hand. #tone:main]
    ~ choice_rooftop = "together"
    ~ story_choice("rooftop", "together")
    You squeeze his hand. It's wet and warm. You laugh like kids who just stole something off a stall.
    REN: Last run. Then the sea, I promise.
* [You say you'll drive alone. #tone:main]
    ~ choice_rooftop = "alone"
    ~ story_choice("rooftop", "alone")
    You tell him one courier draws less attention than two. That's only half the truth.
    REN: Have it your way. But I'll be on the channel anyway, like it or not.
- The rain stops mid-drop. You're sitting on the same roof, and Ren is looking at you like he's waiting for a verdict.
Your body remembers this roof: every edge, every jump to the next one. And how to get up after a fall.
~ set_flag("recalled:rooftop")
-> END

// Flashback after Kaito plays the client's message (memory "głos").
=== recall_last_call ===
The voice from the recording stays in your head and drags another sound after it: the hiss of a cracked radiator.
The wreck on Krakowskie. You're hanging upside down in the belts. The earpiece is still in your ear.
REN: Recording complete. Subject unresponsive.
Ren's voice cuts off, and someone else stays on the line, older and bored.
TECH: Switching off the Odagiri filter. Voice sample voluntary, paid in advance. Collect her before dawn.
* [You keep listening, though it hurts. #tone:main]
    ~ choice_voice = "listened"
    ~ story_choice("voice", "listened")
    You memorize every word. The Odagiri filter. Voluntary sample. Ren sold them his voice before you ever got in that car.
    Maybe he didn't know what they'd use it for. Or maybe he did.
* [You tear the earpiece out. #tone:main]
    ~ choice_voice = "torn"
    ~ story_choice("voice", "torn")
    The earpiece lands in a puddle of oil. You'd rather have silence than one more voice you can't trust.
    All you're left with is the first sentence, spoken in Ren's voice.
- You're standing at the Neon Koi bar. Kaito is watching you, waiting for you to come back.
Your hands have stopped shaking. Now you know what a voice sounds like when someone plants it on you.
~ set_flag("recalled:last_call")
-> END
