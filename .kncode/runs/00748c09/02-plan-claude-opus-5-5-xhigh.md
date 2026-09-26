Here's the plan. Before the list, the short version of what I found, since some of it changes the size of the job.

**What the work is:** An optional walk stop (one the walk may skip) should look optional everywhere a stop is drawn. Today it doesn't on the map, and the walk editor lets a *group* carry its own "optional" flag, which the owner has now ruled out. There are three obligations: groups lose their flag (the Optional button sets every stop inside instead), map pins get the dashed ring, and optional stops get italic names and slanted numbers.

**Four things I found that the card doesn't say:**
- **Where the Optional button is.** The design side designed the new "mixed" state (some stops optional, some not) for the app-wide toolbar. In this app the button is a labelled pill in the walk editor's own action bar, and that pill has no mixed state on either side. The design side's own mock doesn't include this button at all.
- **A font file needs updating.** The amendment keeps optional names bold *and* italic. That only renders properly because the design side switched to a font file with real bold italics. The app's copy still has regular-weight italic only, and nothing stops the browser faking the bold. Without re-copying that file, the names would render in a smeared fake bold.
- **The projector window.** It receives only a bare list of stop ids, so the optional flag would be lost on the projected map unless the flag travels with it.
- **Tests that will break on purpose.** One browser check asserts that the pill-shaped stop mark contains no drawing element. The design fix changes exactly that, so the check must change with it. Some pin-count expectations may also move, because optional and required stops will no longer merge into one pin.

**Plan**

1. **Groups (first obligation):** make the Optional button act on every stop inside a selected group (or fork) in one undo step. Show on / mixed / off from a reading computed over those stops. A press from mixed makes all of them optional. A stop added later arrives required. Remove every place that stores or reads a group-level flag: the editor's road, the columns view, road resolution, and saved-draft loading.
2. Pull that group logic out as plain functions so the unit tests can reach it, and add tests: set, clear, mixed, a press from mixed, a newly added stop, and an old saved draft with a group flag.
3. Port the toolbar's three-state button and its glyph-alignment fix, as the obligation says. Give the walk editor's Optional pill the same three rungs as a recorded local addition.
4. **Map pins (second obligation):** port the design side's current stop-mark component whole. That covers the pill-shaped mark drawn as one image, the dash corrected so its gaps actually show, and the published slant constants, which also get exported.
5. Carry a per-stop "optional" flag on the shared route the panes read. Pass it to pin layout as a list running alongside the stop ids, and give each pin its own flag. Never merge a run of stops across an optional/required boundary. Add pin-layout tests.
6. Have the map pass each pin's flag to its mark, and send the flags to the projector window so the projected map shows them too.
7. **Italic (third obligation), with the amendment:** optional names are italic and keep their normal weight — semibold on the current stop, on the card heading and on the closed dock. This applies to the strip and dock stop titles, the hover card (where the stop number also slants but without the centring nudge), and the dock's closed rail. On the closed rail the italic wraps the name only, so the territory note after it stays upright. The "(optional)" word stays regular italic.
8. Re-copy the design side's font file (real italics at 400–800) and update the record of what was ported and from where.
9. Update the stop-mark browser check. Add a browser check for the whole chain on the running page: editor button → dashed chips → dashed, slanted map pins → dock, strip and hover card italics.
10. Run the full verify and browser suites, then check the running page by eye.
11. Write the receipt into the design project and draft the drift-log notes. The receipt says done per obligation with the commit, states the flag's shape (a list alongside the ids), and says whether the dock's dashed dot was already visible before the map changed. The drift-log notes cover the local mixed pill and the font divergence.

Files: src/state/walk/authordraft.ts, src/state/walk/mockwalk.ts, src/state/walk/draftpersist.ts, src/instruments/walkdesk/WalkActionBar.tsx, src/instruments/walkdesk/AuthorRoad.tsx, src/instruments/walkdesk/WalkColumns.tsx, src/ds/chrome/Toolbar.tsx, src/ds/chrome/PillButton.tsx, src/ds/chrome/PaneActionBar.tsx, src/ds/nav/StepDot.tsx, src/ds/index.ts, src/model/route.ts, src/model/walkpins.ts, src/instruments/MapView.tsx, src/present/projector.ts, src/present/PresenterScreen.tsx, src/present/ProjectorScreen.tsx, src/ds/nav/WalkParts.tsx, src/ds/nav/WalkPreview.tsx, src/ds/map/WalkDock.tsx, src/tokens/fonts.css, src/ds/PROVENANCE.json, tests (authordraft, draftpersist, walkpins, route, playback .test.ts), tools/studio-spike/drive-stepdot.mjs, plus one new tools/studio-spike/browsertest-*.mjs driver.

Out of scope: nothing stated on the card itself. The obligations' own text forbids: an inherited ("OR") optional rule for groups; loading the mono italic or changing the 11° slant to 9°; self-hosting fonts; making "(optional)" follow the name's weight; drawing the mixed state with a dashed pill; pin layout reading the flag anywhere except where runs merge; and adding any new property for the italic work.

Verify: with `npm run dev`, select the seeded group "Reach the machine" in the walk editor and press Optional. Both of its stops draw dashed and the button reads fully on. Toggle one stop back and the button shows a ring with no fill (mixed). On the map, the still-optional stop's pin has a dashed ring and a slanted number, and is a separate pin from its required neighbour. Its dock dot is dashed, its dock and strip name is italic, the closed dock shows "*name* *(optional)* · Territory" with the territory upright, and the hover card heading is semibold italic with a slanted number.
npm ci --prefix desktop
npm run verify
npm run test:browser

Assumptions:
- "Versioned group" means any container: a plain group or a fork. A press sets every stop in every version, nested groups included.
- The mixed state goes on the pill where the button actually lives, mirroring the toolbar's three rungs, and is flagged to the design side. The alternative is to ask them first, at the cost of a round trip.
- An old saved draft whose group carries the flag gets it pushed down onto that group's stops, then removed, so what the author meant survives.
- A group whose stops are all optional disappears whole when optionals are bypassed, instead of leaving an empty numbered step.
- With several blocks selected, the button reads, and a press sets, all stops under the whole selection. Today each block flips on its own.
- Re-copying the font file is required even though the italic obligation says "no token change", because its own amendment moved that file.
- The dock's open row draws its stop mark in the dark "rail" style, which the design side believed nothing uses for these marks. I'll port as written and raise it as a question on the receipt rather than patch around it.