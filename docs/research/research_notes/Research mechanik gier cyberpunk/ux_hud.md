# UX i HUD w grach cyberpunk (C2077, Deus Ex, Watch Dogs 2, Dead Space, Ghostrunner/Ruiner/The Ascent) i wnioski dla Seki Senshi

Notes by the UX/HUD researcher. Language: English with Polish where helpful. Every claim carries a source; inferences for Seki Senshi (React HUD over a Babylon.js canvas, desktop plus touch) are marked as such.

## 1. Cyberpunk 2077 HUD: layout, minimap/GPS, quest tracker, scanner, feedback, notifications, dialogue, loot/vendor/map, and HUD customisation in patches

### Takeaway
C2077 shows both sides. Its contextual elements (health and stamina appear only when relevant, a clear quest log, colour-coded dialogue with a timer bar) were praised. Its launch version was criticised for an overloaded, almost all-red HUD and map, a driving minimap that showed turns too late, constant blinking markers, overlapping phone calls and clunky inventory and vendor flows. Most fixes came as options: 1.3 changed the driving minimap zoom, 2.1 added HUD size and decoration toggles and an untimed Breach Protocol. In practice, the "patterns to copy" are the patched behaviours, not the launch ones.

### Cited Findings
**Layout and density**
- An Interface In Game critique says the HUD suffers from "too much information". It praises health and stamina appearing only when relevant and the memorable RAM silhouette for quickhacks, and it criticises filter-tab icons as too detailed at small sizes and crowded by decorative flourishes. It recommends moving information into diegetic or contextual forms. — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)
- Colour hierarchy: "almost everything shares the same shade of red", which flattens the hierarchy. Yellow and blue are noted as contrasting well on the map. — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)
- Before launch, CDPR said "a lot" of HUD elements would be optional and could be toggled in settings (Marcin Momot, 2018). — [GamingBolt](https://gamingbolt.com/?p=357809); [PC Gamer](https://pcgamer.com/cyberpunk-2077-damage-numbers-can-be-turned-off-a-lot-of-hud-settings-optional)
- UI Coordinator Alvin Liu mentioned a hardcore mode with no markers or indicators showing where things are or enemy levels. — [TechRadar](https://techradar.com/news/cyberpunk-2077-has-a-hardcore-mode-that-says-goodbye-to-ui)
- A CDPR Senior UI Artist's portfolio describes the UI as built on defined rules derived from in-world lore and technology. The hardest case was the military system, which deliberately uses red even though red usually signals danger or malfunction. (The Behance page returned 403 to the fetch, so this rests on the search snippet.) — [Behance](https://www.behance.net/gallery/133185623/Cyberpunk-2077User-Interface-%28Part-2%29)
- GDC Showcase 2023 talk (Arkadiusz Antonik): the UI system was built from scratch to support thousands of independent UI instances in Night City (in-world screens), with performance budgets. Only the abstract was readable. — [GDC Vault](https://gdcvault.com/play/1034160/User-Interface-in-Cyberpunk-2077); [GDC expo news](https://expo.gdconline.com/news/learn-how-cyberpunk-2077-built-its-impressive-ui-gdc-showcase-session)

**Minimap and GPS route line**
- Driving navigation depends on the small top-right minimap ("my eyes are always in the corner of the screen"). At speed, turns appear too late: the arrow sits at the centre, zoom doesn't adapt to speed, and there's no early verbal cue. The suggested fix is a sat-nav layout with the arrow placed lower to show more road ahead. — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)
- Patch 1.3 zoomed the minimap out while driving so the GPS line shows turns earlier. Before that, a "Better Minimap" mod was popular. — [Gameranx](https://gameranx.com/updates/id/251345/article/cyberpunk-2077s-upcoming-patch-1-3-tweaks-the-minimap-and-perk-resets/); [Destructoid](https://www.destructoid.com/cyberpunk-2077s-minimap-actually-works-now-it-only-took-eight-months-lawsuits-and-investor-threats/); [Gamepressure mods](https://www.gamepressure.com/editorials/cyberpunk-2077-the-best-mods-top-modifications-2021-cyberpunk-207/z93cc-3)
- Even after 1.3, players asked for a driving-only minimap option and a show/hide hotkey. — [Steam discussion](https://steamcommunity.com/app/1091500/discussions/0/6252725698200785681)

**Quest tracker and markers**
- Quest information is "easy to read without being obtrusive". Markers, however, are "far too exaggerated" and blink constantly even for minor objectives. They point at the front door, which discourages stealth, climbing or hacking routes, and glowing icons on enemies remove surprise. Suggested fixes: show the objective only in scanner mode, or let the player pin it. — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)

**Scanner (Kiroshi optics)**
- Holding Tab (L1/LB) enters scanner mode. Aiming at an enemy and pressing V (R3) tags it, and tagged enemies keep a yellow on-screen indicator even when out of view. — [Twinfinite](https://twinfinite.net/guides/cyberpunk-2077-tag-enemies-how/)
- The equipped optics implant sets what scanning highlights and within what range. For example, "The Oracle" highlights enemies within about 15–19.5 m, cameras and turrets within 30–39 m and explosives within 22–29 m for 60 s. Zoom scales with tier. Figures differ by source and patch. — [Cyberpunk Wiki: Oracle](https://cyberpunk.fandom.com/wiki/Kiroshi_The_Oracle_Optics); [Cyberpunk Wiki: Clairvoyant](https://cyberpunk.fandom.com/wiki/Kiroshi_Clairvoyant_Optics)
- The critique calls the optics a "wasted opportunity" for a thematic scan display and suggests using them to highlight objectives sparingly and project AR paths (as in Dead Space). — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)

**Damage numbers and hit feedback**
- Settings → Interface has "Damage Numbers Mode" (per hit, running total, or both), "Sticky Damage Numbers" (stay above the enemy) and a separate "Hit Indicator" (an icon on the sight plus a sound). All of them can be turned off. — [Gamepressure](https://www.gamepressure.com/cyberpunk-2077/damage-numbers-how-to-turn-off/z2df35); [Gamepressure: cluttered HUD](https://www.gamepressure.com/cyberpunk-2077/cluttered-hud-what-to-turn-off/z2df4d)

**Notifications and phone**
- At launch, reviewers reported calls arriving mid-conversation, with two conversations overlapping and multiple holo calls talking over each other. — [Tom's Guide](https://www.tomsguide.com/news/cyberpunk-2077-review-roundup); [Yahoo review](https://news.yahoo.com/cyberpunk-2077-review-stunning-trip-163302508.html)
- Repeated NPC calls offering cars are cited as notification overload. All shards (readables) share one icon and "boring blue UI", so a conversation looks the same as generic lore. — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)
- GameSpot reported UI elements staying on screen long after they should, fixed only by reloading. — [Yahoo/GameSpot via review](https://news.yahoo.com/cyberpunk-2077-review-stunning-trip-163302508.html)

**Dialogue UI**
- Yellow (gold) options advance the conversation or quest with no going back. Blue options add context, yet skipping them can fail a quest (e.g. "Happy Together"). Greyed-out options mean an unmet attribute requirement. Icons mark Lifepath, item or hack-based options. — [Gamesatlas](https://gamesatlas.com/articles/cyberpunk-2077-dialogue-colors-options-explained-gold-blue-choices-guide); [Outsider Gaming](https://outsidergaming.com/cyberpunk-2077-dialogue-icons-guide-everything-you-need-to-know/); [Game8](https://game8.co/games/Cyberpunk-2077/archives/314156)
- Timed choices show a red bar above the options. If the player doesn't choose, the conversation moves on anyway. — [Gamesatlas](https://gamesatlas.com/articles/cyberpunk-2077-dialogue-colors-options-explained-gold-blue-choices-guide)

**Inventory, loot, vendor and map**
- Inventory problems: confusing labels ("Inventory" shows the portrait while items live in "Backpack"), cyberware hidden behind a small bottom-left button, quickhacks buried deeper, no bulk Keep/Sell/Dismantle tags beyond "Sell Junk", a long hold to dismantle, equipped items reshuffling during bulk actions, a stack-selling slider with no "Sell stack" or max default, tiny clothing previews and no try-on, sorting clothing by DPS instead of armour, and no table or list view for comparing stats. — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)
- Map: dark red monochrome, roads hidden by tall buildings, "overloaded with icons and no reason to care about any of them", and no distinction between districts. Suggestions: reveal points of interest gradually and add heat maps (crime, gangs). Fast-travel points are so common that they "might as well just be a button on the map". — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique); a review says the map "bristles with more icons than you know what to do with" — [Yahoo](https://news.yahoo.com/cyberpunk-2077-review-stunning-trip-163302508.html)
- PC controls: no custom binds for Journal, Map or Character at the time of the critique, a bulky square cursor, and jittery mouse sliders. — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)

**HUD customisation in patches (1.x → 2.x)**
- Patch 2.1 (Dec 2023) added a separate Accessibility tab with larger text, larger HUD elements, removal of HUD visual effects (chromatic aberration, lens distortion, ghosting), removal of decorative HUD elements, a toggle to remove the Breach Protocol timer, a toggle for cyberware arming, and DualSense trigger intensity. Existing options were also moved there: colourblind modes (protan/deutan/tritan), subtitles (cinematic, radio, overhead, with size and background opacity), aim assist, reduced camera motion ("additive camera motion"), a centre dot and a weapon-sway option. — [Can I Play That](https://caniplaythat.com/2023/12/05/cyberpunk-2077-patch-2-1-adds-accessibility-features-and-menu/); [Game8](https://game8.co/games/Cyberpunk-2077/archives/435698); [Yahoo patch list](https://sg.news.yahoo.com/every-change-cyberpunk-2077s-last-143000318.html)
- Irony noted by the same article: the patch-notes page itself used banners with moving glitch effects that could affect photosensitive players. — [Can I Play That](https://caniplaythat.com/2023/12/05/cyberpunk-2077-patch-2-1-adds-accessibility-features-and-menu/)
- 2.0 reworked police (pursuit depends on the NCPD wanted level, with MaxTac at the top), cyberware capacity and quickhacks (queueing several hacks on one target, Overclock paid with health). The patch notes list "UI and UX improvements" without HUD specifics. — [PC Gamer 2.0](https://pcgamer.com/cyberpunk-2077-2-0-patch-breakdown); [CD PROJEKT RED](https://cyberpunk.net/en/news/49060/update-2-0); [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes)

### Inferences
- For Seki Senshi, use a contextual HUD: health shows only after damage or below a threshold, and ammo shows only with a weapon drawn. This is the part of C2077 that was praised, and it's cheap in React (CSS opacity transitions).
- Use a minimap with dynamic zoom (more zoomed out while moving fast), the player arrow placed in the lower third, and a route polyline. That fixes the most-cited C2077 problem, and the camera framing is trivial to change.
- Use a single notification queue with priorities that never overlaps dialogue (block or postpone calls and toasts while a dialogue is open). This prevents the overlapping-calls bug.
- Use hierarchy colour tokens: main objective (yellow), optional (blue), danger (red), loot rarity. Avoid "everything red", and pair every colour with an icon or shape for colourblind players.
- Use a timer bar on dialogue choices with an "untimed" option in settings (like the 2.1 Breach Protocol toggle). Mark key options with an icon, not colour alone.
- Inventory: clear tab labels, cyberware one click from the character screen, bulk "sell junk" or tag-to-sell, and a comparison tooltip against the equipped item.
- In settings (React), add: HUD scale, text size, a "reduce decorations/glitch" toggle, a "damage numbers: off/per hit/total" mode, a hit-marker toggle, and per-element HUD toggles. These are cheap and match what CDPR added.

### Gaps
- I couldn't read the content of the GDC 2023 talk or the Behance portfolio (403 and login walls). Only their summaries are available.
- I found no source describing C2077's exact low-health and damage effects (red vignette, glitch, heartbeat) or status-effect icons (bleed, burn, shock). I left these undocumented rather than describe them from memory.
- No reliable source on how bounties and NPC info (Kiroshi "NCPD bounty") appear in the scanner, or on the vendor and loot rarity colour scheme. The rarity tiers (Common to Iconic) are well known but I didn't find a citable source in this session.
- No HUD-specific changes in 2.0 found (the patch notes say only "UI/UX improvements").

## 2. Diegetic UI and in-world interfaces (Deus Ex augmented HUD, Dead Space, holograms, terminals): what is practical in a browser game

### Takeaway
The model examples justify the HUD within the fiction. Jensen's retinal prosthesis (DX:HR) is the HUD. Dead Space puts health on the suit's spine and projects menus as holograms in the world. These solutions were praised for immersion, but diegetic highlighting can also annoy players (the yellow outlines in DX:HR had to become optional). Industry trends and an academic study point toward a contextual or diegetic hybrid, not removing the HUD.

### Cited Findings
- In DX:HR, the HUD is justified by Adam Jensen's eye prosthesis: the HUD doesn't exist until he gets his implants, and taking damage turns the screen red as feedback from the retinal display. — [TV Tropes: Diegetic Interface](https://www.tvtropes.org/pmwiki/pmwiki.php/Main/DiegeticInterface); [Machine Vision UiB](https://machinevisionuib.github.io/machine-vision-situation/deus-ex-human-revolution-retinal-prosthesis)
- Brendan Keogh's analysis (summarised in a blog): in DX:HR, waypoints, health and Jensen's reactions reach the player through a merged point of view, so the player sees what Jensen sees, as usable data. — [This Cage Is Worms](https://thiscageisworms.com/2012/07/10/on-diegetic-huds/)
- DX:HR HUD: a bottom-left minimap with objectives and nearby NPCs. The Smart Vision augmentation shows threats through walls. — [Deus Ex Wiki: HUD](https://deusex.fandom.com/wiki/HUD_(DXHR)); [Deus Ex Wiki: Smart Vision](https://deusex.fandom.com/wiki/Smart_Vision_(DXMD))
- After community complaints, Eidos Montreal made the yellow "augmented reality" object highlighting and the objective arrows optional, because they broke immersion for many fans. — [PC Gamer](https://www.pcgamer.com/deus-ex-human-revolution-makes-highlighting-and-objective-arrows-optional/)
- Dead Space (Dino Ignacio, GDC 2013): the RIG's health is a segmented bar along the suit's spine (aqua above 75%, green above 50%, yellow below 50%, red below 25%, blinking near death), with a circular stasis meter beside it. It stays visible thanks to the over-the-shoulder camera. The stated goal was to remove "a wall of safety" between the player and the game. — [Game Developer](https://gamedeveloper.com/design/video-designing-i-dead-space-i-s-immersive-user-interface); [Dead Space Wiki: RIG](https://deadspace.fandom.com/wiki/Resource_Integration_Gear); [HUDs and GUIs](https://www.hudsandguis.com/2012/08/22/dead-space-2-diegetic-interface-design); [VRroom archive](https://archive.vrroom.studio/?p=30438)
- C2077 ran thousands of independent in-world UI instances (screens, holograms) on its own UI system with tight performance budgets. — [GDC Vault](https://gdcvault.com/play/1034160/User-Interface-in-Cyberpunk-2077)
- Rajdhani, Blender and Orbitron also appear diegetically on in-world screens and holograms in C2077, linking the menus to the world. — [Fonts In Use](https://www.fontsinuse.com/uses/60926/cyberpunk-2077-video-game)
- A University of Bonn study (30 GOTY nominees, 2014–2025) found a rising trend toward HUD minimalism, more diegetic and context-dependent information, and minimalist interfaces associated with higher expected immersion and preference. It describes the trend as "selectively surfaced, integrated, state-dependent" information rather than the HUD disappearing. — [Bonndoc, Uni Bonn](https://bonndoc.ulb.uni-bonn.de/xmlui/handle/20.500.11811/14207)

### Inferences
- In Seki Senshi, frame the HUD in the fiction as an "optical implant" (like Jensen or the Kiroshi optics). This justifies the glitch effects on damage, a "boot sequence" in onboarding, and better HUD upgrades as cyberware (e.g. a better minimap or scanner range). The narrative cost is low and the frame ties the HUD to the cyberware system the game already has.
- In the browser, a hybrid is practical. Keep the main HUD in React (accessible, scalable, cheap). Make 2–3 diegetic accents in Babylon: (a) terminals and shop screens as a `DynamicTexture`/`AdvancedDynamicTexture` texture on a mesh, (b) world-space markers (hologram over the target or NPC), (c) a damage effect as a post-process. Full Dead Space-style diegesis (inventory in 3D) is expensive and hurts accessibility (scaling, screen readers) and mobile.
- Diegetic highlights and markers (outlines) should be optional. DX:HR shows that players react badly to a forced "yellow paint".

### Gaps
- I didn't read the DX:HR UI dev diary (PC Gamer coverage of the dev diary exists, but its content wasn't checked).
- No concrete data on the performance cost of in-world UI textures in Babylon.js in this session (that belongs to the rendering team).

## 3. Stealth, hacking and combat feedback: detection indicators, last known position, breach protocol, hit markers, damage numbers, kill feed

### Takeaway
The proven cyberpunk set is a "last known position" silhouette (DX:MD), a matrix hacking minigame with a buffer and a timer that can be turned off (C2077 Breach Protocol), hit markers with sound, and toggleable damage numbers. The key lesson from patches and guidelines is that every time limit and every piece of numeric feedback should be an option.

### Cited Findings
- DX:MD "Stealth Avatar": after detection, the HUD shows Jensen's silhouette at the position enemies last saw him. The "Retinal Imager" upgrade marks it on the Eye-Know retinal HUD. On higher difficulties enemies leave some guards behind, so the marker isn't fully reliable. — [Deus Ex Wiki: Stealth Avatar](https://deusex.fandom.com/wiki/Stealth_Avatar); [SegmentNext](https://segmentnext.com/deus-ex-mankind-divided-augmentations-guide-upgrades-best-augmentations-for-stealth-combat-hacking/)
- In DX:HR the equivalent was a map marker for where enemies are searching. "Last Known Position" is a general stealth pattern (a silhouette or marker at the last seen position). — [Giant Bomb: Last Known Position](https://giantbomb.com/wiki/Concepts/Last_Known_Position)
- Breach Protocol layout: four zones: timer, buffer (its size set by the cyberdeck), list of sequences (daemons) to upload, and the code matrix. Selection alternates between row and column, starting from the top row. You fail when the buffer fills with a wrong sequence or the timer runs out. Up to 4 daemons, and sequences can overlap. — [Cyberpunk Wiki: Breach Protocol](https://cyberpunk.fandom.com/wiki/Breach_Protocol); [PC Gamer](https://pcgamer.com/how-to-cyberpunk-2077-hacking-breach-protocol); [Gamepressure](https://www.gamepressure.com/cyberpunk-2077/hacking/z7c78e)
- The C2077 hacking interface mixes important yellow data with decorative red elements and needs "tighter visual guidelines". — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)
- Patch 2.1 added an option to remove the Breach Protocol timer. — [Can I Play That](https://caniplaythat.com/2023/12/05/cyberpunk-2077-patch-2-1-adds-accessibility-features-and-menu/)
- C2077: damage numbers (per hit, total, both, sticky), a hit indicator (icon plus sound) and damage indicators as separate options. — [Gamepressure](https://www.gamepressure.com/cyberpunk-2077/damage-numbers-how-to-turn-off/z2df35); [PC Gamer](https://pcgamer.com/cyberpunk-2077-damage-numbers-can-be-turned-off-a-lot-of-hud-settings-optional)
- GAG: avoid button-mashing and QTEs, and "Do not make precise timing essential to gameplay – offer alternatives… or a skip mechanism". — [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/)
- Watch Dogs (2013) hacking UI: plain typography and icons drawn from early mobile phones and 8-bit/DOS fonts. WD2 mixes MS-DOS elements with modern graphics, which one reviewer called ugly while another found it more appealing than WD1 (neon, graffiti, 8-bit animations, memes). — [HUDs and GUIs](https://www.hudsandguis.com/2013/07/24/watchdogs-hacking-ui/); [Daily Star](https://www.thedailystar.net/node/1319314); [LevelUp](https://www.levelup.com/xbox-one/reviews/watch-dogs-2/)

### Inferences
- For stealth in Seki Senshi: a detection arc around the crosshair, or an icon above the enemy filling from white through yellow to red (the AI system already has detection states, which only need exposing as an event), plus a "last known position" silhouette rendered as a translucent mesh in Babylon. The silhouette is a strong cyberpunk signal (the implant estimates the enemy's model) and cheap to build.
- For a Breach Protocol-style hacking minigame: it fits well in React (a grid of buttons, keyboard and touch friendly). Requirements: a "no timer" option, targets at least 44–48 px on touch, and colour plus shape/underline for the active row or column. In `sim`, the timer must use `ClockPort` and matrix generation must use `RandomPort` (repo rule).
- Hit marker: a short X-shaped flash plus sound, a distinct variant for kills, all toggleable. Damage numbers default to "off" or "total" (less noise), as an option.
- A kill feed only makes sense in combat with many enemies. In single-player it's better as part of toasts (e.g. "+bounty") than as a separate list. (Inference, no source.)

### Gaps
- No source on stealth indicators in Ghostrunner, Ruiner or The Ascent, or on C2077's detection indicator (the triangle above enemies and its fill). I didn't find a citable description.
- No source on kill feeds in single-player cyberpunk games.

## 4. Typography and visual language of cyberpunk UI (fonts, angular frames, glitch transitions, colour coding)

### Takeaway
C2077 uses a narrow technical grotesque (Rajdhani) as its main UI font, with Orbitron and Blender as accents. Colour follows in-world "systems" (e.g. red for the military system), and frames are rule-based. Its weak points are an overly uniform red and decoration that hurts readability, which patch 2.1 fixed by letting players remove decorations and visual effects. The community makes mods that swap Rajdhani for more legible fonts.

### Cited Findings
- Most of C2077's UI is set in Rajdhani (Regular to Bold). Orbitron is a secondary face for less important text. Blender and Refinery appear on the websites, and all of them appear on in-world screens and holograms. — [Fonts In Use](https://www.fontsinuse.com/uses/60926/cyberpunk-2077-video-game); [Abstract Fonts](https://news.abstractfonts.com/fontsinuse/cyberpunk-2077-videogame)
- Mods replace Rajdhani with Atkinson Hyperlegible ("increased legibility for visual impairments") or Roboto, which signals a readability problem with the original font. — [Nexus: Atkinson Hyperlegible](https://www.nexusmods.com/cyberpunk2077/mods/18078); [Nexus: Roboto](https://www.nexusmods.com/cyberpunk2077/mods/18623)
- The UI is built on rules derived from lore and technology. The military system deliberately uses red despite its usual danger meaning. — [Behance (CDPR Senior UI Artist)](https://www.behance.net/gallery/133185623/Cyberpunk-2077User-Interface-%28Part-2%29)
- Criticism: the red is overused and flattens hierarchy, decorative flourishes crowd small icons, the red map doesn't distinguish zones, and yellow and blue contrast well. — [Interface In Game](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)
- 2.1 options remove chromatic aberration, lens distortion and ghosting from the HUD, plus "decorative elements". — [Game8](https://game8.co/games/Cyberpunk-2077/archives/435698); [Can I Play That](https://caniplaythat.com/2023/12/05/cyberpunk-2077-patch-2-1-adds-accessibility-features-and-menu/)
- Watch Dogs 2: the art direction (the MK12 opening cinematic) bridged the sterile, Helvetica-based look of WD1 with a post-punk, anarchic hacker aesthetic through early-1970s design (Aaron Marcus, John Whitney). — [Motionographer](https://motionographer.com/2016/11/16/breakdown-watch-dogs-2-0-opening-cinematic-by-mk12/)
- The C2077 seizure risk came partly from glitch effects (e.g. around Johnny Silverhand), not only from braindance. — [Game Informer](https://www.gameinformer.com/2020/12/11/new-cyberpunk-2077-update-addresses-major-epilepsy-issue); [GameSpot](https://gamespot.com/articles/cyberpunk-2077-has-sections-that-can-trigger-epileptic-seizures/1100-6485214/)

### Inferences
- Typography for Seki Senshi: a narrow technical display font (Rajdhani and Orbitron are free on Google Fonts, which the artifact/web rules allow) only for headings, numbers and labels. Use a legible font for longer text (dialogue, journal, tooltips), with an option to switch to Atkinson Hyperlegible (also on Google Fonts). Use `font-variant-numeric: tabular-nums` for money, clock and ammo so the digits don't jump.
- Angular frames via CSS `clip-path: polygon()` (cut corners) cost almost nothing and scale with the HUD. Glitch transitions should be short (<300 ms), never stroboscopic, and turned off by `prefers-reduced-motion` and a "reduce effects" toggle.
- Colour tokens defined by function (objective, optional, danger, friendly, hackable, rarity), not by decoration, with a palette for each colourblind mode. Give each faction or system its own accent (as CDPR does with corporations and the military) but keep red reserved for danger in the HUD.

### Gaps
- No primary source (an interview or talk) on C2077's rarity colours, frames or glitch animations. The CDPR GDC talk is technical (engine), not about art direction.
- No sources on the visual language of Ghostrunner, Ruiner or The Ascent (search returned only store pages). — [nodal.gg Ruiner](https://nodal.gg/game/ruiner-464060)

## 5. Accessibility: readability, colourblind modes, photosensitivity, subtitles, HUD scale, motion sickness

### Takeaway
C2077's launch shows the cost of neglecting photosensitivity: braindance used a red and white LED flashing pattern resembling a medical seizure-induction device, and a reviewer had a seizure. The fix (1.04) was to soften the flashes plus a warning screen, but advocates wanted a toggle. Guidelines (GAG, Xbox XAG 118, WCAG 2.3.1) give hard thresholds and checklists. Seki Senshi can meet the basic level cheaply.

### Cited Findings
- Game Informer's Liana Ruppert reported a seizure: the braindance headset flashes red and white LEDs rapidly, like neurologists' diagnostic devices. Club strobes and glitch effects were also triggers. — [Game Informer](https://www.gameinformer.com/2020/12/11/new-cyberpunk-2077-update-addresses-major-epilepsy-issue); [GameSpot](https://gamespot.com/articles/cyberpunk-2077-has-sections-that-can-trigger-epileptic-seizures/1100-6485214/)
- Hotfix 1.04 softened the braindance effect and reduced the frequency and intensity of flashes, and a seizure-risk warning was added to all versions. Commentators argued a settings toggle would have been better. — [PC Gamer](https://pcgamer.com/cyberpunk-2077-hotfix-attempts-to-address-seizure-trigger-fixes-several-quest-bugs); [Checkpoint Gaming](https://checkpointgaming.net/news/2020/12/new-cyberpunk-2077-patch-reduces-seizure-risk-and-improves-performance); [GamesRadar](https://www.gamesradar.com/cyberpunk-2077-braindance-missions-feature-lighting-effects-that-can-reportedly-affect-epileptic-players)
- XAG 118: a flash is a 10% change in luminance. Avoid moving repeated patterns covering 25% or more of the screen and static ones covering 40% or more. Removing risky content is preferred over warnings. — [Xbox Accessibility Guideline 118](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118)
- WCAG 2.3.1: at most 3 flashes per second, unless below the area and contrast thresholds. The red-flash threshold is stricter. — [WCAG 2.3.1 summary](https://www.disabilityworld.org/toolkit/standards/wcag/2-3-1-three-flashes-or-below-threshold/)
- GAG (excerpts): Basic: readable default font size, high contrast of text and UI against the background, no essential information carried by colour alone, subtitles for important speech, avoid flicker and repetitive patterns, remappable controls, large and well-spaced controls on touch screens. Intermediate: resizable and rearrangeable interfaces, customisable subtitles, subtitles on before any sound plays, an option to disable background movement and differences between controller and camera movement. Advanced: adjustable font size, no reliance on precise timing, no sudden unexpected movement. — [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/)
- C2077 (state after 2.1): colourblind modes for protan, deutan and tritan; subtitles (cinematic, radio, overhead) with size and opacity; reduced camera motion; centre dot; weapon sway affecting the weapon rather than the camera; larger text and HUD; removal of HUD effects and decorations; Breach Protocol with no timer. — [Can I Play That](https://caniplaythat.com/2023/12/05/cyberpunk-2077-patch-2-1-adds-accessibility-features-and-menu/)

### Inferences
- Minimal set for Seki Senshi settings (a React panel, persisted): HUD scale (e.g. 75–150%), text size, a readable font, colourblind palettes (CSS token swap), damage numbers mode, hit-marker toggle, "reduce flashes/glitch" (on by default if `prefers-reduced-motion`), camera shake and head bob slider, a centre dot (motion sickness), FOV (desktop), "untimed dialogue/hacking", subtitles with size and a background, and overhead NPC "barks".
- A rule for the NPR/rendering team: damage glitches, muzzle flash and neon must not exceed 3 flashes/s over large areas, and red full-screen flashes need extra care. This is worth an automated check in the e2e perf test (luminance histogram between frames). (Inference, a proposal.)
- A short photosensitivity warning at the start is the minimum. A toggle that actually removes the effect matters more (XAG 118, the criticism of CDPR).
- Rebinding exists in Seki Senshi. Coverage of every screen matters (C2077 lacked binds for Journal and Map).

### Gaps
- I didn't fetch the full text of XAG 101/103 (text size, contrast). The GAG references are a summary from the full list.
- No concrete minimum HUD-scale values from guidelines (guidelines say only "allow resize").

## 6. Mobile/touch adaptations for an action HUD

### Takeaway
Reliable design guidance for touch shooter HUDs is thin online; the results are mostly player guides (COD Mobile, Free Fire). Their consensus: left thumb on a virtual joystick, right thumb on aiming and fire, reload near fire but slightly lower, adjustable transparency, size and position, and a minimap that doesn't obscure the view. GAG requires large, well-spaced targets on touch.

### Cited Findings
- GAG Basic: "Ensure interactive elements / virtual controls are large and well spaced, particularly on small or touch screens". Intermediate: allow resizing and rearranging the interface. — [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/)
- Player guides (anecdotal, low-quality domains): joystick bottom-left. Fire within reach of the right thumb with aim close by. Reload near fire, slightly lower, to avoid accidental reloads. Transparency adjustable so buttons don't cover the view. Layouts vary by player (fire on the left or right), so a custom layout editor matters. — [example guide, COD Mobile 2-finger](https://partnerwithscphealth-jitsi.bluetext.com/blog/best-2-finger-hud-layout); [Fortnite 4-finger](https://partnerwithscphealth-jitsi.bluetext.com/blog/best-4-finger-hud-layout) (low-quality sources, hosted on unrelated domains)

### Inferences
- For Seki Senshi on phones: a floating joystick (appears where the left thumb touches); a right-half drag for the camera; fire, aim and interact as a cluster in the bottom-right corner; secondary actions (reload, weapon switch, scanner) in a radial or arc around fire; a smaller minimap or one that collapses on tap. Use `env(safe-area-inset-*)` for notches and touch targets of at least ~44–48 CSS px (iOS HIG and Material, not verified in this session).
- On touch, replace hover tooltips with a tap-and-hold preview. Dialogue choices should be tall (full-width lists). The menu should open as a fullscreen sheet.
- Interaction prompts on touch should be a contextual button (e.g. a "Use" button appears near the thumb) rather than a "Press E" label. Show bindings dynamically according to the last input device used.
- Make onboarding hints separate for touch and keyboard (different gestures).

### Gaps
- No credible industry source (GDC talk, Apple/Google HIG) on touch shooter HUDs was read in this session. The 44 pt / 48 dp values come from general knowledge and need checking at the source.
- No data on touch adaptations in any of the cyberpunk games examined (none has an official mobile version besides streaming).
