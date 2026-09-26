I made all three changes to the version-group card, but I couldn't run anything to check them. This copy of the repo has no installed packages, so the type checker, the tests and the browser drivers aren't available, and installing them would have changed the checkout. Everything below is edited, not verified.

**What changed**

- **Step numbers always end in a dot.** The card's number now reads "2." whether the road passes it "2" or "2.", matching the "1." "2." pills inside it. The width predictions (the arithmetic the road uses to lay out each card before drawing it) measure the dotted number too, so a missing dot no longer cuts the title one character short. The step chain inside the card always adds the dot as well. The road's own code for numbers is unchanged, as the design system required.
- **The count and the buttons share one space.** At rest the node count sits right against the card's right edge; the empty strip that was held for the hidden buttons is gone. Hovering the card fades the three buttons in exactly where the count was and fades the count out, and nothing moves sideways. Because the title no longer gives up room to both, it gets wider: by my hand calculation about 30px on a typical card, not the "~40px" the design system estimated.
- **The pressed edit button is blue, not grey.** With edit mode on, it now wears the same blue "editing" colours as the fields it opens.
- **The road reserves room for three buttons.** One placeholder line in the road editor tells the size prediction that every card has an ungroup button. Before, it reserved room for two while the card drew three. Visible effect: some folded cards with long titles may wrap one line sooner, and some open cards may get shorter because their titles now fit.
- **Menu highlight: only a documentation note.** The highlight already cleared instantly while the red ✕ lingered, from an earlier fix. I added the design system's "never drive a highlight from the lingering timer" rule to the shared timer helper. I checked the road editor's old version menu (now gone) and the five other places that use the timer: none has the fault.
- **Tests and records:** a new fast unit test, new checks in two browser tests, the size-check page's three hand-built card descriptions updated, and dated entries in the provenance ledger (the file recording where each design-system copy came from and how it differs).

**Two things I found in the design system's version**

- **Its pencil code has a bug, and I fixed it here.** It sets only the button's border colour, but the button re-applies its whole border on every hover. So after the pointer left, the blue edge would vanish. I set the whole border instead; it looks identical and can't be erased. This is a deliberate difference from the design system.
- **Its 55px figure is 1px short.** Three 18px buttons with 1px gaps are 56px wide, so they overhang their space by 1px. I kept 55 because the design system's done-when condition names it exactly, and noted it for the receipt.

**Still to do**

- Run `npm run verify` and the browser tests.
- Run the card-size screenshot driver (`shot-foldab`): it should agree with the drawn cards and needs its images re-taken. Also run `shot-cardhead`.
- Write the receipt to the design project once there's a commit, including the 1px note and the pencil fix.
- Post the pencil difference on the drift log, issue #74. I couldn't use GitHub in this step.

Assumptions:
- I didn't restructure the menu row to use the design system's shared button for its ✕, because it already behaves correctly and the card forbids reshaping this file.
- I kept 55px even though three buttons measure 56px.
- I set the pencil's whole border rather than just its colour, as a logged difference from the design system.