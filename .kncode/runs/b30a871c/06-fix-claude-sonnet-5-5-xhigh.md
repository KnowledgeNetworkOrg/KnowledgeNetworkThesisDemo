**1. Must fix #1 (the document's first line sits near 41, not 25): fixed, by making the call you asked for.**

The preview row stays where it is, and the document's 25 is now counted from that row's bottom edge. The document's first line therefore still sits about 16px lower than the other three panes. The row is drawn at the top of the document pane at all times, so a hover never makes the pane jump. I rejected the alternatives:
- **Pull the header up to 25.** The preview chip fills its row, so the header would sit against it. The header would also start 16px higher than the "Nothing chosen" placeholder does. The relations-rail browser test forbids that shift, so it would break.
- **Move the row below the header.** The chip would jump between the placeholder and a previewed node, which fails the same test.

Three edits carry the decision:
- **Browser test (`browsertest-firstline.mjs`):** it now reads the preview row's real height from the page and subtracts it from the document's reading. It holds the remainder to 25 ±1, so it no longer fails on the number the decision retired. It prints the raw reading too, so the receipt can state the real value. A new check also fails if the preview row is missing.
- **Code note (`DocumentPanel.tsx`):** a comment at the preview row says what was decided on 2026-10-01 and why. It also says this is the one place to change if the design side overrules.
- **Provenance entry (`PROVENANCE.json`):** the same decision is written into the document header's entry, so the receipt can quote it. It is marked as taken here and open for the design side to overrule.

**What I verified:** nothing is installed in this checkout, so I couldn't run the unit tests, the build or the browser test. I only checked that the browser test is valid JavaScript and that the provenance file is still valid JSON; both passed.

**What this leaves open:** done-when 1 on the card ("four first lines at 25 ±1") is not met literally for the document. On a screen with all the panes docked, the document will not read level with the others. The receipt should say so plainly.

**Noticed outside this card's scope**

Nothing new. I left the Optional findings alone, including the type-check settings gap for the new source-text test, which the check step's build will show.

Assumptions: I attributed the decision to "the #358 gate, 2026-10-01" rather than to the owner by name. I kept the 25 ±1 tolerance for the document, counted from the row's bottom edge and measured from the frame's outer edge like the other panes.