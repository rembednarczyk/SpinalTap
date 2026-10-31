// Seki Senshi, M3: act I of the main thread, "Echo".
// Memory flashbacks (recall_<memory>) open on their own once the quest graph unlocks the memory.
// Each flashback ends with exactly one story choice. The domain keeps it (story_choice) and the
// runtime syncs it back into the choice_* variables before every conversation.

VAR choice_case = ""
VAR choice_name = ""
VAR choice_crash = ""
// The ending the recorded choices lead to, computed by core (resolveEnding).
VAR act1_ending = ""
// The ending actually reached, empty until end_act() was applied.
VAR story_ending = ""

EXTERNAL has_memory(id)
EXTERNAL story_choice(choice, option)
EXTERNAL end_act()

=== recall_courier_case ===
The picture tears like a bad signal. For a second you see two places at once.
A loading ramp behind a warehouse on the Bystrzyca. Pouring rain. There's a cuff on your wrist, and chained to it, a case with the Kagami Biotech logo.
REN: Two more blocks and we're square. Don't look inside.
REN: They pay us to not know what we're carrying.
The lock on the case is cheap. A fingernail would do it.
* [You open the case. #tone:main]
    ~ choice_case = "opened"
    ~ story_choice("case", "opened")
    Inside, set in foam, sit rows of memory chips. Each one has a sticker with a name and a date.
    On one of them you see your own name. Before you can read it, Ren slams the lid.
    REN: I told you. Now you'll keep thinking about it.
* [You leave the lock alone. #tone:main]
    ~ choice_case = "sealed"
    ~ story_choice("case", "sealed")
    You carry the case on. It's lighter than it should be. Ren claps you on the shoulder.
    REN: Nice work. A job like this buys us half a year of peace.
- The rain, the ramp and Ren are gone. You're standing on Krakowskie Przedmieście, your hand feeling for the cuff on its own.
Kagami Biotech. The name sits in your head like a splinter. Mori put you back together, so maybe he knows where this comes from.
~ set_flag("recalled:courier_case")
-> END

=== recall_operating_table ===
A white lamp. Not like Mori's. Bigger, with six lenses.
You're strapped to a table and you can't feel your legs. Someone in a coat with the Kagami logo taps at a tablet.
TECH: Recording forty-one. Identity check before overwrite.
TECH: What's your name?
* [You say your name. #tone:main]
    ~ choice_name = "spoken"
    ~ story_choice("name", "spoken")
    SEKI: Aya. My name is Aya.
    TECH: Still remembers. Noting it: overwrite number forty-one failed.
    The name stays in your mouth. Aya. It sounds familiar, like an address where you used to live.
* [You stay silent. #tone:main]
    ~ choice_name = "silent"
    ~ story_choice("name", "silent")
    You clench your teeth. The tech waits a moment and shrugs.
    TECH: No answer. Noting it: subject does not give a name. Proceeding to write.
    You told them nothing. Now you don't even know if you had anything to tell.
- The lamp goes dark. You're in Mori's chair, and he's pulling a needle out from behind your ear.
MORI: You were gone for two minutes. You said something about recordings.
MORI: The module reacts to new chrome. If I put something in you, it might let more out.
~ set_flag("recalled:operating_table")
-> END

=== recall_crash_night ===
The new implant catches a current and something in your head trips like a fuse.
Night, a wet ring road, a hundred sixty on the clock. You're driving someone else's car. On the seat beside you lies a cut wristband with a Kagami code.
A drone hangs over the hood, its spotlight in your eyes.
REN: Can you hear me? Drive straight for the viaduct. Under it, it'll lose the signal. Don't turn.
The voice in the earpiece sounds like Ren. A little too calm.
* [You yank the wheel aside. #tone:main]
    ~ choice_crash = "wheel"
    ~ story_choice("crash", "wheel")
    The car goes sideways into the barrier. The drone was flying too low and hits the pole along with you.
    You remember the screech of metal, and that the call was yours.
* [You drive straight, like he says. #tone:main]
    ~ choice_crash = "ren"
    ~ story_choice("crash", "ren")
    The viaduct comes closer and closer. The drone drops lower and shoots out the tires.
    The last thing you hear before the impact is Ren's voice: recording complete.
- You're standing outside Mori's clinic, holding on to the door frame. The back of your neck is wet with sweat.
That was the night. The wreck on Krakowskie, by Plac Litewski. Now you know how you ended up on this promenade.
~ set_flag("recalled:crash_night")
-> END

=== mori ===
{
- quest_step == "ask_mori" && has_flag("recalled:courier_case"): -> module
- quest_step == "decide" && has_flag("recalled:crash_night"): -> decision
- quest_step == "ren_trail": -> ren_trail
- story_ending == "aya": -> after_aya
- story_ending == "seki": -> after_seki
- quest_step == "find_fixer": -> wake_up
- else: -> small_talk
}

// The opening (ADR-0038, G-034): Seki comes round on Mori's chair; Kaito waits at the bar across the deptak.
= wake_up
The white lamp over the chair shines straight in your eyes. It smells of surgical spirit and burnt chrome.
MORI: Sit up slowly, the stitches on your neck haven't made up their minds yet.
MORI: I pulled three shards of glass out of you, a piece of seat belt and half a meter of someone else's cable. The glass was yours. The cable wasn't.
MORI: Kaito tells everyone I gave you one night. I said you wouldn't survive it for free. He paid.
MORI: He's waiting for you at the Neon Koi, across the promenade. The doors open on their own. Don't kick them, they cost more than you.
-> END

= small_talk
MORI: Something hurts? Good, means it works.
{ quest_step == "new_implant":
    MORI: The module in your head wakes up around new chrome. Buy something, I'll put it in and we'll see what comes out.
}
-> END

= module
MORI: Sit. I can tell from your pupils something came back to you.
SEKI: A case with the Kagami Biotech logo. And a boy, Ren. Where is this coming from?
MORI: From here.
Mori turns the monitor. On the scan of your skull, just behind the ear, glows a rectangle the size of a fingernail.
MORI: It was in there when I put you together. A Kagami memory module, serial number ground off.
MORI: I don't know what's on it. Your life or someone else's. All I know is the longer you walk around with it, the more leaks out.
* [Can you take it out? #tone:main]
    SEKI: Can you take it out?
    MORI: I can. But it's wired into your motor cortex. I'll take it out when you know what you want.
* [How do I know they're my memories? #tone:main]
    SEKI: How do I know these memories are mine?
    MORI: You don't. Neither do I. The module doesn't leave a signature.
- MORI: Lie down. I'll hook up the diagnostics and we'll see what we can pull out of it.
The needle goes in behind your ear. The lamp over the chair is very white.
~ set_flag("mori_module")
-> END

= decision
MORI: Well? You've got the whole thing now, or as much as can be pieced together.
MORI: I can take the module out today. You'll keep what your body learned. The pictures will fade in a few days.
MORI: Or I leave it in and you live with whatever else comes out of it. True or not.
{ act1_ending == "aya":
    -> ending_aya
}
-> ending_seki

= ending_aya
{ choice_case == "opened":
    SEKI: There was a chip with my name in that case. Kagami's keeping the rest of me somewhere.
}
{ choice_name == "spoken":
    SEKI: On that table I told them my name. Forty-one times they tried to erase it and couldn't.
}
{ choice_crash == "wheel":
    SEKI: I got out of that car because I turned the wheel myself. Nobody recorded that for me.
}
SEKI: Leave it in. I'd rather know too much than nothing.
MORI: Your head. If it starts smoking, you know where to find me.
MORI: So what name do I put in your file?
SEKI: Aya.
~ set_alias("Aya")
~ end_act()
You walk out of the clinic. Somewhere in the city Kagami is keeping the rest of your recordings. You're going to get them.
-> END

= ending_seki
{ choice_case == "sealed":
    SEKI: Back then I didn't open that case. I don't have to now either.
}
{ choice_name == "silent":
    SEKI: On that table I didn't give them a name. Maybe I had none to give.
}
{ choice_crash == "ren":
    SEKI: The voice in the earpiece talked like Ren and ended like their machine. I don't know how much of it is mine.
}
SEKI: Take it out. I don't want to live with a recording nobody can check.
MORI: Sensible. Lie down.
Mori lifts the module out with tweezers and drops it into a glass vial. It's smaller than you thought.
MORI: Keeping it?
SEKI: Sell it to someone who likes other people's lives. I'm staying Seki.
~ end_act()
You walk out of the clinic a few grams lighter. Your hands still know how to aim, and for now that's enough.
-> END

= after_aya
MORI: Aya. How's the head? Is the module still leaking, or has it settled down?
-> END

// Act II (m3-lustro.ink): after "seki" he sold the module, after "aya" it talks to her.
= ren_trail
{ story_ending == "seki":
    -> sold
}
MORI: Aya. How's the head? Is the module still leaking, or has it settled down?
* [Someone's talking to me through it. #tone:main]
    SEKI: Someone's talking to me through the module.
    MORI: That happens when a transmitter's close and knows the Kagami frequency. Someone's looking for you, and knows what to look for.
    MORI: Who, I don't know. But Grandma Ume knows more about this street than I do.
* [Nothing. Head's fine. #tone:optional]
    SEKI: Nothing. My head's fine.
    MORI: You lie the same as before the surgery. When it starts hurting, come back.
- -> END

= sold
MORI: The vial's gone. I figure Kaito told you.
* [Who did you sell my module to? #tone:main]
    SEKI: Who did you sell my module to?
    MORI: You told me to sell it yourself. A boy came in, Ren Odagiri. Paid more than the module was worth.
    MORI: Asked if it could be played back without its carrier. I said yes, with a connector and a little patience.
* [You could have told me. #tone:optional]
    SEKI: You could have told me.
    MORI: I could have. But by then the module was just merchandise, and you didn't want to know it.
    MORI: Ren Odagiri bought it. Paid in cash nobody on this street has.
- MORI: He sleeps on the roof over the market on Podzamcze, by the viaduct. He goes up the fire stairs from the stalls.
~ set_flag("ren_trail")
-> END

= after_seki
MORI: The vial's still on the shelf. Nobody wants it. You don't either, do you?
-> END
