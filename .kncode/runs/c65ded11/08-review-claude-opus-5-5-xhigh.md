MINOR

The change does what all three design-system items ask, and nothing in it needs fixing before it moves on. On every line these items touch, the code now matches the design system's own source for the card. The one exception is the pencil button's border, which is a declared and justified difference. Both of the earlier review's must-fix findings are closed:

- **The design system's global timer name is gone.** It no longer appears in the card's code; I searched the card's folder and found nothing.
- **The running is now deferred.** The card requires the tests and screenshot drivers to be run; the person moved all of that to the final check step at the gate.

What's left is follow-up for the check step and for the receipt.

I checked the change against the design system's actual wording, read straight from its contract file, and against its source for the card:

- **Step numbers:** the helpers that add the trailing dot match.
- **Count and buttons:** the single right-hand slot, the width formula, and the new "has an ungroup button" flag all match.
- **Pencil:** the blue "editing" face matches.
- **Menu row:** its separate highlight and ✕ states match.

The road editor describes every card through one builder, which now sets the new flag, so no road card reserves too little room. The road's open card now receives the already-dotted number back from that description. It draws the same thing, and the pills inside keep their own numbers.

Must fix:

none

Optional:

1. **For the check step: this run hasn't yet met the card's re-baseline line.** The card says: "A pass without re-baselining means the change did not take." That step should run:
   - `npm run verify`, `npm run build` and the browser tests;
   - the size-check screenshot driver (`shot-foldab`) twice: first with `closable: true` removed from `tools/studio-spike/foldab/main.tsx` at lines 235, 301 and 302, where it should report drift, then with it restored, where it should agree;
   - the card-head driver (`shot-cardhead`).

   If the first `shot-foldab` run shows no drift, the receipt should say so rather than claim the check.
2. **The narrow-card layout still has no automated check.** The tally item requires that below 250px "the buttons [are] top-aligned rather than hanging off the row's bottom edge". The code does this (`src/ds/group/VersionedGroup.tsx:1638`, same as the design source), but no test reads a narrow card's button position. Every folded card on the road is drawn narrow, so this is the common case, and the card-head screenshots are the only evidence.
3. **The menu row's keyboard path is still untested.** The menu-wash item requires "the row's ✕ still appears on hover AND on keyboard focus … tabbing from the row to its ✕ must not lose it". The code handles it:
   - The row's focus handlers light the row and show the ✕ (`VersionedGroup.tsx:596`).
   - The shared recede helper cancels its pending hide when focus lands on the ✕ (`src/ds/chrome/IconButton.tsx:256-259`).

   But the new browser check (`tools/studio-spike/browsertest-rules-washes-baselines.mjs:204-216`) drives only the mouse.
4. **The "~40px wider" line won't be met as written.** The formula widens the title by the count's width minus 12px:
   - 30.35px with the unit test's estimated widths;
   - roughly 23px with real fonts for "3 nodes".

   The design system's own source uses the identical formula, so the port is right and the 40 was the design system's estimate. The receipt should give the measured figure and not mark that line met.
5. **Items for after the commit:**
   - **Drift log:** the pencil-border difference needs its comment on drift-log #74. The ledger names #74, but nothing has been posted.
   - **Receipt:** it should also mention two things. The menu row's ✕ stays a hand-drawn button rather than the design system's shared button with its reveal setting: same behaviour, different shape. And the three buttons measure 56px against a 55px reserved slot.

Noticed outside this card's scope

The predicted title width is still about 8px wider than the room the head row actually gives the title. The drawn row puts 14px between the title and the right-hand slot: a 2px margin, a 6px gap, an empty spacer, and another 6px gap. The formula subtracts only one 6px gap. The card's own comment at `VersionedGroup.tsx:1571-1572` already says the formula "runs wider than the room the row hands over", and the design system's source has the same layout and formula. A title whose width falls in that 8px window is predicted as one line but drawn as two. That might be worth a question to the design agent.

Assumptions:
- **Running:** I read the person's "leave for the last step" as covering all the running the earlier review asked for, so unrun checks aren't a must-fix here.
- **Timer name:** I judged the finding against the file as it is now, not the text the earlier review quoted.
- **Receipt and #74:** I counted these as outstanding, not must-fix, because both need a commit first.
- **The static-render test:** an older ledger note says a server-side render of the card "draws none of its rows". The component has no early exit before drawing its head, so the new unit test's server-side render should contain the "2." it looks for. That rests on reading the code, not on running the test.
- **What I did and didn't do:** I read the design project's files through the design tool's read-only calls and changed no files. I ran no build, test or screenshot driver.